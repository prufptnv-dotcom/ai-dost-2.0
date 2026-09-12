'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: CI/CD Result Envelope
 * 
 * Standardized immutable execution result envelope.
 */

const { deepFreeze } = require('./CiCdPlan');

const CICD_STATUS = Object.freeze({
  GENERATED: 'GENERATED',
  NO_CHANGE: 'NO_CHANGE',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  DIFF_REQUIRED: 'DIFF_REQUIRED',
  UNSUPPORTED: 'UNSUPPORTED',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  FAILED_ROLLED_BACK: 'FAILED_ROLLED_BACK',
  CANCELLED: 'CANCELLED'
});

class CiCdResult {
  constructor(data = {}) {
    this.ok = data.ok !== false;
    this.status = data.status || (this.ok ? CICD_STATUS.GENERATED : CICD_STATUS.FAILED_ROLLED_BACK);
    this.capability_id = 'devops.ci_cd_pipeline';
    this.planId = data.planId || null;
    this.platform = data.platform || 'github_actions';
    
    // Generated workflow files
    this.files = Array.isArray(data.files)
      ? data.files.map(f => Object.freeze(Object.assign({}, f)))
      : [];

    this.filesGenerated = this.files.map(f => f.path);

    this.checksums = Object.freeze(
      this.files.reduce((acc, f) => {
        if (f.path && f.checksum) acc[f.path] = f.checksum;
        return acc;
      }, {})
    );

    // Diff representations if changes detected against existing files
    this.diffs = Array.isArray(data.diffs) ? data.diffs.slice() : [];
    this.diff = this.diffs.length > 0 ? this.diffs[0].diff : null;

    // Execution metrics
    this.metrics = Object.freeze(Object.assign({
      jobsCount: 0,
      stepsCount: 0,
      nodeVersionsCount: 0,
      actionsCount: 0,
      durationMs: 0
    }, data.metrics || {}));

    this.warnings = Array.isArray(data.warnings) ? data.warnings.slice() : [];
    this.errors = Array.isArray(data.errors) ? data.errors.slice() : [];

    deepFreeze(this);
  }

  toJSON() {
    return {
      ok: this.ok,
      status: this.status,
      capability_id: this.capability_id,
      planId: this.planId,
      platform: this.platform,
      files: this.files,
      diffs: this.diffs,
      metrics: this.metrics,
      warnings: this.warnings,
      errors: this.errors
    };
  }
}

CiCdResult.STATUS = CICD_STATUS;

module.exports = {
  CiCdResult,
  CICD_STATUS
};
