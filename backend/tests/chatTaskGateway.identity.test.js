'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');

function makeLoop() {
  return {
    async runWithPlan(...args) {
      assert.equal(args[0], 'project-1');
      assert.equal(args[1], 'user-1');
      assert.equal(args[4](), false);
      assert.equal(args[5], 'chat-task-123');
      return { status: 'SUCCEEDED', taskId: 'chat-task-123', runId: 'run-1' };
    },
  };
}

test('ChatTaskGateway forwards external task id to canonical loop and events', async () => {
  const events = [];
  const gateway = new ChatTaskGateway({
    plannerExecutionLoop: makeLoop(),
    taskPlanner: {
      async generatePlan() {
        return { goal: 'build', steps: [{ id: '1', tool: 'read_file', input: {} }] };
      },
    },
    contextAssembler: {
      async assemble() {
        return { authorized: true };
      },
    },
  });

  const result = await gateway.run({
    projectId: 'project-1',
    userId: 'user-1',
    taskPlan: { taskId: 'chat-task-123', intent: { type: 'task', originalMessage: 'build' } },
    onEvent: (event) => events.push(event),
  });

  assert.equal(result.taskId, 'chat-task-123');
  assert.ok(events.every((event) => event.taskId === 'chat-task-123'));
});
