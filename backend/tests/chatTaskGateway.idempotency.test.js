'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');
const TaskIdempotencyStore = require('../agent/runtime/TaskIdempotencyStore');

function makeGateway(counter) {
  return new ChatTaskGateway({
    idempotencyStore: new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 10 }),
    plannerExecutionLoop: {
      async runWithPlan() {
        counter.count += 1;
        return { status: 'SUCCEEDED', taskId: 'task-1', output: 'ok' };
      },
    },
    taskPlanner: {
      async generatePlan() {
        return { goal: 'read', steps: [{ id: '1', tool: 'read_file', input: {} }] };
      },
    },
    contextAssembler: {
      async assemble() { return {}; },
    },
  });
}

test('duplicate completed chat task does not execute twice', async () => {
  const counter = { count: 0 };
  const gateway = makeGateway(counter);
  const taskPlan = { taskId: 'task-1', intent: { type: 'task', originalMessage: 'read' } };
  const first = await gateway.run({ projectId: 'p1', userId: 'u1', taskPlan });
  const second = await gateway.run({ projectId: 'p1', userId: 'u1', taskPlan });

  assert.equal(counter.count, 1);
  assert.deepEqual(second, first);
});

test('duplicate running chat task is rejected', async () => {
  const counter = { count: 0 };
  let resolve;
  const running = new Promise((r) => { resolve = r; });
  const gateway = new ChatTaskGateway({
    idempotencyStore: new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 10 }),
    plannerExecutionLoop: {
      async runWithPlan() {
        counter.count += 1;
        await running;
        return { status: 'SUCCEEDED' };
      },
    },
    taskPlanner: { async generatePlan() { return { goal: 'x', steps: [{ id: '1', tool: 'read_file', input: {} }] }; } },
    contextAssembler: { async assemble() { return {}; } },
  });

  const taskPlan = { taskId: 'task-2', intent: { type: 'task', originalMessage: 'x' } };
  const first = gateway.run({ projectId: 'p1', userId: 'u1', taskPlan });
  await new Promise((r) => setImmediate(r));
  await assert.rejects(
    () => gateway.run({ projectId: 'p1', userId: 'u1', taskPlan }),
    (error) => error.code === 'TASK_IN_PROGRESS'
  );
  resolve();
  await first;
  assert.equal(counter.count, 1);
});
