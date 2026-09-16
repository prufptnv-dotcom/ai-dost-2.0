'use strict';

const assert = require('assert');
const { assertBytes, createBudget } = require('./ResourceGuard');

describe('ResourceGuard', () => {
  it('rejects oversized values', () => {
    assert.throws(
      () => assertBytes('12345', 4, 'INPUT_TOO_LARGE', 'Input'),
      error => error.code === 'INPUT_TOO_LARGE'
    );
  });

  it('enforces step and repair budgets', () => {
    const budget = createBudget({ maxSteps: 2, maxRepairs: 1, timeoutMs: 10000 });
    budget.consumeStep();
    budget.consumeStep();
    assert.throws(() => budget.consumeStep(), error => error.code === 'MAX_STEPS_EXCEEDED');
    budget.consumeRepair();
    assert.throws(() => budget.consumeRepair(), error => error.code === 'MAX_REPAIRS_EXCEEDED');
  });

  it('enforces changed-byte budget and exposes a snapshot', () => {
    const budget = createBudget({ maxChangedBytes: 4, timeoutMs: 10000 });
    budget.consumeChangedBytes('ab');
    assert.throws(() => budget.consumeChangedBytes('cde'), error => error.code === 'MAX_CHANGED_BYTES_EXCEEDED');
    const snapshot = budget.snapshot();
    assert.strictEqual(snapshot.changedBytes, 5);
  });
});
