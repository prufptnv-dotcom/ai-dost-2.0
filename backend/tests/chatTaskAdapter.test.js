'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ChatTaskAdapter = require('../agent/runtime/ChatTaskAdapter');

function makeTool(name) {
  return {
    name,
    description: name,
    inputSchema: {},
    validateInput(input) {
      assert.equal(typeof input, 'object');
    },
    async execute() {
      return { ok: true };
    },
  };
}

test('adapts a universal chat task into canonical agent plan shape', () => {
  const registry = new Map([['create_website', makeTool('create_website')]]);
  const toolRegistry = { get: (name) => registry.get(name) || null };
  const adapter = new ChatTaskAdapter({ toolRegistry });

  const plan = adapter.toAgentPlan({
    intent: { originalMessage: 'Build a website', action: 'create', target: 'website' },
    steps: [
      { id: 'understand', kind: 'reason', action: 'understand-intent' },
      { id: 'tool', kind: 'tool', action: 'create', target: 'website' },
      { id: 'verify', kind: 'verify', action: 'verify-result' },
    ],
  });

  assert.equal(plan.version, 1);
  assert.equal(plan.source, 'universal-chat');
  assert.equal(plan.goal, 'Build a website');
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].tool, 'create_website');
});

test('rejects an unavailable tool during agent-plan validation', () => {
  const adapter = new ChatTaskAdapter({ toolRegistry: { get: () => null } });
  const plan = adapter.toAgentPlan({
    intent: { originalMessage: 'Run something', action: 'run', target: 'terminal' },
    steps: [{ id: 'tool', kind: 'tool', action: 'run', target: 'terminal' }],
  });

  assert.throws(() => adapter.validateAgentPlan(plan), /unavailable tool/);
});

test('delegates final result validation to the canonical validator', () => {
  let called = false;
  const adapter = new ChatTaskAdapter({
    toolRegistry: { get: () => null },
    resultValidator: {
      validate(value) {
        called = true;
        return { ...value, checked: true };
      },
    },
  });

  const result = adapter.validateResult({ status: 'COMPLETED' });
  assert.equal(called, true);
  assert.equal(result.checked, true);
});
