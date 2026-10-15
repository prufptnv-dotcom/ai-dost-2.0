'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const DurableTaskIdempotencyStore = require('../agent/runtime/DurableTaskIdempotencyStore');

test('durable idempotency store survives a new store instance', () => {
  const db = new DatabaseSync(':memory:');
  const identity = { userId: 'u1', projectId: 'p1', taskId: 't1' };

  const firstStore = new DurableTaskIdempotencyStore(db, { ttlMs: 60_000 });
  assert.equal(firstStore.begin(identity).state, 'started');
  firstStore.recordEvent(identity, { type: 'task_phase', phase: 'running' });
  firstStore.complete(identity, { status: 'SUCCEEDED', output: 'done' });

  const restartedStore = new DurableTaskIdempotencyStore(db, { ttlMs: 60_000 });
  const replay = restartedStore.begin(identity);

  assert.equal(replay.state, 'completed');
  assert.deepEqual(replay.entry.result, { status: 'SUCCEEDED', output: 'done' });
  assert.equal(replay.entry.events.length, 1);
  db.close();
});

test('durable store isolates the same task id by user and project', () => {
  const db = new DatabaseSync(':memory:');
  const store = new DurableTaskIdempotencyStore(db, { ttlMs: 60_000 });

  assert.equal(store.begin({ userId: 'u1', projectId: 'p1', taskId: 'same' }).state, 'started');
  assert.equal(store.begin({ userId: 'u2', projectId: 'p1', taskId: 'same' }).state, 'started');
  assert.equal(store.begin({ userId: 'u1', projectId: 'p2', taskId: 'same' }).state, 'started');
  assert.equal(store.begin({ userId: 'u1', projectId: 'p1', taskId: 'same' }).state, 'running');
  db.close();
});
