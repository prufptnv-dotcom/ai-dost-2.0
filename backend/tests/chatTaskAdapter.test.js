'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ChatTaskAdapter = require('../agent/runtime/ChatTaskAdapter');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');
const PlannerExecutionLoop = require('../agent/runtime/PlannerExecutionLoop');

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

test('gateway delegates validated chat tasks to the canonical execution loop', async () => {
  const calls = [];
  const gateway = new ChatTaskGateway({
    adapter: {
      toAgentPlan: (plan) => ({ goal: plan.intent.originalMessage, steps: [{ id: 's1', tool: 'create_website', description: 'create', input: {} }] }),
      validateAgentPlan: (plan) => plan,
      validateResult: (result) => ({ ...result, validated: true }),
    },
    plannerExecutionLoop: {
      async runWithPlan(projectId, userId, plan, maxRepairs, isCanceled) {
        calls.push({ projectId, userId, plan, maxRepairs, canceled: isCanceled() });
        return { runId: 'run_1', status: 'SUCCEEDED' };
      },
    },
  });

  const events = [];
  const result = await gateway.run({
    projectId: 'p1',
    userId: 'u1',
    taskPlan: { type: 'task', taskId: 't1', intent: { originalMessage: 'Build a website' } },
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.validated, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].projectId, 'p1');
  assert.equal(events[0].phase, 'planning');
  assert.equal(events.at(-1).phase, 'success');
});

test('gateway fails closed when a task has no executable steps', async () => {
  const gateway = new ChatTaskGateway({
    adapter: {
      toAgentPlan: () => ({ goal: 'x', steps: [] }),
      validateAgentPlan: (plan) => plan,
    },
    plannerExecutionLoop: { runWithPlan: async () => ({ status: 'SUCCEEDED' }) },
  });

  await assert.rejects(
    gateway.run({ projectId: 'p1', userId: 'u1', taskPlan: { type: 'task', intent: { originalMessage: 'do it' } } }),
    /no executable tool steps/
  );
});

test('gateway does not enter runtime after pre-cancellation', async () => {
  let called = false;
  const controller = new AbortController();
  controller.abort();
  const gateway = new ChatTaskGateway({
    adapter: {
      toAgentPlan: () => ({ goal: 'x', steps: [{ id: 's1', tool: 'x', input: {} }] }),
      validateAgentPlan: (plan) => plan,
    },
    plannerExecutionLoop: { runWithPlan: async () => { called = true; return { status: 'SUCCEEDED' }; } },
  });

  await assert.rejects(
    gateway.run({ projectId: 'p1', userId: 'u1', taskPlan: { type: 'task', intent: { originalMessage: 'do it' } }, signal: controller.signal }),
    /canceled before execution/
  );
  assert.equal(called, false);
});

test('PlannerExecutionLoop executes a preplanned chat task through tool and verification phases', async () => {
  const calls = [];
  const controller = {
    generateId: (prefix) => `${prefix}_1`,
    async startRun() { calls.push('start-run'); },
    async saveCheckpoint() {},
    async recordStep(_runId, type) { calls.push(`record-${type}`); return { id: `${type.toLowerCase()}_1` }; },
    async startStep() {},
    async executeTool(_stepId, toolName) { calls.push(`execute-${toolName}`); return { success: true }; },
    async recordObservation() {},
    async completeStep() {},
    async verifyRun() { calls.push('verify-run'); },
    async recordVerificationResult() {},
    async completeRun(_runId, status) { calls.push(`complete-${status}`); },
  };
  const loop = new PlannerExecutionLoop({
    contextAssembler: { assemble: async () => ({ project: 'p1' }) },
    taskPlanner: {
      generateRepairPlan: async () => ({ steps: [] }),
      generateVerificationPlan: async () => ({ goal: 'verify', steps: [{ id: 'v1', tool: 'verify_website', input: {} }] }),
    },
    executionController: controller,
    toolRegistry: { get: (name) => ['create_website', 'verify_website'].includes(name) ? makeTool(name) : null },
    agentTaskDao: { create: (value) => value, updateStatus() {} },
    agentRunDao: { create: (value) => value },
  });

  const result = await loop.runWithPlan('p1', 'u1', {
    goal: 'Build a website',
    steps: [{ id: 's1', tool: 'create_website', input: {} }],
  }, 0, () => false);

  assert.equal(result.status, 'SUCCEEDED');
  assert.ok(calls.includes('execute-create_website'));
  assert.ok(calls.includes('execute-verify_website'));
  assert.ok(calls.includes('complete-SUCCEEDED'));
});

test('PlannerExecutionLoop returns CANCELLED before executing a canceled chat task', async () => {
  let executed = false;
  const loop = new PlannerExecutionLoop({
    contextAssembler: { assemble: async () => ({}) },
    taskPlanner: { generateRepairPlan: async () => ({ steps: [] }), generateVerificationPlan: async () => ({ steps: [] }) },
    executionController: {
      generateId: (prefix) => `${prefix}_1`,
      startRun: async () => {},
      completeRun: async (_id, status) => assert.equal(status, 'CANCELLED'),
    },
    toolRegistry: { get: () => makeTool('any', async () => { executed = true; }) },
    agentTaskDao: { create: () => {}, updateStatus: () => {} },
    agentRunDao: { create: () => {} },
  });

  const result = await loop.runWithPlan('p1', 'u1', {
    goal: 'cancelled',
    steps: [{ id: 's1', tool: 'any', input: {} }],
  }, 0, () => true);

  assert.equal(result.status, 'CANCELLED');
  assert.equal(executed, false);
});
