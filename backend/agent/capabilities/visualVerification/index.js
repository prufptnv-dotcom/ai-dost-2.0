'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: VisualVerificationOrchestrator
 * 
 * Master orchestrator for Autonomous Visual Verification & Deterministic UI Healing.
 * Coordinates VisualGeometryInspector, VisualHealingEngine, and VisualVerificationResult
 * across a strictly bounded 2-iteration healing loop.
 */

const { VisualVerificationPlan } = require('./VisualVerificationPlan');
const { VisualGeometryInspector } = require('./VisualGeometryInspector');
const { VisualHealingEngine } = require('./VisualHealingEngine');
const { VisualVerificationResult } = require('./VisualVerificationResult');

class VisualVerificationOrchestrator {
  constructor(plan = null, options = {}) {
    this.plan = plan instanceof VisualVerificationPlan ? plan : new VisualVerificationPlan(plan || {});
    this.options = options;
    this.inspector = new VisualGeometryInspector(this.plan);
    this.healingEngine = new VisualHealingEngine(this.plan, {
      generatedManifest: options.generatedManifest || new Set()
    });
  }

  /**
   * Main verification and healing loop.
   * 
   * @param {Object} options
   * @param {string} [options.htmlContent] - Target HTML markup
   * @param {string} [options.cssContent] - Target CSS styles
   * @param {string} [options.filePath] - Target HTML file path
   * @param {string} [options.serverUrl] - Target dev server URL
   * @param {string} [options.targetFile] - Relative path for generated patches
   * @param {Object} [options.transactionManager] - Optional TransactionManager for atomic staging
   * @returns {Promise<VisualVerificationResult>} Result envelope
   */
  async verifyAndHeal(options = {}) {
    const startTime = Date.now();
    let currentHtml = options.htmlContent || '';
    let currentCss = options.cssContent || '';
    const allAppliedPatches = [];
    const maxIterations = Math.min(this.plan.maxIterations, 2);

    // --- Step 1: Initial Scan ---
    const initialReport = await this.inspector.inspect({
      htmlContent: currentHtml,
      cssContent: currentCss,
      filePath: options.filePath,
      serverUrl: options.serverUrl
    });

    const elapsedInitial = Date.now() - startTime;

    // Handle missing browser or static analysis fallback
    if (initialReport.status === 'SKIPPED_MISSING_BROWSER') {
      return VisualVerificationResult.skippedMissingBrowser(this.plan.planId, initialReport.error);
    }

    if (initialReport.status === 'PARTIAL_STATIC_ANALYSIS') {
      return VisualVerificationResult.partialStatic(
        this.plan.planId,
        initialReport.defects,
        initialReport.disclaimer,
        initialReport.error,
        elapsedInitial
      );
    }

    // If initial scan is completely clean
    if (initialReport.defects.length === 0) {
      return VisualVerificationResult.successClean(
        this.plan.planId,
        initialReport.viewportsEvaluated,
        initialReport.blockedRequests,
        elapsedInitial
      );
    }

    // --- Step 2: Bounded Healing Loop (Max 2 Iterations) ---
    let currentDefects = initialReport.defects;
    let iteration = 0;

    while (iteration < maxIterations && currentDefects.length > 0) {
      iteration++;

      // Synthesize safe patches
      const patchSynthesis = this.healingEngine.synthesizePatches(currentDefects, {
        targetFile: options.targetFile || 'frontend/src/index.css'
      });

      if (patchSynthesis.conflict) {
        return VisualVerificationResult.conflictDetected(this.plan.planId, patchSynthesis.conflict);
      }

      if (patchSynthesis.error) {
        // Safety violation or patch churn -> stop immediately
        return VisualVerificationResult.unresolvedDefects(
          this.plan.planId,
          currentDefects,
          allAppliedPatches,
          iteration,
          patchSynthesis.error,
          Date.now() - startTime
        );
      }

      if (!patchSynthesis.patches || patchSynthesis.patches.length === 0) {
        // No safe patches could be generated
        return VisualVerificationResult.unresolvedDefects(
          this.plan.planId,
          currentDefects,
          allAppliedPatches,
          iteration,
          'No deterministic non-destructive patch could be synthesized for detected defects',
          Date.now() - startTime
        );
      }

      // Apply patches in-memory
      currentCss = this.healingEngine.applyPatchesToCss(currentCss, patchSynthesis.patches);
      currentHtml = this.healingEngine.applyPatchesToHtml(currentHtml, patchSynthesis.patches);
      allAppliedPatches.push(...patchSynthesis.patches);

      // Re-inspect with patches applied
      const recheckReport = await this.inspector.inspect({
        htmlContent: currentHtml,
        cssContent: currentCss,
        filePath: options.filePath,
        serverUrl: options.serverUrl
      });

      if (recheckReport.defects.length === 0) {
        // Successfully healed and verified
        return VisualVerificationResult.successHealed(
          this.plan.planId,
          recheckReport.viewportsEvaluated,
          initialReport.defects,
          allAppliedPatches,
          iteration,
          recheckReport.blockedRequests,
          Date.now() - startTime
        );
      }

      // Check if new defects represent regression or lack of progress
      if (recheckReport.defects.length >= currentDefects.length && iteration >= maxIterations) {
        // Regression or stagnant -> abort loop
        return VisualVerificationResult.unresolvedDefects(
          this.plan.planId,
          recheckReport.defects,
          allAppliedPatches,
          iteration,
          `Healing loop exhausted max iterations (${maxIterations}) with unresolved defects`,
          Date.now() - startTime
        );
      }

      currentDefects = recheckReport.defects;
    }

    return VisualVerificationResult.unresolvedDefects(
      this.plan.planId,
      currentDefects,
      allAppliedPatches,
      iteration,
      'Maximum healing iterations reached with remaining defects',
      Date.now() - startTime
    );
  }
}

module.exports = {
  VisualVerificationOrchestrator,
  VisualGeometryInspector,
  VisualHealingEngine,
  VisualVerificationPlan,
  VisualVerificationResult
};
