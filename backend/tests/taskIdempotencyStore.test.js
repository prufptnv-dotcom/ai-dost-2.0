'use strict';

const TaskIdempotencyStore = require('../agent/runtime/TaskIdempotencyStore');

describe('TaskIdempotencyStore', () => {
  test('starts a task once and returns running for a duplicate', () => {
    const store = new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 10 });
    const first = store.begin({ userId: 'u1', projectId: 'p1', taskId: 't1' });
    const second = store.begin({ userId: 'u1', projectId: 'p1', taskId: 't1' });

    expect(first.state).toBe('started');
    expect(second.state).toBe('running');
  });

  test('replays terminal result and bounded event journal', () => {
    const store = new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 10 });
    const identity = { userId: 'u1', projectId: 'p1', taskId: 't1' };
    store.begin(identity);
    for (let i = 0; i < 105; i += 1) store.recordEvent(identity, { type: 'progress', i });
    store.complete(identity, { status: 'SUCCEEDED', output: 'ok' });

    const replay = store.begin(identity);
    expect(replay.state).toBe('completed');
    expect(replay.entry.result).toEqual({ status: 'SUCCEEDED', output: 'ok' });
    expect(replay.entry.events).toHaveLength(100);
    expect(replay.entry.events[0].i).toBe(5);
  });

  test('isolates identical task ids across user/project identity', () => {
    const store = new TaskIdempotencyStore({ ttlMs: 60_000, maxEntries: 10 });
    expect(store.begin({ userId: 'u1', projectId: 'p1', taskId: 'same' }).state).toBe('started');
    expect(store.begin({ userId: 'u2', projectId: 'p1', taskId: 'same' }).state).toBe('started');
    expect(store.begin({ userId: 'u1', projectId: 'p2', taskId: 'same' }).state).toBe('started');
  });
});
