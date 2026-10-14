'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawn } = require('node:child_process');
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

test('merges snapshots from independent store instances without losing task records', () => {
  const filePath = tempFile();
  const firstIdentity = { taskId: 'task-a', projectId: 'project-1', userId: 'user-1' };
  const secondIdentity = { taskId: 'task-b', projectId: 'project-1', userId: 'user-1' };

  // Both instances load the same initially empty snapshot before either writes.
  const first = new DurableTaskStore({ filePath });
  const second = new DurableTaskStore({ filePath });
  assert.equal(first.begin(firstIdentity).state, 'started');
  assert.equal(second.begin(secondIdentity).state, 'started');

  const reloaded = new DurableTaskStore({ filePath });
  // A fresh store treats persisted RUNNING tasks as interrupted after restart.
  assert.equal(reloaded.get(firstIdentity).status, 'RECOVERY_REQUIRED');
  assert.equal(reloaded.get(secondIdentity).status, 'RECOVERY_REQUIRED');
});

test('serializes concurrent writes from separate Node processes without losing task records', async () => {
  const filePath = tempFile();
  const directory = path.dirname(filePath);
  const readyA = path.join(directory, 'writer-a.ready');
  const readyB = path.join(directory, 'writer-b.ready');
  const storeModule = path.join(__dirname, 'DurableTaskStore.js');
  const worker = (taskId, readyPath, otherReadyPath) => `
    const fs = require('node:fs');
    const { DurableTaskStore } = { DurableTaskStore: require(${JSON.stringify(storeModule)}) };
    const store = new DurableTaskStore({ filePath: ${JSON.stringify(filePath)} });
    fs.writeFileSync(${JSON.stringify(readyPath)}, 'ready');
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(${JSON.stringify(otherReadyPath)})) {
      if (Date.now() > deadline) process.exit(3);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    store.begin({ taskId: ${JSON.stringify(taskId)}, projectId: 'project-1', userId: 'user-1' });
  `;
  const runWorker = (taskId, readyPath, otherReadyPath) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', worker(taskId, readyPath, otherReadyPath)], { stdio: 'pipe' });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`DurableTaskStore worker ${taskId} exited ${code}: ${stderr}`));
    });
  });

  try {
    await Promise.all([
      runWorker('process-task-a', readyA, readyB),
      runWorker('process-task-b', readyB, readyA),
    ]);
    const reloaded = new DurableTaskStore({ filePath });
    assert.equal(reloaded.get({ taskId: 'process-task-a', projectId: 'project-1', userId: 'user-1' }).status, 'RECOVERY_REQUIRED');
    assert.equal(reloaded.get({ taskId: 'process-task-b', projectId: 'project-1', userId: 'user-1' }).status, 'RECOVERY_REQUIRED');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
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
