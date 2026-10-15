'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProductionRuntime, stableCapabilities } = require('../agent/security/ProductionHardeningRuntime');

test('production runtime normalizes capability sets', () => {
  assert.deepEqual(stableCapabilities(['z', 'a', 'z']), ['a', 'z']);
});

test('production runtime requires approval before elevated execution', async () => {
  const gatekeeper = {
    evaluate: () => ({ decision: 'REQUIRE_EXPLICIT_APPROVAL', capabilities: [] }),
    validateApproval: ({ token }) => ({ valid: token === 'ok' })
  };
  const runtime = createProductionRuntime({ gatekeeper, limits: { timeoutMs: 10000 } });
  await assert.rejects(
    runtime.execute('terminal', { command: 'echo test' }, { requestId: 'req-test' }, async () => 'executed'),
    error => error.code === 'APPROVAL_REQUIRED'
  );
});

test('production runtime executes only after valid approval and records audit', async () => {
  const gatekeeper = {
    evaluate: () => ({ decision: 'REQUIRE_EXPLICIT_APPROVAL', capabilities: [] }),
    validateApproval: ({ token }) => ({ valid: token === 'ok' })
  };
  const runtime = createProductionRuntime({ gatekeeper, limits: { timeoutMs: 10000 } });
  const result = await runtime.execute('terminal', { command: 'echo test' }, { requestId: 'req-ok', approvalToken: 'ok' }, async context => ({ requestId: context.requestId }));
  assert.deepEqual(result, { requestId: 'req-ok' });
  assert.equal(runtime.guard.audit.list({ requestId: 'req-ok' }).at(-1).type, 'execution.completed');
});
