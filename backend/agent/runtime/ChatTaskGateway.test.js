'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ChatTaskGateway = require('./ChatTaskGateway');
const TaskIdempotencyStore = require('./TaskIdempotencyStore');

function makeTaskPlan(taskId = 'task-1') {
  return {
    taskId,
    intent: {
      type: 'task',
      originalMessage: 'Run the requested autonomous task',
    },
  };
}

function makeGateway({ result = { status: 'SUCCEEDED', output: 'ok' }, validateResult, calls } = {}) {
  const adapter = {
    toAgentPlan() {
      return { steps: [{ id: 'step-1', tool: 'noop', input: {} }] };
    },
    validateAgentPlan(plan) {
      return plan;
    },
    validateResult(value) {
      if (validateResult) return validateResult(value);
      return value;
    },
  };

  const plannerExecutionLoop = {
    async runWithPlan() {
      calls && calls.push('execute');
      return typeof result === 'function' ? result() : result;
    },
  };

  return new ChatTaskGateway({
    plannerExecutionLoop,
    adapter,
    idempotencyStore: new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 100 }),
  });
}

test('replays completed result without executing twice and includes terminal event', async () => {
  const calls = [];
  const gateway = makeGateway({ calls });
  const firstEvents = [];

  const first = await gateway.run({
    projectId: 'project-1',
    userId: 'user-1',
    taskPlan: makeTaskPlan(),
    onEvent: (event) => firstEvents.push(event),
  });

  const replayEvents = [];
  const second = await gateway.run({
    projectId: 'project-1',
    userId: 'user-1',
    taskPlan: makeTaskPlan(),
    onEvent: (event) => replayEvents.push(event),
  });

  assert.deepEqual(second, first);
  assert.equal(calls.length, 1);
  assert.equal(replayEvents[0].type, 'task_replay');
  assert.ok(replayEvents.some((event) => event.phase === 'success'));
  assert.ok(firstEvents.some((event) => event.phase === 'success'));
});

test('rejects duplicate task while execution is running', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const store = new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 100 });
  const gateway = new ChatTaskGateway({
    adapter: {
      toAgentPlan: () => ({ steps: [{ id: 'step-1' }] }),
      validateAgentPlan: (plan) => plan,
      validateResult: (result) => result,
    },
    plannerExecutionLoop: {
      runWithPlan: async () => {
        await gate;
        return { status: 'SUCCEEDED' };
      },
    },
    idempotencyStore: store,
  });

  const running = gateway.run({
    projectId: 'project-1',
    userId: 'user-1',
    taskPlan: makeTaskPlan('running-task'),
  });

  await assert.rejects(
    gateway.run({
      projectId: 'project-1',
      userId: 'user-1',
      taskPlan: makeTaskPlan('running-task'),
    }),
    (error) => error.code === 'TASK_IN_PROGRESS',
  );

  release();
  await running;
});

test('stores validation failure as failed instead of completed', async () => {
  const store = new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 100 });
  const gateway = new ChatTaskGateway({
    adapter: {
      toAgentPlan: () => ({ steps: [{ id: 'step-1' }] }),
      validateAgentPlan: (plan) => plan,
      validateResult: () => {
        throw new Error('invalid result');
      },
    },
    plannerExecutionLoop: {
      runWithPlan: async () => ({ status: 'SUCCEEDED' }),
    },
    idempotencyStore: store,
  });

  await assert.rejects(
    gateway.run({
      projectId: 'project-1',
      userId: 'user-1',
      taskPlan: makeTaskPlan('invalid-result-task'),
    }),
    /invalid result/,
  );

  const state = store.get({
    taskId: 'invalid-result-task',
    projectId: 'project-1',
    userId: 'user-1',
  });
  assert.equal(state.state, 'failed');
  assert.equal(state.result, null);

  await assert.rejects(
    gateway.run({
      projectId: 'project-1',
      userId: 'user-1',
      taskPlan: makeTaskPlan('invalid-result-task'),
    }),
    (error) => error.code === 'TASK_REPLAY_FAILED',
  );
});

test('isolates idempotency identities by project and user', async () => {
  const calls = [];
  const gateway = makeGateway({ calls });

  await gateway.run({
    projectId: 'project-a',
    userId: 'user-1',
    taskPlan: makeTaskPlan('same-task'),
  });
  await gateway.run({
    projectId: 'project-b',
    userId: 'user-1',
    taskPlan: makeTaskPlan('same-task'),
  });
  await gateway.run({
    projectId: 'project-a',
    userId: 'user-2',
    taskPlan: makeTaskPlan('same-task'),
  });

  assert.equal(calls.length, 3);
});
