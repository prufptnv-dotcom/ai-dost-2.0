'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');

test('ChatTaskGateway fails closed when task is already canceled', async () => {
  let executions = 0;
  const gateway = new ChatTaskGateway({
    plannerExecutionLoop: {
      async runWithPlan() {
        executions += 1;
        throw new Error('must not execute');
      },
    },
  });

  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    gateway.run({
      projectId: 'project-1',
      userId: 'user-1',
      taskPlan: { taskId: 'chat-1', intent: { type: 'task', originalMessage: 'do work' } },
      signal: controller.signal,
    }),
    /canceled before execution/i,
  );
  assert.equal(executions, 0);
});

test('ChatTaskGateway passes cancellation state into canonical execution', async () => {
  let receivedIsCanceled = null;
  const gateway = new ChatTaskGateway({
    contextAssembler: {
      async assemble() {
        return { workspace: 'authorized' };
      },
    },
    taskPlanner: {
      async generatePlan() {
        return {
          goal: 'do work',
          steps: [{ id: 's1', tool: 'web_search', description: 'search', input: { query: 'x' } }],
        };
      },
    },
    plannerExecutionLoop: {
      async runWithPlan(projectId, userId, plan, maxRepairs, isCanceled) {
        assert.equal(projectId, 'project-1');
        assert.equal(userId, 'user-1');
        assert.equal(plan.goal, 'do work');
        assert.equal(maxRepairs, 3);
        receivedIsCanceled = isCanceled;
        return { status: 'SUCCEEDED', taskId: 'db-task-1', runId: 'db-run-1' };
      },
    },
  });

  const controller = new AbortController();
  const resultPromise = gateway.run({
    projectId: 'project-1',
    userId: 'user-1',
    taskPlan: { taskId: 'chat-1', intent: { type: 'task', originalMessage: 'do work' } },
    signal: controller.signal,
  });

  const result = await resultPromise;
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(typeof receivedIsCanceled, 'function');
  assert.equal(receivedIsCanceled(), false);

  controller.abort();
  assert.equal(receivedIsCanceled(), true);
});
