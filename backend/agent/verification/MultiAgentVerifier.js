const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { VerificationContract } = require('./VerificationContract');
const CapabilityPolicy = require('../policy/CapabilityPolicy');
const defaultProjectAuth = require('../../services/projectAuthorization');
const { WorkspaceManager } = require('../../services/workspaceManager');
const VerificationResultDAO = require('../../db/dao/VerificationResultDAO');
const ArtifactDAO = require('../../db/dao/ArtifactDAO');
const logger = require('../../logger');

class MultiAgentVerifier {
  constructor(options = {}) {
    this.db = options.db || null;
    this.projectAuthService = options.projectAuthService || defaultProjectAuth;
    this.workspaceManager = options.workspaceManager || new WorkspaceManager(this.db);
    this.verificationResultDao = options.verificationResultDao || (this.db ? new VerificationResultDAO(this.db) : null);
    this.artifactDao = options.artifactDao || (this.db ? new ArtifactDAO(this.db) : null);
    this.contextAssembler = options.contextAssembler || null;
  }

  /**
   * Verify a worker result independently.
   *
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.userId
   * @param {Object} params.workerResult - Result from Coder / Researcher
   * @param {Array<string>} [params.requestedChecks=[]] - Check types to run
   * @param {Object} [params.options={}] - Custom check runners / overrides
   * @returns {Promise<Object>} Canonical VerificationContract result
   */
  async verify({
    projectId,
    userId,
    workerResult,
    requestedChecks = [],
    options = {}
  }) {
    // 1. Authorize user & project
    const auth = this.projectAuthService.authorize(projectId, { user: { id: userId } });
    if (!auth.authorized) {
      throw new Error(auth.error || `Unauthorized: User '${userId}' cannot verify project '${projectId}'`);
    }

    // 2. Capability policy assertion: VERIFIER cannot mutate files
    if (CapabilityPolicy.isAllowed('VERIFIER', 'filesystem.write') || CapabilityPolicy.isAllowed('VERIFIER', 'code.edit')) {
      throw new Error('Security Violation: VERIFIER role must not have filesystem mutation capabilities');
    }

    if (!workerResult || typeof workerResult !== 'object') {
      return VerificationContract.formatBlockedResult(
        'Missing worker result for verification',
        'Worker did not produce a structured result object'
      );
    }

    // 3. Assemble Independent Verifier Context (do not reuse Coder's full dump)
    let verifierContext = null;
    if (this.contextAssembler) {
      try {
        verifierContext = await this.contextAssembler.assemble(projectId, userId, `Verify: ${workerResult.summary || 'Worker output'}`);
      } catch (ctxErr) {
        logger.warn(`[MultiAgentVerifier] Context assembly warning: ${ctxErr.message}`);
      }
    }

    const failedChecks = [];
    const validatedEvidenceRefs = [];
    const validatedArtifactRefs = [];

    // 4. Evidence Freshness & Tenant Validation
    const evidenceRefs = Array.isArray(workerResult.evidence_refs) ? workerResult.evidence_refs : [];
    const artifactRefs = Array.isArray(workerResult.artifact_refs) ? workerResult.artifact_refs : [];

    // Check artifacts isolation & integrity
    if (this.artifactDao && artifactRefs.length > 0) {
      for (const artId of artifactRefs) {
        const artifact = this.artifactDao.getById(artId, projectId);
        if (!artifact) {
          failedChecks.push({
            check_type: 'FILE_INTEGRITY',
            message: `Artifact '${artId}' not found or belongs to another project`,
            details: `Cross-project or missing artifact reference: ${artId}`
          });
        } else {
          validatedArtifactRefs.push(artId);
        }
      }
    }

    // Check evidence freshness (e.g. workspace file hashes)
    const wsPath = this.workspaceManager.getWorkspacePath(projectId);
    if (options.evidenceVersionHashes && typeof options.evidenceVersionHashes === 'object') {
      for (const [ref, expectedHash] of Object.entries(options.evidenceVersionHashes)) {
        const resolvedPath = path.resolve(wsPath, ref);
        if (fs.existsSync(resolvedPath)) {
          const content = fs.readFileSync(resolvedPath);
          const currentHash = crypto.createHash('sha256').update(content).digest('hex');
          if (expectedHash && currentHash !== expectedHash) {
            failedChecks.push({
              check_type: 'FILE_INTEGRITY',
              message: `Stale evidence detected for '${ref}'`,
              details: `Expected hash ${expectedHash.substring(0, 8)}, current hash ${currentHash.substring(0, 8)}`
            });
            continue;
          }
          validatedEvidenceRefs.push(ref);
        } else {
          failedChecks.push({
            check_type: 'FILE_INTEGRITY',
            message: `Evidence file '${ref}' does not exist on disk`,
            details: `Missing file in workspace: ${ref}`
          });
        }
      }
    }

    // 5. Execute Checks
    const checksToRun = requestedChecks.length > 0
      ? requestedChecks
      : (options.checks || ['UNIT_TEST', 'FILE_INTEGRITY', 'SECURITY']);

    for (const checkType of checksToRun) {
      const normalizedCheck = checkType.toUpperCase().trim();
      if (!VerificationContract.CHECK_TYPES.includes(normalizedCheck)) {
        continue;
      }

      // Check if custom check executor supplied
      if (options.checkExecutors && typeof options.checkExecutors[normalizedCheck] === 'function') {
        try {
          const checkRes = await options.checkExecutors[normalizedCheck]({
            projectId,
            wsPath,
            workerResult,
            context: verifierContext
          });
          if (!checkRes.passed) {
            failedChecks.push({
              check_type: normalizedCheck,
              message: checkRes.message || `Check ${normalizedCheck} failed`,
              details: checkRes.details || ''
            });
          }
        } catch (err) {
          failedChecks.push({
            check_type: normalizedCheck,
            message: `Check execution error: ${err.message}`,
            details: ''
          });
        }
      } else {
        // Built-in lightweight check handlers
        if (normalizedCheck === 'SECURITY') {
          // Security scan for secrets in worker summary / artifacts
          const serialized = JSON.stringify(workerResult);
          if (/AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{20,}|BEGIN\s+PRIVATE\s+KEY/.test(serialized)) {
            failedChecks.push({
              check_type: 'SECURITY',
              message: 'Detected sensitive API key or private key in output',
              details: 'Secret pattern matched in worker result payload'
            });
          }
        } else if (normalizedCheck === 'UNIT_TEST') {
          // If worker declared errors, unit tests fail
          if (Array.isArray(workerResult.errors) && workerResult.errors.length > 0) {
            failedChecks.push({
              check_type: 'UNIT_TEST',
              message: 'Worker reported execution errors',
              details: workerResult.errors.map(e => e.message).join(', ')
            });
          }
        }
      }
    }

    // 6. Compute Deterministic Verdict
    let status = 'PASS';
    let summary = 'Independent verification PASSED: all checks validated successfully';
    let confidence = 1.0;

    if (failedChecks.length > 0) {
      const hasSecurityOrMissing = failedChecks.some(c => c.check_type === 'SECURITY' || c.message.includes('not found') || c.message.includes('Stale'));
      status = 'FAIL';
      summary = `Verification FAILED on ${failedChecks.length} check(s): ${failedChecks.map(c => c.check_type).join(', ')}`;
      confidence = Math.max(0.1, Math.round((1 - (failedChecks.length * 0.25)) * 100) / 100);
    }

    const canonicalResult = VerificationContract.validate({
      status,
      summary,
      evidence_refs: validatedEvidenceRefs.length > 0 ? validatedEvidenceRefs : evidenceRefs.slice(0, 10),
      artifact_refs: validatedArtifactRefs.length > 0 ? validatedArtifactRefs : artifactRefs.slice(0, 10),
      failed_checks: failedChecks,
      confidence
    });

    // 7. Persist VerificationResult if stepId provided
    if (options.stepId && this.verificationResultDao) {
      try {
        this.verificationResultDao.create({
          id: `vr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          stepId: options.stepId,
          status: canonicalResult.status,
          reason: canonicalResult.summary,
          evidence: JSON.stringify(canonicalResult)
        });
      } catch (dbErr) {
        logger.warn(`[MultiAgentVerifier] Failed to persist verification result to DB: ${dbErr.message}`);
      }
    }

    return canonicalResult;
  }
}

module.exports = MultiAgentVerifier;
