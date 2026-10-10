'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ChatTaskGateway = require('../agent/runtime/ChatTaskGateway');
const DurableTaskStore = require('../agent/runtime/DurableTaskStore');

// Isolated durable-state file: the shared default journal persists across
// local runs, so fixed task identities replay on the second run and the loop
// is silently never invoked (test passes while testing nothing).
const isolatedStateFiles = [];
test.after(() => {
  for (const f of isolatedStateFiles) {
    try { fs.rmSync(f, { force: true }); } catch { /* best effort */ }
  }
});

function isolatedDurableStore() {
  const filePath = path.join(
    os.tmpdir(),
    `aidost-identity-test-${process.pid}-${Math.random().toString(36).slice(2)}.json`
  );
  isolatedStateFiles.push(filePath);
  return new DurableTaskStore({ filePath });
}

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
    durableTaskStore: isolatedDurableStore(),
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
