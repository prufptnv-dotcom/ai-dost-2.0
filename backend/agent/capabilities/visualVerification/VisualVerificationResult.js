'use strict';

/**
 * AI-Dost 2.0 — Phase 4G: VisualVerificationResult
 * 
 * Immutable, deeply-frozen result envelope for autonomous visual verification and healing.
 */

const { deepFreeze } = require('./VisualVerificationPlan');

const VISUAL_VERIFICATION_STATUSES = Object.freeze([
  'VERIFIED_CLEAN',
  'HEALED_VERIFIED',
  'PARTIAL_STATIC_ANALYSIS',
  'SKIPPED_MISSING_BROWSER',
  'UNRESOLVED_DEFECTS',
  'CONFLICT_DETECTED',
  'DEPENDENCY_ERROR',
  'FAILED_ROLLED_BACK'
]);

class VisualVerificationResult {
  constructor(payload = {}) {
    const status = payload.status || 'UNRESOLVED_DEFECTS';
    if (!VISUAL_VERIFICATION_STATUSES.includes(status)) {
      throw new Error(`Invalid VisualVerificationResult status '${status}'. Must be one of: ${VISUAL_VERIFICATION_STATUSES.join(', ')}`);
    }

    this.planId = payload.planId || 'vplan_default';
    this.status = status;
    this.isRealBrowser = Boolean(payload.isRealBrowser);
    this.viewportsEvaluated = Array.isArray(payload.viewportsEvaluated) ? payload.viewportsEvaluated : [];
    this.iterationsRun = typeof payload.iterationsRun === 'number' ? payload.iterationsRun : 0;
    this.defectsFound = Array.isArray(payload.defectsFound) ? payload.defectsFound : [];
    this.patchesApplied = Array.isArray(payload.patchesApplied) ? payload.patchesApplied : [];
    this.blockedRequests = Array.isArray(payload.blockedRequests) ? payload.blockedRequests : [];
    this.metrics = typeof payload.metrics === 'object' && payload.metrics !== null ? { ...payload.metrics } : {};
    this.errors = Array.isArray(payload.errors) ? payload.errors : (payload.error ? [payload.error] : []);
    this.disclaimer = payload.disclaimer || null;
    this.timestamp = payload.timestamp || new Date().toISOString();
    this.durationMs = typeof payload.durationMs === 'number' ? payload.durationMs : 0;

    deepFreeze(this);
  }

  static successClean(planId, viewports, blockedRequests = [], durationMs = 0) {
    return new VisualVerificationResult({
      planId,
      status: 'VERIFIED_CLEAN',
      isRealBrowser: true,
      viewportsEvaluated: viewports,
      iterationsRun: 1,
      defectsFound: [],
      patchesApplied: [],
      blockedRequests,
      durationMs
    });
  }

  static successHealed(planId, viewports, defects, patches, iterations, blockedRequests = [], durationMs = 0) {
    return new VisualVerificationResult({
      planId,
      status: 'HEALED_VERIFIED',
      isRealBrowser: true,
      viewportsEvaluated: viewports,
      iterationsRun: iterations,
      defectsFound: defects,
      patchesApplied: patches,
      blockedRequests,
      durationMs
    });
  }

  static partialStatic(planId, defects, disclaimer, error = null, durationMs = 0) {
    return new VisualVerificationResult({
      planId,
      status: 'PARTIAL_STATIC_ANALYSIS',
      isRealBrowser: false,
      viewportsEvaluated: [],
      iterationsRun: 1,
      defectsFound: defects,
      patchesApplied: [],
      blockedRequests: [],
      disclaimer: disclaimer || 'Static analysis fallback only. Real layout geometry, occlusion, responsive viewports, and hit-testing were NOT verified.',
      error,
      durationMs
    });
  }

  static skippedMissingBrowser(planId, reason) {
    return new VisualVerificationResult({
      planId,
      status: 'SKIPPED_MISSING_BROWSER',
      isRealBrowser: false,
      error: reason || 'Chromium browser binary or Playwright is not available',
      viewportsEvaluated: [],
      iterationsRun: 0,
      defectsFound: [],
      patchesApplied: []
    });
  }

  static conflictDetected(planId, conflict) {
    return new VisualVerificationResult({
      planId,
      status: 'CONFLICT_DETECTED',
      isRealBrowser: false,
      error: conflict.message || 'Pre-existing user-authored file conflict',
      metrics: { conflictFile: conflict.file }
    });
  }

  static unresolvedDefects(planId, defects, patches, iterations, reason, durationMs = 0) {
    return new VisualVerificationResult({
      planId,
      status: 'UNRESOLVED_DEFECTS',
      isRealBrowser: true,
      iterationsRun: iterations,
      defectsFound: defects,
      patchesApplied: patches,
      error: reason,
      durationMs
    });
  }

  static failedRolledBack(planId, error, patches = []) {
    return new VisualVerificationResult({
      planId,
      status: 'FAILED_ROLLED_BACK',
      isRealBrowser: false,
      error: typeof error === 'string' ? error : error.message,
      patchesApplied: patches
    });
  }
}

module.exports = {
  VisualVerificationResult,
  VISUAL_VERIFICATION_STATUSES
};
