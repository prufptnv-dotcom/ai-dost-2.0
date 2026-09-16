'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const DurableTaskStore = require('./DurableTaskStore');

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-task-')), 'state.json');
}

test('persists task lifecycle and reloads terminal result', () => {
  const filePath = tempFile();
  const identity = { taskId: 'task-1', projectId: 'project-1', userId: 'user-1' };
  const first = new DurableTaskStore({ filePath });
  assert.equal(first.begin(identity).state, 'started');
  first.update(identity, { currentPhase: 'executing', currentStepId: 'step-1', attempt: 1 });
  first.complete(identity, { status: 'SUCCEEDED', taskId: 'task-1' });

  const second = new DurableTaskStore({ filePath });
  const state = second.get(identity);
  assert.equal(state.status, 'SUCCEEDED');
  assert.equal(state.result.status, 'SUCCEEDED');
});

test('marks active tasks recovery-required after restart', () => {
  const filePath = tempFile();
  const identity = { taskId: 'task-2', projectId: 'project-1', userId: 'user-1' };
  const first = new DurableTaskStore({ filePath });
  first.begin(identity);
  first.update(identity, { currentPhase: 'executing', currentStepId: 'step-2' });

  const second = new DurableTaskStore({ filePath });
  const state = second.get(identity);
  assert.equal(state.status, 'RECOVERY_REQUIRED');
  assert.equal(state.errorCode, 'PROCESS_INTERRUPTED');
  assert.equal(second.listRecoveryRequired().length, 1);
});

test('redacts sensitive checkpoint and event fields', () => {
  const filePath = tempFile();
  const identity = { taskId: 'task-3', projectId: 'project-1', userId: 'user-1' };
  const store = new DurableTaskStore({ filePath });
  store.begin(identity);
  store.checkpoint(identity, { apiKey: 'secret-value', safe: 'value' });
  store.event(identity, { type: 'step', authorization: 'Bearer secret', safe: 'ok' });
  const state = store.get(identity);
  assert.equal(state.checkpoint.apiKey, '[REDACTED]');
  assert.equal(state.events[0].authorization, '[REDACTED]');
  assert.equal(state.checkpoint.safe, 'value');
});
