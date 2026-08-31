const CHECK_TYPES = [
  'UNIT_TEST',
  'INTEGRATION_TEST',
  'BUILD',
  'LINT',
  'FILE_INTEGRITY',
  'VISUAL',
  'SEMANTIC',
  'SECURITY'
];

const VERIFICATION_STATUSES = ['PASS', 'FAIL', 'BLOCKED'];

const BLOCKED_SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /BEGIN\s+(RSA|OPENSSH|DSA|EC)?\s*PRIVATE\s+KEY/,
  /["']?(?:password|secret|api_key|apikey|token)["']?\s*[:=]\s*["'][^"']{6,}["']/i
];

const STACK_TRACE_PATTERN = /at\s+[\w\$.<>]+\s+\([^)]+:\d+:\d+\)|at\s+[^:]+:\d+:\d+/;

class VerificationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationValidationError';
  }
}

class VerificationContract {
  static get CHECK_TYPES() {
    return [...CHECK_TYPES];
  }

  static get VERIFICATION_STATUSES() {
    return [...VERIFICATION_STATUSES];
  }

  /**
   * Validate and sanitize a verification result object against the canonical contract.
   * @param {Object} data
   * @returns {Object} Validated verification result
   */
  static validate(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new VerificationValidationError('Verification result must be a non-null object');
    }

    // 1. Validate status
    if (!data.status || !VERIFICATION_STATUSES.includes(data.status)) {
      throw new VerificationValidationError(`Invalid verification status '${data.status}'. Allowed: ${VERIFICATION_STATUSES.join(', ')}`);
    }

    // 2. Validate summary
    if (typeof data.summary !== 'string') {
      throw new VerificationValidationError('Verification summary must be a string');
    }
    const summary = data.summary.trim();
    if (summary.length === 0) {
      throw new VerificationValidationError('Verification summary cannot be empty');
    }
    if (summary.length > 512) {
      throw new VerificationValidationError(`Verification summary exceeds 512 characters (length: ${summary.length})`);
    }

    // 3. Validate confidence (0.0 to 1.0)
    let confidence = typeof data.confidence === 'number' ? data.confidence : 1.0;
    if (isNaN(confidence) || confidence < 0.0 || confidence > 1.0) {
      throw new VerificationValidationError(`Confidence must be a number between 0.0 and 1.0 (got: ${data.confidence})`);
    }
    confidence = Math.round(confidence * 100) / 100;

    // 4. Validate evidence_refs
    const evidenceRefs = Array.isArray(data.evidence_refs) ? data.evidence_refs : [];
    if (evidenceRefs.length > 10) {
      throw new VerificationValidationError(`evidence_refs exceeds maximum limit of 10 items (got ${evidenceRefs.length})`);
    }
    for (const ref of evidenceRefs) {
      if (typeof ref !== 'string' || ref.trim().length === 0 || ref.length > 128) {
        throw new VerificationValidationError('Each evidence_ref must be a non-empty string <= 128 chars');
      }
    }

    // 5. Validate artifact_refs
    const artifactRefs = Array.isArray(data.artifact_refs) ? data.artifact_refs : [];
    if (artifactRefs.length > 10) {
      throw new VerificationValidationError(`artifact_refs exceeds maximum limit of 10 items (got ${artifactRefs.length})`);
    }
    for (const ref of artifactRefs) {
      if (typeof ref !== 'string' || ref.trim().length === 0 || ref.length > 128) {
        throw new VerificationValidationError('Each artifact_ref must be a non-empty string <= 128 chars');
      }
    }

    // 6. Validate failed_checks
    const failedChecks = Array.isArray(data.failed_checks) ? data.failed_checks : [];
    if (failedChecks.length > 10) {
      throw new VerificationValidationError(`failed_checks exceeds maximum limit of 10 items (got ${failedChecks.length})`);
    }
    const cleanFailedChecks = [];
    for (const check of failedChecks) {
      if (!check || typeof check !== 'object' || Array.isArray(check)) {
        throw new VerificationValidationError('Each item in failed_checks must be an object');
      }
      const checkType = typeof check.check_type === 'string' ? check.check_type.toUpperCase().trim() : 'UNIT_TEST';
      if (!CHECK_TYPES.includes(checkType)) {
        throw new VerificationValidationError(`Invalid check_type '${checkType}' in failed_checks. Allowed: ${CHECK_TYPES.join(', ')}`);
      }
      const message = typeof check.message === 'string' ? check.message.trim() : 'Check failed';
      const details = typeof check.details === 'string' ? check.details.trim() : '';

      if (message.length > 256) {
        throw new VerificationValidationError('Failed check message exceeds 256 characters');
      }
      if (details.length > 512) {
        throw new VerificationValidationError('Failed check details exceeds 512 characters');
      }

      if (STACK_TRACE_PATTERN.test(message) || STACK_TRACE_PATTERN.test(details)) {
        throw new VerificationValidationError('Failed check contains forbidden stack trace');
      }

      cleanFailedChecks.push({ check_type: checkType, message, details });
    }

    // 7. Security: Block sensitive secrets in payload
    const serialized = JSON.stringify({ summary, cleanFailedChecks });
    for (const pattern of BLOCKED_SECRET_PATTERNS) {
      if (pattern.test(serialized)) {
        throw new VerificationValidationError('Verification result contains detected sensitive secret pattern');
      }
    }

    if (STACK_TRACE_PATTERN.test(summary)) {
      throw new VerificationValidationError('Verification summary contains forbidden stack trace');
    }

    // 8. Deterministic contract constraint: If status is PASS, failed_checks must be empty
    if (data.status === 'PASS' && cleanFailedChecks.length > 0) {
      throw new VerificationValidationError('Verification status cannot be PASS when failed_checks is non-empty');
    }

    return {
      status: data.status,
      summary,
      evidence_refs: evidenceRefs,
      artifact_refs: artifactRefs,
      failed_checks: cleanFailedChecks,
      confidence
    };
  }

  /**
   * Helper to format a canonical PASS verification result.
   */
  static formatPassResult(summary, evidenceRefs = [], artifactRefs = [], confidence = 1.0) {
    return VerificationContract.validate({
      status: 'PASS',
      summary: summary || 'All verification checks passed successfully',
      evidence_refs: evidenceRefs,
      artifact_refs: artifactRefs,
      failed_checks: [],
      confidence
    });
  }

  /**
   * Helper to format a canonical FAIL verification result.
   */
  static formatFailResult(summary, failedChecks = [], evidenceRefs = [], artifactRefs = [], confidence = 0.9) {
    return VerificationContract.validate({
      status: 'FAIL',
      summary: summary || 'Verification checks failed',
      evidence_refs: evidenceRefs,
      artifact_refs: artifactRefs,
      failed_checks: failedChecks,
      confidence
    });
  }

  /**
   * Helper to format a canonical BLOCKED verification result.
   */
  static formatBlockedResult(summary, reason = 'Verification blocked', details = '') {
    return VerificationContract.validate({
      status: 'BLOCKED',
      summary: summary || 'Verification could not proceed',
      evidence_refs: [],
      artifact_refs: [],
      failed_checks: [{ check_type: 'SECURITY', message: reason, details }],
      confidence: 0.0
    });
  }
}

module.exports = {
  VerificationContract,
  VerificationValidationError,
  CHECK_TYPES,
  VERIFICATION_STATUSES
};
