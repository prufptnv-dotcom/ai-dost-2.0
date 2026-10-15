'use strict';

/**
 * AI-Dost 2.0 — Phase 4F: FactoryResult
 * 
 * Standardized, immutable result envelope for the Software Factory capability.
 */

const FACTORY_STATUS = Object.freeze({
  VERIFIED_COMPLETE: 'VERIFIED_COMPLETE',
  IMPLEMENTED_NOT_FULLY_VERIFIED: 'IMPLEMENTED_NOT_FULLY_VERIFIED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  UNSUPPORTED_INPUT: 'UNSUPPORTED_INPUT',
  UNSUPPORTED_FRAMEWORK: 'UNSUPPORTED_FRAMEWORK',
  GATEKEEPER_BLOCKED: 'GATEKEEPER_BLOCKED',
  FAILED_ROLLED_BACK: 'FAILED_ROLLED_BACK'
});

class FactoryResult {
  constructor(options = {}) {
    this.success = Boolean(options.success);
    this.status = options.status || (this.success ? FACTORY_STATUS.IMPLEMENTED_NOT_FULLY_VERIFIED : FACTORY_STATUS.FAILED_ROLLED_BACK);
    this.executionId = options.executionId || null;
    this.transactionId = options.transactionId || null;
    this.durationMs = typeof options.durationMs === 'number' ? options.durationMs : 0;
    
    this.manifest = Object.freeze({
      filesGenerated: Array.isArray(options.filesGenerated) ? Object.freeze([...options.filesGenerated]) : Object.freeze([]),
      checksums: options.checksums ? Object.freeze({ ...options.checksums }) : Object.freeze({}),
      zipPath: options.zipPath || null,
      zipSha256: options.zipSha256 || null,
      totalBytes: typeof options.totalBytes === 'number' ? options.totalBytes : 0
    });

    this.verification = Object.freeze({
      staticAnalysis: Boolean(options.verification?.staticAnalysis),
      databaseMigration: options.verification?.databaseMigration || 'PENDING',
      httpRoundtrip: options.verification?.httpRoundtrip || 'PENDING',
      clientRoundtrip: options.verification?.clientRoundtrip || 'PENDING',
      testsExecution: options.verification?.testsExecution || 'PENDING',
      frontendBuild: options.verification?.frontendBuild || 'SKIPPED_MISSING_DEPS',
      ciYamlSemantic: options.verification?.ciYamlSemantic || 'PENDING',
      auth: options.verification?.auth || 'SKIPPED_CONFIG_DISABLED',
      visualVerification: options.verification?.visualVerification || 'SKIPPED_CONFIG_DISABLED',
      deployment: options.verification?.deployment || 'SKIPPED_CONFIG_DISABLED'
    });

    this.deployment = options.deployment ? Object.freeze({ ...options.deployment }) : null;
    this.auth = options.auth ? Object.freeze({ ...options.auth }) : null;

    this.approval = options.approval ? Object.freeze({ ...options.approval }) : null;
    this.errors = Array.isArray(options.errors) ? Object.freeze([...options.errors]) : Object.freeze([]);
    this.warnings = Array.isArray(options.warnings) ? Object.freeze([...options.warnings]) : Object.freeze([]);
    this.diffs = Array.isArray(options.diffs) ? Object.freeze([...options.diffs]) : Object.freeze([]);
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : Object.freeze({});

    Object.freeze(this);
  }

  static success(data = {}) {
    return new FactoryResult({
      ...data,
      success: true,
      status: data.status || FACTORY_STATUS.IMPLEMENTED_NOT_FULLY_VERIFIED
    });
  }

  static failure(errorMsg, data = {}) {
    const errors = Array.isArray(data.errors) ? [...data.errors] : [];
    if (errorMsg && !errors.includes(errorMsg)) {
      errors.unshift(errorMsg);
    }
    return new FactoryResult({
      ...data,
      success: false,
      status: data.status || FACTORY_STATUS.FAILED_ROLLED_BACK,
      errors
    });
  }

  static approvalRequired(data = {}) {
    return new FactoryResult({
      ...data,
      success: false,
      status: FACTORY_STATUS.APPROVAL_REQUIRED
    });
  }

  static conflict(conflicts, data = {}) {
    return new FactoryResult({
      ...data,
      success: false,
      status: FACTORY_STATUS.CONFLICT_DETECTED,
      errors: conflicts.map(c => `Conflict at ${c.path}: ${c.reason}`),
      diffs: data.diffs || []
    });
  }

  static unsupported(reason, data = {}) {
    return new FactoryResult({
      ...data,
      success: false,
      status: data.status || FACTORY_STATUS.UNSUPPORTED_INPUT,
      errors: [reason]
    });
  }
}

module.exports = {
  FactoryResult,
  FACTORY_STATUS
};
