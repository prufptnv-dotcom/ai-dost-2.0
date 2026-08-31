const ALLOWED_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];
const ALLOWED_VERIFICATION_STATUSES = ['PASSED', 'FAILED', 'SKIPPED'];

const BLOCKED_SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /BEGIN\s+(RSA|OPENSSH|DSA|EC)?\s*PRIVATE\s+KEY/,
  /["']?(?:password|secret|api_key|apikey|token)["']?\s*[:=]\s*["'][^"']{6,}["']/i
];

const STACK_TRACE_PATTERN = /at\s+[\w\$.<>]+\s+\([^)]+:\d+:\d+\)|at\s+[^:]+:\d+:\d+/;

class ResultValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResultValidationError';
  }
}

class ResultValidator {
  /**
   * Validate a worker result object against the strict Phase 2G.3 contract.
   * @param {Object} result
   * @returns {Object} Clean validated result
   */
  static validate(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new ResultValidationError('Result must be a non-null object');
    }

    // 1. Validate status
    if (!result.status || !ALLOWED_STATUSES.includes(result.status)) {
      throw new ResultValidationError(`Invalid or missing status: ${result.status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
    }

    // 2. Validate summary
    if (typeof result.summary !== 'string') {
      throw new ResultValidationError('Result summary must be a string');
    }
    const summary = result.summary.trim();
    if (summary.length === 0) {
      throw new ResultValidationError('Result summary cannot be empty');
    }
    if (summary.length > 512) {
      throw new ResultValidationError(`Result summary exceeds 512 characters (length: ${summary.length})`);
    }

    // 3. Validate verification_status
    if (!result.verification_status || !ALLOWED_VERIFICATION_STATUSES.includes(result.verification_status)) {
      throw new ResultValidationError(`Invalid or missing verification_status: ${result.verification_status}. Allowed: ${ALLOWED_VERIFICATION_STATUSES.join(', ')}`);
    }

    // 4. Validate artifact_refs
    const artifactRefs = Array.isArray(result.artifact_refs) ? result.artifact_refs : [];
    if (artifactRefs.length > 10) {
      throw new ResultValidationError(`artifact_refs exceeds maximum allowed limit of 10 items (got ${artifactRefs.length})`);
    }
    for (const ref of artifactRefs) {
      if (typeof ref !== 'string' || ref.trim().length === 0 || ref.length > 128) {
        throw new ResultValidationError(`Invalid artifact_ref: must be non-empty string <= 128 chars`);
      }
    }

    // 5. Validate context_refs
    const contextRefs = Array.isArray(result.context_refs) ? result.context_refs : [];
    if (contextRefs.length > 10) {
      throw new ResultValidationError(`context_refs exceeds maximum allowed limit of 10 items (got ${contextRefs.length})`);
    }
    for (const ref of contextRefs) {
      if (typeof ref !== 'string' || ref.trim().length === 0 || ref.length > 128) {
        throw new ResultValidationError(`Invalid context_ref: must be non-empty string <= 128 chars`);
      }
    }

    // 6. Validate errors array
    const errors = Array.isArray(result.errors) ? result.errors : [];
    if (errors.length > 10) {
      throw new ResultValidationError(`errors array exceeds maximum allowed limit of 10 items (got ${errors.length})`);
    }
    const cleanErrors = [];
    for (const err of errors) {
      if (!err || typeof err !== 'object' || Array.isArray(err)) {
        throw new ResultValidationError('Each error item must be an object with code and message');
      }
      const code = typeof err.code === 'string' ? err.code.trim() : 'WORKER_ERROR';
      const message = typeof err.message === 'string' ? err.message.trim() : 'Unknown error';

      if (code.length > 64) {
        throw new ResultValidationError(`Error code exceeds 64 characters`);
      }
      if (message.length > 256) {
        throw new ResultValidationError(`Error message exceeds 256 characters (length: ${message.length})`);
      }

      // Check stack traces
      if (STACK_TRACE_PATTERN.test(message)) {
        throw new ResultValidationError('Error message contains forbidden stack trace');
      }

      cleanErrors.push({ code, message });
    }

    // 7. Security: Block secrets and raw execution logs
    const serialized = JSON.stringify({ summary, cleanErrors });
    for (const pattern of BLOCKED_SECRET_PATTERNS) {
      if (pattern.test(serialized)) {
        throw new ResultValidationError('Result contains detected sensitive secret or key pattern');
      }
    }

    if (STACK_TRACE_PATTERN.test(summary)) {
      throw new ResultValidationError('Result summary contains forbidden stack trace');
    }

    return {
      status: result.status,
      summary,
      artifact_refs: artifactRefs,
      context_refs: contextRefs,
      verification_status: result.verification_status,
      errors: cleanErrors
    };
  }

  /**
   * Helper to create a canonical failure result envelope.
   */
  static formatFailureResult(summary, errors = [], options = {}) {
    const safeSummary = (summary && typeof summary === 'string') 
      ? summary.substring(0, 512).trim() 
      : 'Worker task execution failed';

    const safeErrors = Array.isArray(errors) ? errors.slice(0, 10).map(e => ({
      code: typeof e?.code === 'string' ? e.code.substring(0, 64) : 'WORKER_FAILED',
      message: typeof e?.message === 'string' ? e.message.substring(0, 256) : 'Unknown failure'
    })) : [{ code: 'WORKER_FAILED', message: String(errors).substring(0, 256) }];

    return ResultValidator.validate({
      status: options.status || 'FAILED',
      summary: safeSummary,
      artifact_refs: Array.isArray(options.artifact_refs) ? options.artifact_refs.slice(0, 10) : [],
      context_refs: Array.isArray(options.context_refs) ? options.context_refs.slice(0, 10) : [],
      verification_status: options.verification_status || 'FAILED',
      errors: safeErrors
    });
  }
}

module.exports = {
  ResultValidator,
  ResultValidationError,
  ALLOWED_STATUSES,
  ALLOWED_VERIFICATION_STATUSES
};
