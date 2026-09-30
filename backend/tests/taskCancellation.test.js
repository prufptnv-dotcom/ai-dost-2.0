'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

// Must load BEFORE express: taskCancellation installs a Module._load hook that
// patches express.Router on express's first load, so require order matters.
const { combineSignals, registerTask, getActiveTask, cancelActiveTask, activeTasks } = require('../taskCancellation');
const express = require('express');

test('combineSignals aborts when either signal aborts', () => {
  const first = new AbortController();
  const second = new AbortController();
  const combined = combineSignals(first.signal, second.signal);
  assert.equal(combined.aborted, false);
  second.abort(new Error('stop'));
  assert.equal(combined.aborted, true);
});

test('registered task is canceled when the client disconnects before response finishes', async () => {
  const server = http.createServer((req, res) => {
    const task = registerTask('test-disconnect', req, res);
    assert.equal(getActiveTask('test-disconnect'), task);
    setTimeout(() => {
      if (!res.writableEnded) res.end('done');
    }, 100);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    await new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: address.port, path: '/' }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', resolve);
      req.end();
      setTimeout(() => req.destroy(), 10);
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(getActiveTask('test-disconnect'), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('explicit cancellation aborts and removes the active task', () => {
  const controller = new AbortController();
  const task = { taskId: 'test-explicit', controller, canceled: false };
  activeTasks.set(task.taskId, task);
  assert.equal(cancelActiveTask('test-explicit', 'user stopped'), true);
  assert.equal(controller.signal.aborted, true);
  assert.equal(getActiveTask('test-explicit'), null);
});

test('agent /run handlers inherit the server task cancellation context', async () => {
  const app = express();
  app.use(express.json());
  const observed = [];
  const taskId = 'agent-run-cancel-test';
  const router = express.Router();
  router.post('/run', async (req, res) => {
    const task = getActiveTask(taskId);
    observed.push(Boolean(task), task?.taskId);
    res.json({ ok: true });
  });
  app.use('/api/agent', router);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const address = server.address();
    await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: address.port,
        path: '/api/agent/run',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength('{}'),
          'X-AI-Dost-Task-Id': taskId,
        },
      }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.end('{}');
    });

    assert.deepEqual(observed, [true, taskId]);
    assert.equal(getActiveTask(taskId), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('P2 #44: resolveTaskId never overwrites an in-flight client id', () => {
  const { resolveTaskId } = require('../taskCancellation');
  activeTasks.set('taken-id', { taskId: 'taken-id', controller: new AbortController(), canceled: false });
  const fakeReq = (id) => ({ get: (header) => (header === 'x-ai-dost-task-id' ? id : null) });

  assert.equal(resolveTaskId(fakeReq('fresh-id')), 'fresh-id', 'fresh ids are honoured');
  assert.notEqual(resolveTaskId(fakeReq('taken-id')), 'taken-id', 'colliding id must be replaced');
  assert.notEqual(
    resolveTaskId(fakeReq('bad id <script>alert(1)</script>')),
    'bad id <script>alert(1)</script>',
    'unsafe ids must be replaced'
  );
  activeTasks.delete('taken-id');
});

test('P2 #45: cancel endpoint enforces origin allowlist before touching tasks', async () => {
  const server = http.createServer((req, res) => res.end('ok'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const noOrigin = await fetch(`http://127.0.0.1:${port}/api/chat/tasks/t1/cancel`, { method: 'POST' });
    assert.equal(noOrigin.status, 403, 'missing Origin must be rejected');

    const evil = await fetch(`http://127.0.0.1:${port}/api/chat/tasks/t1/cancel`, {
      method: 'POST',
      headers: { Origin: 'http://evil.example' },
    });
    assert.equal(evil.status, 403, 'foreign origin must be rejected');

    const unknown = await fetch(`http://127.0.0.1:${port}/api/chat/tasks/nope/cancel`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.equal(unknown.status, 404, 'allowlisted origin passes auth (task not found)');

    const controller = new AbortController();
    activeTasks.set('victim', { taskId: 'victim', controller, canceled: false });
    const ok = await fetch(`http://127.0.0.1:${port}/api/chat/tasks/victim/cancel`, {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.canceled, true);
    assert.equal(controller.signal.aborted, true);
    activeTasks.delete('victim');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
