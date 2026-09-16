'use strict';

const assert = require('assert');
const { AuditSink, redact, createExecutionGuard } = require('./ProductionExecutionGuard');

describe('ProductionExecutionGuard', () => {
  it('redacts secret-shaped fields recursively', () => {
    const result = redact({ token: 'secret', nested: { apiKey: 'hidden', safe: 'ok' } });
    assert.strictEqual(result.token, '[REDACTED]');
    assert.strictEqual(result.nested.apiKey, '[REDACTED]');
    assert.strictEqual(result.nested.safe, 'ok');
  });

  it('enforces step, repair, input, output, and change budgets', () => {
    const guard = createExecutionGuard({ limits: { maxSteps: 1, maxRepairs: 1, maxInputBytes: 2, maxOutputBytes: 2, maxChangedBytes: 2 } });
    guard.beforeStep();
    assert.throws(() => guard.beforeStep(), error => error.code === 'MAX_STEPS_EXCEEDED');
    guard.beforeRepair();
    assert.throws(() => guard.beforeRepair(), error => error.code === 'MAX_REPAIRS_EXCEEDED');
    assert.throws(() => guard.beforeInput('123'), error => error.code === 'INPUT_TOO_LARGE');
    assert.throws(() => guard.beforeOutput('123'), error => error.code === 'OUTPUT_TOO_LARGE');
    guard.beforePersistedChange('12');
    assert.throws(() => guard.beforePersistedChange('3'), error => error.code === 'MAX_CHANGED_BYTES_EXCEEDED');
  });

  it('emits correlated, bounded audit events with retention', () => {
    const audit = new AuditSink({ maxEvents: 2, retentionMs: 100000 });
    const guard = createExecutionGuard({ audit, correlationId: 'corr-1' });
    guard.beforeStep({ requestId: 'req-1', taskId: 'task-1' });
    guard.complete({ requestId: 'req-1', taskId: 'task-1' });
    guard.fail(new Error('failure'), { requestId: 'req-1', taskId: 'task-1' });
    const events = audit.list({ correlationId: 'corr-1' });
    assert.strictEqual(events.length, 2);
    assert.ok(events.every(event => event.correlationId === 'corr-1'));
  });
});
