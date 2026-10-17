const ALLOWED_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'PARTIAL', 'UNVERIFIED', 'NOT_EVALUATED'];
const ALLOWED_VERIFICATION_STATUSES = ['PASSED', 'FAILED', 'SKIPPED', 'PARTIAL', 'UNVERIFIED', 'NOT_EVALUATED'];

const BLOCKED_SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /BEGIN\s+(?:(?:RSA|OPENSSH|DSA|EC)\s+)?PRIVATE\s+KEY/,
  /["']?(?:password|secret|api_key|apikey|token)["']?\s*[:=]\s*["'][^"']{6,}["']/i
];

const STACK_TRACE_PATTERN = /at\s+[\w$.<>]+\s*\([^)\n]+:\d+:\d+\)|at\s+[^:\n]+:\d+:\d+/;

class ResultValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResultValidationError';
  }
}

function validateStatusAndSummary(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new ResultValidationError('Result must be a non-null object');
  }

  if (!result.status || !ALLOWED_STATUSES.includes(result.status)) {
    throw new ResultValidationError(`Invalid or missing status: ${result.status}. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
  }

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

  if (!result.verification_status || !ALLOWED_VERIFICATION_STATUSES.includes(result.verification_status)) {
    throw new ResultValidationError(`Invalid or missing verification_status: ${result.verification_status}. Allowed: ${ALLOWED_VERIFICATION_STATUSES.join(', ')}`);
  }

  return summary;
}

function validateRefsList(refs, refName) {
  const list = Array.isArray(refs) ? refs : [];
  if (list.length > 10) {
    throw new ResultValidationError(`${refName} exceeds maximum allowed limit of 10 items (got ${list.length})`);
  }
  for (const ref of list) {
    if (typeof ref !== 'string' || ref.trim().length === 0 || ref.length > 128) {
      throw new ResultValidationError(`Invalid ${refName.slice(0, -1)}: must be non-empty string <= 128 chars`);
    }
  }
  return list;
}

function validateErrorsList(errors) {
  const list = Array.isArray(errors) ? errors : [];
  if (list.length > 10) {
    throw new ResultValidationError(`errors array exceeds maximum allowed limit of 10 items (got ${list.length})`);
  }
  const cleanErrors = [];
  for (const err of list) {
    if (!err || typeof err !== 'object' || Array.isArray(err)) {
      throw new ResultValidationError('Each error item must be an object with code and message');
    }
    const code = typeof err.code === 'string' ? err.code.trim() : 'WORKER_ERROR';
    const message = typeof err.message === 'string' ? err.message.trim() : 'Unknown error';

    if (code.length > 64) {
      throw new ResultValidationError('Error code exceeds 64 characters');
    }
    if (message.length > 256) {
      throw new ResultValidationError(`Error message exceeds 256 characters (length: ${message.length})`);
    }

    if (STACK_TRACE_PATTERN.test(message)) {
      throw new ResultValidationError('Error message contains forbidden stack trace');
    }

    cleanErrors.push({ code, message });
  }
  return cleanErrors;
}

function assertNoSecretsOrStackTraces(summary, cleanErrors) {
  const serialized = JSON.stringify({ summary, cleanErrors });
  for (const pattern of BLOCKED_SECRET_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new ResultValidationError('Result contains detected sensitive secret or key pattern');
    }
  }

  if (STACK_TRACE_PATTERN.test(summary)) {
    throw new ResultValidationError('Result summary contains forbidden stack trace');
  }
}

class ResultValidator {
  /**
   * Validate a worker result object against the strict Phase 2G.3 contract.
   * @param {Object} result
   * @returns {Object} Clean validated result
   */
  static validate(result) {
    const summary = validateStatusAndSummary(result);
    const artifactRefs = validateRefsList(result.artifact_refs, 'artifact_refs');
    const contextRefs = validateRefsList(result.context_refs, 'context_refs');
    const cleanErrors = validateErrorsList(result.errors);

    assertNoSecretsOrStackTraces(summary, cleanErrors);

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
