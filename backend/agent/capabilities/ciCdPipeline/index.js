'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: CI/CD Pipeline Capability Orchestrator
 * Canonical Capability: devops.ci_cd_pipeline (Capability #25)
 * 
 * Implements the full lifecycle:
 * Introspection -> CiCdPlan -> CiCdValidator -> PipelineSynthesizer -> CPM ->
 * GitHubActionsAdapter -> Semantic Validation -> Conflict Protection -> TransactionManager -> Result
 */

const path = require('path');
const fs = require('fs');
const { CiCdPlan, OFFICIAL_ACTION_SHAS } = require('./CiCdPlan');
const { CiCdValidator } = require('./CiCdValidator');
const { PipelineSynthesizer } = require('./PipelineSynthesizer');
const { CanonicalPipelineModel } = require('./CanonicalPipelineModel');
const { GitHubActionsAdapter } = require('./GitHubActionsAdapter');
const { WorkflowSemanticValidator } = require('./WorkflowSemanticValidator');
const { CiCdResult, CICD_STATUS } = require('./CiCdResult');
const { TransactionManager } = require('../../../services/transactionManager');
const { capabilityGatekeeper } = require('../../policy/CapabilityGatekeeper');

/**
 * Generates unified line-by-line diff representation between two texts
 */
function computeTextDiff(oldText, newText, filename) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diffLines = [`--- a/${filename}`, `+++ b/${filename}`];

  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      diffLines.push(` ${o || ''}`);
    } else {
      if (o !== undefined) diffLines.push(`-${o}`);
      if (n !== undefined) diffLines.push(`+${n}`);
    }
  }

  return diffLines.join('\n');
}

/**
 * Main execution entry point for Phase 4E CI/CD Pipeline Generation
 */
