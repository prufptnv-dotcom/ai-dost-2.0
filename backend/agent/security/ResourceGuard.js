'use strict';

const DEFAULTS = Object.freeze({
  maxInputBytes: 256 * 1024,
  maxOutputBytes: 512 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
  maxChangedBytes: 10 * 1024 * 1024,
  maxSteps: 50,
  maxRepairs: 5,
  timeoutMs: 5 * 60 * 1000
});

function byteLength(value) {
  return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value ?? ''), 'utf8');
}

function assertBytes(value, limit, code, label) {
  const actual = byteLength(value);
  if (actual > limit) {
    const error = new Error(`${label} exceeds configured limit (${actual} > ${limit} bytes)`);
    error.code = code;
    error.limit = limit;
    error.actual = actual;
    throw error;
  }
  return actual;
}

function createBudget(overrides = {}) {
  const limits = { ...DEFAULTS, ...overrides };
  const startedAt = Date.now();
  let steps = 0;
  let repairs = 0;
  let changedBytes = 0;
  return {
    limits,
    startedAt,
    assertActive() {
      if (Date.now() - startedAt > limits.timeoutMs) {
        const error = new Error('Execution time budget exceeded');
        error.code = 'EXECUTION_TIMEOUT';
        throw error;
      }
    },
    consumeStep() {
      this.assertActive();
      steps += 1;
      if (steps > limits.maxSteps) {
        const error = new Error(`Execution step budget exceeded (${limits.maxSteps})`);
        error.code = 'MAX_STEPS_EXCEEDED';
        throw error;
      }
      return steps;
    },
    consumeRepair() {
      this.assertActive();
      repairs += 1;
      if (repairs > limits.maxRepairs) {
        const error = new Error(`Repair budget exceeded (${limits.maxRepairs})`);
        error.code = 'MAX_REPAIRS_EXCEEDED';
        throw error;
      }
      return repairs;
    },
    consumeChangedBytes(value) {
      changedBytes += byteLength(value);
      if (changedBytes > limits.maxChangedBytes) {
        const error = new Error(`Changed-data budget exceeded (${limits.maxChangedBytes} bytes)`);
        error.code = 'MAX_CHANGED_BYTES_EXCEEDED';
        throw error;
      }
      return changedBytes;
    },
    snapshot() {
      return { steps, repairs, changedBytes, elapsedMs: Date.now() - startedAt, limits: { ...limits } };
    }
  };
}

module.exports = { DEFAULTS, byteLength, assertBytes, createBudget };
