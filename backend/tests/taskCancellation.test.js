'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const { combineSignals, registerTask, getActiveTask, cancelActiveTask, activeTasks } = require('../taskCancellation');

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
