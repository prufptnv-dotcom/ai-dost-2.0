const test = require('node:test');
const assert = require('node:assert');
const CapabilityPolicy = require('../agent/policy/CapabilityPolicy');

test('Phase 2G.3 - Agent Capability Policy & Role Boundaries', async (t) => {
  await t.test('1. Supervisor Role Capabilities', () => {
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'orchestration.manage'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'filesystem.write'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'terminal.execute'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'code.edit'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'filesystem.read'), false);

    assert.doesNotThrow(() => CapabilityPolicy.assertAllowed('SUPERVISOR', 'orchestration.manage'));
    assert.throws(
      () => CapabilityPolicy.assertAllowed('SUPERVISOR', 'filesystem.write'),
      /denied for role 'SUPERVISOR'/
    );
  });

  await t.test('2. Researcher Role Capabilities', () => {
    assert.strictEqual(CapabilityPolicy.isAllowed('RESEARCHER', 'filesystem.read'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('RESEARCHER', 'codebase.search'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('RESEARCHER', 'web.search'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('RESEARCHER', 'context.retrieve'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('RESEARCHER', 'filesystem.write'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('RESEARCHER', 'terminal.execute'), false);
  });

  await t.test('3. Coder Role Capabilities', () => {
    assert.strictEqual(CapabilityPolicy.isAllowed('CODER', 'filesystem.read'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('CODER', 'filesystem.write'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('CODER', 'code.edit'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('CODER', 'terminal.execute'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('CODER', 'orchestration.manage'), false);
  });

  await t.test('4. Verifier Role Capabilities', () => {
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'filesystem.read'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'terminal.execute'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'test.run'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'verification.inspect'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'filesystem.write'), false);
  });

  await t.test('5. Target Worker Role Validation', () => {
    assert.strictEqual(CapabilityPolicy.validateWorkerRole('RESEARCHER'), true);
    assert.strictEqual(CapabilityPolicy.validateWorkerRole('CODER'), true);
    assert.strictEqual(CapabilityPolicy.validateWorkerRole('VERIFIER'), true);

    // Rejected roles
    assert.strictEqual(CapabilityPolicy.validateWorkerRole('SUPERVISOR'), false);
    assert.strictEqual(CapabilityPolicy.validateWorkerRole('LEGACY_AGENT'), false);
    assert.strictEqual(CapabilityPolicy.validateWorkerRole('ADMIN'), false);
    assert.strictEqual(CapabilityPolicy.validateWorkerRole(''), false);
    assert.strictEqual(CapabilityPolicy.validateWorkerRole(null), false);
  });
});
