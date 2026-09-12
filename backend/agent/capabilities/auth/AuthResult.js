'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: AuthResult
 * 
 * Standardized, immutable result envelope for the Authentication capability.
 */

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

const AUTH_STATUS = Object.freeze({
  SYNTHESIS_COMPLETE: 'SYNTHESIS_COMPLETE',
  IMPLEMENTED_NOT_FULLY_VERIFIED: 'IMPLEMENTED_NOT_FULLY_VERIFIED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  CONFLICT_DETECTED: 'CONFLICT_DETECTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FAILED_ROLLED_BACK: 'FAILED_ROLLED_BACK'
});

class AuthResult {
  constructor(options = {}) {
    this.success = Boolean(options.success);
    this.status = options.status || (this.success ? AUTH_STATUS.SYNTHESIS_COMPLETE : AUTH_STATUS.FAILED_ROLLED_BACK);
    this.executionId = options.executionId || null;
    this.durationMs = typeof options.durationMs === 'number' ? options.durationMs : 0;
    this.filesGenerated = Array.isArray(options.filesGenerated) ? Object.freeze([...options.filesGenerated]) : Object.freeze([]);
    this.checksums = options.checksums ? Object.freeze({ ...options.checksums }) : Object.freeze({});
    this.roles = Array.isArray(options.roles) ? Object.freeze([...options.roles]) : Object.freeze([]);
    this.errors = Array.isArray(options.errors) ? Object.freeze([...options.errors]) : Object.freeze([]);
    this.warnings = Array.isArray(options.warnings) ? Object.freeze([...options.warnings]) : Object.freeze([]);
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : Object.freeze({});

    Object.freeze(this);
  }

  static success(data = {}) {
    return new AuthResult({
      ...data,
      success: true,
      status: data.status || AUTH_STATUS.SYNTHESIS_COMPLETE
    });
  }

  static failure(errorMsg, data = {}) {
    const errors = Array.isArray(data.errors) ? [...data.errors] : [];
    if (errorMsg && !errors.includes(errorMsg)) {
      errors.unshift(errorMsg);
    }
    return new AuthResult({
      ...data,
      success: false,
      status: data.status || AUTH_STATUS.FAILED_ROLLED_BACK,
      errors
    });
  }

  static conflict(conflicts, data = {}) {
    return new AuthResult({
      ...data,
      success: false,
      status: AUTH_STATUS.CONFLICT_DETECTED,
      errors: conflicts.map(c => `Conflict at ${c.path}: ${c.reason}`)
    });
  }
}

module.exports = {
  AuthResult,
  AUTH_STATUS
};
