'use strict';

const crypto = require('crypto');

const DELIVERY_STATUS = Object.freeze({
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  BLOCKED_BY_POLICY: 'BLOCKED_BY_POLICY',
  FAILED_ROLLED_BACK: 'FAILED_ROLLED_BACK',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  UNSUPPORTED: 'UNSUPPORTED',
  REQUIRES_CONFIGURATION: 'REQUIRES_CONFIGURATION'
});

class FullStackDeliveryResult {
  static create(options = {}) {
    const success = Boolean(options.success);
    const status = options.status || (success ? DELIVERY_STATUS.COMPLETED : DELIVERY_STATUS.FAILED_ROLLED_BACK);
    const auditId = options.auditId || `audit_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    return Object.freeze({
      success,
      status,
      requestId: options.requestId || null,
      planId: options.planId || null,
      capabilityId: 'coding.full_stack_delivery',
      workspaceId: options.workspaceId || null,
      projectId: options.projectId || null,
      stageResults: Array.isArray(options.stageResults) ? options.stageResults : [],
      stages: Array.isArray(options.stageResults) ? options.stageResults : (options.stages || []),
      generatedFiles: Array.isArray(options.generatedFiles) ? options.generatedFiles : [],
      files: Array.isArray(options.generatedFiles) ? options.generatedFiles : (options.files || []),
      changedFiles: Array.isArray(options.changedFiles) ? options.changedFiles : [],
      verification: options.verification || {
        staticChecks: false,
        tests: false,
        build: false,
        preview: false,
        visual: false
      },
      preview: options.preview || {
        url: null,
        port: null,
        status: 'OFFLINE'
      },
      tests: options.tests || {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      },
      build: options.build || {
        success: false,
        outputDir: null,
        errors: []
      },
      visualVerification: options.visualVerification || {
        checked: false,
        passed: false,
        consoleErrors: [],
        issuesFound: [],
        repairsApplied: []
      },
      export: options.export || {
        zipUrl: null,
        ready: false
      },
      git: options.git || {
        committed: false,
        commitHash: null,
        message: null
      },
      warnings: Array.isArray(options.warnings) ? options.warnings : [],
      unsupportedItems: Array.isArray(options.unsupportedItems) ? options.unsupportedItems : [],
      missingConfiguration: Array.isArray(options.missingConfiguration) ? options.missingConfiguration : [],
      rollback: options.rollback || {
        triggered: false,
        success: false,
        snapshotsRestored: 0,
        error: null
      },
      auditId,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  DELIVERY_STATUS,
  FullStackDeliveryResult
};
