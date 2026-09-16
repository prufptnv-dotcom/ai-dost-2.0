'use strict';

const assert = require('assert');
const { createProductionRuntime, stableCapabilities, createScope } = require('./ProductionHardeningRuntime');

function makeGatekeeper() {
  const calls = [];
  return {
    calls,
    evaluate(capabilities) {
      calls.push({ type: 'evaluate', capabilities });
      return { decision: 'REQUIRE_EXPLICIT_APPROVAL', capabilities };
    },
    validateApproval(args) {
      calls.push({ type: 'validate', args });
      return { valid: args.token === 'valid-token' };
    }
  };
}

describe('ProductionHardeningRuntime', () => {
  it('normalizes capability scope deterministically', () => {
    assert.deepStrictEqual(stableCapabilities(['b', 'a', 'b', null]), ['a', 'b']);
    const scope = createScope({ request_id: 'req-1', user_id: 'user-1', capabilities: ['z', 'a'] });
    assert.strictEqual(scope.requestId, 'req-1');
    assert.deepStrictEqual(scope.capabilities, ['a', 'z']);
  });

  it('fails closed when approval is missing', async () => {
    const gatekeeper = makeGatekeeper();
    const runtime = createProductionRuntime({ gatekeeper, limits: { timeoutMs: 10000 } });
    await assert.rejects(
      runtime.execute('terminal', { command: 'echo safe' }, { requestId: 'r1', userId: 'u1', projectId: 'p1' }, async () => 'ok'),
      error => error.code === 'APPROVAL_REQUIRED'
    );
  });

  it('validates approval before executing and emits bounded audit events', async () => {
    const gatekeeper = makeGatekeeper();
    const runtime = createProductionRuntime({ gatekeeper, limits: { timeoutMs: 10000 } });
    const output = await runtime.execute(
      'terminal',
      { command: 'echo safe' },
      { requestId: 'r2', userId: 'u1', projectId: 'p1', approvalToken: 'valid-token' },
      async context => ({ ok: true, requestId: context.requestId })
    );
    assert.deepStrictEqual(output, { ok: true, requestId: 'r2' });
    assert.strictEqual(gatekeeper.calls.filter(call => call.type === 'validate').length, 1);
    assert.ok(runtime.guard.audit.list({ requestId: 'r2' }).some(event => event.type === 'execution.completed'));
  });

  it('does not run executor after capability block', async () => {
    const gatekeeper = { evaluate: () => ({ decision: 'BLOCK', capabilities: [] }) };
    const runtime = createProductionRuntime({ gatekeeper });
    let executed = false;
    await assert.rejects(
      runtime.execute('terminal', {}, { requestId: 'r3' }, async () => { executed = true; }),
      error => error.code === 'CAPABILITY_BLOCKED'
    );
    assert.strictEqual(executed, false);
  });
});
