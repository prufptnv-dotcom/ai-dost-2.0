// ── Shared HTTP error utilities ─────────────────────────────────────────
// Usage:
//   throw new AppError('Message', 400, 'BAD_INPUT');
//   throw AppError.notFound('Project not found');
//   next(err) in routes -> server.js global handler converts to JSON.

class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg, code = 'BAD_REQUEST') {
    return new AppError(msg, 400, code);
  }
  static unauthorized(msg = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(msg, 401, code);
  }
  static forbidden(msg = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(msg, 403, code);
  }
  static notFound(msg = 'Not found', code = 'NOT_FOUND') {
    return new AppError(msg, 404, code);
  }
  static conflict(msg, code = 'CONFLICT') {
    return new AppError(msg, 409, code);
  }
  static tooMany(msg = 'Rate limit exceeded', code = 'RATE_LIMITED') {
    return new AppError(msg, 429, code);
  }
  static serviceUnavailable(msg = 'Service unavailable', code = 'SERVICE_UNAVAILABLE') {
    return new AppError(msg, 503, code);
  }
  static internal(msg = 'Internal server error', details = null) {
    return new AppError(msg, 500, 'INTERNAL_ERROR', details);
  }
}

// Wrap an async route handler so thrown/rejected errors flow to next(err).
//   router.get('/x', asyncHandler(async (req, res) => { ... }));
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Run an async task with a timeout. Rejects with TimeoutError on expiry.
class TimeoutError extends Error {
  constructor(ms) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
  }
}

async function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Normalize unknown errors into AppError for the global handler.
function toAppError(err) {
  if (err instanceof AppError) return err;
  if (err instanceof TimeoutError) return new AppError(err.message, 504, 'TIMEOUT');
  if (err && err.name === 'AbortError') return new AppError('Request aborted', 408, 'REQUEST_ABORTED');
  const status = err && typeof err.status === 'number' ? err.status : 500;
  const code = err && err.code ? String(err.code) : 'INTERNAL_ERROR';
  return new AppError(err?.message || 'Internal server error', status, code);
}

module.exports = { AppError, asyncHandler, withTimeout, TimeoutError, toAppError };