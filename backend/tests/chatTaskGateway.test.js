'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');

function makeAdapter() {
  return {
    toAgentPlan(plan) {
      return { goal: plan.intent.originalMessage, steps: [{ id: 's1', tool: 'create_website', description: 'create website', input: {} }] };
    },
    validateAgentPlan(plan) {
      assert.equal(plan.steps[0].tool, 'create_website');
      return plan;
    },
    validateResult(result) {
      return { ...result, validated: true };
    },
  };
}

test('delegates validated chat task to PlannerExecutionLoop', async () => {
  const calls = [];
  const gateway = new ChatTaskGateway({
    adapter: makeAdapter(),
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
  assert.equal(calls[0].plan.source, undefined);
  assert.equal(events[0].phase, 'planning');
  assert.equal(events.at(-1).phase, 'success');
});

test('fails closed when an autonomous chat task has no executable steps', async () => {
  const gateway = new ChatTaskGateway({
    adapter: {
      toAgentPlan: () => ({ goal: 'x', steps: [] }),
      validateAgentPlan: (plan) => plan,
    },
    plannerExecutionLoop: { runWithPlan: async () => ({ status: 'SUCCEEDED' }) },
  });

  await assert.rejects(
    gateway.run({
      projectId: 'p1',
      userId: 'u1',
      taskPlan: { type: 'task', intent: { originalMessage: 'do it' } },
    }),
    /no executable tool steps/
  );
});

test('does not enter the runtime after pre-canceled signal', async () => {
  let called = false;
  const controller = new AbortController();
  controller.abort();
  const gateway = new ChatTaskGateway({
    adapter: makeAdapter(),
    plannerExecutionLoop: { runWithPlan: async () => { called = true; return { status: 'SUCCEEDED' }; } },
  });

  await assert.rejects(
    gateway.run({
      projectId: 'p1',
      userId: 'u1',
      taskPlan: { type: 'task', intent: { originalMessage: 'do it' } },
      signal: controller.signal,
    }),
    /canceled before execution/
  );
  assert.equal(called, false);
});