async function generateCiCdPipeline(rawPlan, options = {}) {
  const startTime = Date.now();
  const plan = rawPlan instanceof CiCdPlan ? rawPlan : new CiCdPlan(rawPlan);

  // 1. Validation
  const validation = CiCdValidator.validatePlan(plan);
  if (!validation.ok) {
    const primaryError = validation.errors[0];
    return new CiCdResult({
      ok: false,
      status: primaryError.code === 'MISSING_LOCKFILE' ? CICD_STATUS.DEPENDENCY_ERROR : CICD_STATUS.UNSUPPORTED,
      planId: plan.planId,
      platform: plan.platform,
      errors: validation.errors,
      warnings: validation.warnings,
      metrics: { durationMs: Date.now() - startTime }
    });
  }

  // 2. Synthesize Canonical Pipeline Model (CPM)
  let cpm;
  try {
    cpm = PipelineSynthesizer.synthesize(plan);
  } catch (err) {
    return new CiCdResult({
      ok: false,
      status: CICD_STATUS.UNSUPPORTED,
      planId: plan.planId,
      platform: plan.platform,
      errors: [{ code: err.code || 'SYNTHESIS_ERROR', message: err.message }],
      metrics: { durationMs: Date.now() - startTime }
    });
  }

  // 3. Adapter Generation: CPM -> GitHub Actions YAML AST
  const workflowYaml = GitHubActionsAdapter.generateWorkflowYaml(cpm, plan);
  const workflowChecksum = GitHubActionsAdapter.computeChecksum(workflowYaml);
  const workflowRelPath = path.posix.join(plan.workflowOutputDir, 'ci.yml');

  const filesToStage = [
    {
      path: workflowRelPath,
      type: 'CI_WORKFLOW',
      content: workflowYaml,
      checksum: workflowChecksum
    }
  ];

  // Optional Inert Deployment Template
  if (plan.stages.deploymentTemplate) {
    const deployTemplateYaml = GitHubActionsAdapter.generateDeploymentTemplate(cpm, plan);
    const deployChecksum = GitHubActionsAdapter.computeChecksum(deployTemplateYaml);
    const deployRelPath = path.posix.join(plan.workflowOutputDir, 'deploy.yml.template');
    filesToStage.push({
      path: deployRelPath,
      type: 'DEPLOYMENT_TEMPLATE',
      content: deployTemplateYaml,
      checksum: deployChecksum
    });
  }

  // 4. Semantic Validation
  const semanticVal = WorkflowSemanticValidator.validate(workflowYaml);
  if (!semanticVal.valid) {
    return new CiCdResult({
      ok: false,
      status: CICD_STATUS.UNSUPPORTED,
      planId: plan.planId,
      platform: plan.platform,
      errors: semanticVal.errors.map(e => ({ code: 'SEMANTIC_VALIDATION_ERROR', message: e })),
      warnings: semanticVal.warnings.map(w => ({ code: 'SEMANTIC_WARNING', message: w })),
      metrics: { durationMs: Date.now() - startTime }
    });
  }

  // 5. Secret Leak Scanning
  const secretLeaks = CiCdValidator.scanForSecrets(workflowYaml);
  if (secretLeaks.length > 0) {
    return new CiCdResult({
      ok: false,
      status: CICD_STATUS.UNSUPPORTED,
      planId: plan.planId,
      platform: plan.platform,
      errors: secretLeaks.map(msg => ({ code: 'SECRET_LEAK_DETECTED', message: msg })),
      metrics: { durationMs: Date.now() - startTime }
    });
  }

  // 6. Existing Workflow Conflict Protection
  const diffs = [];
  if (plan.workspacePath && fs.existsSync(plan.workspacePath)) {
    const targetFileOnDisk = path.join(plan.workspacePath, workflowRelPath);
    if (fs.existsSync(targetFileOnDisk)) {
      const existingContent = fs.readFileSync(targetFileOnDisk, 'utf8');
      const existingChecksum = GitHubActionsAdapter.computeChecksum(existingContent);

      // Checksum match: identical content
      if (existingChecksum === workflowChecksum) {
        return new CiCdResult({
          ok: true,
          status: CICD_STATUS.NO_CHANGE,
          planId: plan.planId,
          platform: plan.platform,
          files: filesToStage,
          metrics: {
            jobsCount: 1,
            stepsCount: cpm.stages.length,
            nodeVersionsCount: cpm.runtimeMatrix.versions.length,
            durationMs: Date.now() - startTime
          }
        });
      }

      // Checksum divergence: conflict protection
      if (!options.allowOverwrite) {
        const diffContent = computeTextDiff(existingContent, workflowYaml, workflowRelPath);
        diffs.push({ file: workflowRelPath, diff: diffContent });

        return new CiCdResult({
          ok: true,
          status: CICD_STATUS.DIFF_REQUIRED,
          planId: plan.planId,
          platform: plan.platform,
          files: filesToStage,
          diffs,
          warnings: [{
            code: 'WORKFLOW_ALREADY_EXISTS',
            message: `Target workflow "${workflowRelPath}" already exists on disk with different content. User review required.`
          }],
          metrics: {
            jobsCount: 1,
            stepsCount: cpm.stages.length,
            nodeVersionsCount: cpm.runtimeMatrix.versions.length,
            durationMs: Date.now() - startTime
          }
        });
      }
    }
  }

  // 7. Transactional Staging (if workspacePath provided)
  if (plan.workspacePath && fs.existsSync(plan.workspacePath)) {
    const txManager = new TransactionManager();
    const txId = `tx_cicd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      txManager.beginTransaction(txId, plan.workspacePath);

      for (const file of filesToStage) {
        const stageRes = txManager.stageNewFile(txId, { path: file.path, content: file.content });
        if (!stageRes.success) {
          throw new Error(stageRes.error || `Failed to stage file: ${file.path}`);
        }
      }

      // Simulated failure hook for testing rollback
      if (options._simulateFailure) {
        throw new Error('Simulated disk write failure for testing rollback');
      }

      const commitRes = txManager.commit(txId);
      if (!commitRes.success) {
        throw new Error(commitRes.error || 'Failed to commit transaction');
      }
    } catch (err) {
      try {
        txManager.rollback(txId);
      } catch {
        // Ignore secondary rollback error
      }

      return new CiCdResult({
        ok: false,
        status: CICD_STATUS.FAILED_ROLLED_BACK,
        planId: plan.planId,
        platform: plan.platform,
        errors: [{ code: 'TRANSACTION_ROLLBACK', message: err.message }],
        metrics: { durationMs: Date.now() - startTime }
      });
    }
  }

  const allWarnings = validation.warnings.concat(semanticVal.warnings.map(w => ({ code: 'SEMANTIC_WARNING', message: w })));

  return new CiCdResult({
    ok: true,
    status: CICD_STATUS.GENERATED,
    planId: plan.planId,
    platform: plan.platform,
    files: filesToStage,
    diffs,
    warnings: allWarnings,
    metrics: {
      jobsCount: 1,
      stepsCount: cpm.stages.length,
      nodeVersionsCount: cpm.runtimeMatrix.versions.length,
      durationMs: Date.now() - startTime
    }
  });
}

module.exports = {
  generateCiCdPipeline,
  CiCdPlan,
  CiCdValidator,
  PipelineSynthesizer,
  CanonicalPipelineModel,
  GitHubActionsAdapter,
  WorkflowSemanticValidator,
  CiCdResult,
  CICD_STATUS,
  OFFICIAL_ACTION_SHAS
};
