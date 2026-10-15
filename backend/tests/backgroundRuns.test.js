/**
 * P9 background runs — durable event log + live reattach bus (unit).
 * Zero network: Telegram notify is only exercised on its honest no-token path.
 * DB: in-memory SQLite (migrations incl. 011_task_events run against it).
 */
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { initDatabase, closeDatabase } = require('../db');
const backgroundRuns = require('../services/backgroundRuns');

before(() => {
  initDatabase(':memory:');
  backgroundRuns._resetForTests();
});

after(() => {
  try { closeDatabase(); } catch (_) { /* already closed */ }
});

describe('backgroundRuns (P9)', () => {
  test('persists dense seq; record never throws for unknown runs; first finish wins', () => {
    const runId = `run-ut-${Date.now().toString(36)}-a`;
    assert.equal(backgroundRuns.begin({ runId, projectId: 'p1', prompt: 'hello', background: true }), true);
    assert.equal(backgroundRuns.record(runId, { type: 'start', message: 's' }), 1);
    assert.equal(backgroundRuns.record(runId, { type: 'step' }), 2);
    assert.equal(backgroundRuns.record(runId, { type: 'done', message: 'ok' }), 3);

    // send() calls record() even for runs that never registered — must be a
    // no-op, never an exception inside the SSE write path.
    assert.equal(backgroundRuns.record('run-ut-never-begun', { type: 'x' }), 0);

    const run = backgroundRuns.get(runId);
    assert.equal(run.status, 'running');
    assert.equal(run.seq, 3);
    assert.equal(run.background, 1);
    assert.equal(run.project_id, 'p1');

    assert.equal(backgroundRuns.finish(runId, 'done', 'ok'), true, 'first finish transitions');
    assert.equal(backgroundRuns.finish(runId, 'failed', 'late'), false, 'second finish is a no-op');
    const after = backgroundRuns.get(runId);
    assert.equal(after.status, 'done', 'late finish must not rewrite history');
    assert.equal(after.final_message, 'ok');
    assert.ok(after.finished_at, 'finished_at stamped');
  });

  test('replay yields parsed events with dense 1-based seq (the client cursor)', () => {
    const runId = `run-ut-${Date.now().toString(36)}-b`;
    backgroundRuns.begin({ runId, projectId: 'p2', prompt: 'replay me', background: true });
    backgroundRuns.record(runId, { type: 'start', message: 'one' });
    backgroundRuns.record(runId, { type: 'thinking', message: 'two' });
    backgroundRuns.record(runId, { type: 'done', message: 'three', completed: false });

    const all = backgroundRuns.replay(runId, 0);
    assert.equal(all.length, 3);
    assert.deepEqual(all.map(e => e.seq), [1, 2, 3]);
    assert.equal(all[0].event.type, 'start');
    assert.ok(all[0].at, 'created_at carried through');
    assert.equal(all[2].event.completed, false, 'payload parses verbatim');

    const tail = backgroundRuns.replay(runId, 2);
    assert.equal(tail.length, 1);
    assert.equal(tail[0].seq, 3);

    assert.deepEqual(backgroundRuns.replay('run-ut-unknown', 0), []);
    backgroundRuns.finish(runId, 'failed', 'three');
  });

  test('live listeners: fanout, __finished__ delivery, dropped on finish, throw isolation', () => {
    const runId = `run-ut-${Date.now().toString(36)}-c`;
    backgroundRuns.begin({ runId, prompt: 'live', background: true });

    const seen = [];
    backgroundRuns.onEvent(runId, (e) => seen.push(e));
    backgroundRuns.record(runId, { type: 'thinking', message: 'tick' });
    backgroundRuns.publish(runId, { event: { type: 'thinking', message: 'tick' } });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].event.type, 'thinking');
    assert.equal(backgroundRuns.isLive(runId), true);

    backgroundRuns.finish(runId, 'done', 'done msg');
    assert.equal(seen.length, 2);
    assert.equal(seen[1].type, '__finished__');
    assert.equal(backgroundRuns.isLive(runId), false, 'listeners dropped on finish');

    // a listener that throws must not take down the run or its siblings
    const r2 = `run-ut-${Date.now().toString(36)}-d`;
    backgroundRuns.begin({ runId: r2, prompt: 'x' });
    backgroundRuns.onEvent(r2, () => { throw new Error('bad listener'); });
    const sibling = [];
    backgroundRuns.onEvent(r2, (e) => sibling.push(e));
    backgroundRuns.publish(r2, { event: { type: 'step' } });
    assert.equal(sibling.length, 1, 'good listener still fires after bad one throws');
    backgroundRuns.finish(r2, 'done');
  });

  test('restart simulation: orphaned running rows become interrupted, replay survives', () => {
    const runId = `run-ut-${Date.now().toString(36)}-e`;
    backgroundRuns.begin({ runId, projectId: 'p3', prompt: 'orphan', background: true });
    backgroundRuns.record(runId, { type: 'start', message: 'begin' });

    // wipe in-process state = server restart; next access re-inits the DAO and
    // marks every still-running row (this one) as interrupted — honest, not hanging.
    backgroundRuns._resetForTests();
    const run = backgroundRuns.get(runId);
    assert.equal(run.status, 'interrupted');
    assert.match(run.final_message, /server restarted/);
    assert.ok(run.finished_at);
    assert.equal(backgroundRuns.replay(runId, 0).length, 1, 'events survive the restart');
  });

  test('notifyTelegram skips honestly when unconfigured', async () => {
    const prevToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevIds = process.env.TELEGRAM_ALLOWED_IDS;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALLOWED_IDS;
    try {
      const r = await backgroundRuns.notifyTelegram({ runId: 'x', status: 'done', message: 'm' });
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'no-token');
      process.env.TELEGRAM_BOT_TOKEN = 'dummy';
      const r2 = await backgroundRuns.notifyTelegram({ runId: 'x', status: 'done', message: 'm' });
      assert.equal(r2.ok, false);
      assert.equal(r2.reason, 'no-allowed-ids', 'token without recipients is a skip, not a crash');
    } finally {
      if (prevToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = prevToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
      if (prevIds !== undefined) process.env.TELEGRAM_ALLOWED_IDS = prevIds;
      else delete process.env.TELEGRAM_ALLOWED_IDS;
    }
  });
});
