/**
 * P8 collabDoc — agent-as-participant + Yjs doc lifecycle.
 * Covers: text mirroring, no-op suppression, broadcast frames, debounced
 * persistence round-trip (survives restart), agent awareness presence.
 * Zero network — fake connections, in-memory DB.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { initDatabase, getDatabase, closeDatabase } = require('../db');
const collabDoc = require('../services/collabDoc');

let memoryDb = false;

before(() => {
  // In-memory so unit runs never touch data/app.db (same pattern as backgroundRuns).
  try {
    initDatabase(':memory:');
    memoryDb = true;
  } catch (_) {
    initDatabase(); // real file — still correct, just less isolated
  }
});

beforeEach(() => {
  collabDoc._resetForTests();
});

after(() => {
  collabDoc._resetForTests();
  if (memoryDb) {
    try { closeDatabase(); } catch (_) { /* already closed */ }
  }
});

describe('collabDoc file mirroring (P8)', () => {
  test('applyFile creates a Y.Text named file:<path> with exact content', () => {
    const changed = collabDoc.applyFile('p8-unit', 'src/App.jsx', 'export default function App() {}');
    assert.equal(changed, true);
    assert.equal(collabDoc.peekText('p8-unit', 'src/App.jsx'), 'export default function App() {}');
  });

  test('identical content is a no-op (returns false, no doc churn)', () => {
    collabDoc.applyFile('p8-unit', 'a.txt', 'v1');
    assert.equal(collabDoc.applyFile('p8-unit', 'a.txt', 'v1'), false, 'same content must not rewrite');
    assert.equal(collabDoc.applyFile('p8-unit', 'a.txt', 'v2'), true, 'different content must apply');
    assert.equal(collabDoc.peekText('p8-unit', 'a.txt'), 'v2');
  });

  test('guards reject junk (missing path, non-string content, empty projectId)', () => {
    assert.equal(collabDoc.applyFile('', 'x.js', 'c'), false);
    assert.equal(collabDoc.applyFile('p8-unit', '', 'c'), false);
    assert.equal(collabDoc.applyFile('p8-unit', 'x.js', 42), false);
    assert.equal(collabDoc.peekText('p8-unit', 'x.js'), null, 'no room created by rejected calls');
  });

  test('large blobs over 2MB are refused (context/memory guard)', () => {
    assert.equal(collabDoc.applyFile('p8-unit', 'big.txt', 'x'.repeat(2_000_001)), false);
    assert.equal(collabDoc.peekText('p8-unit', 'big.txt'), null);
  });
});

describe('collabDoc broadcast (P8)', () => {
  test('agent write fans out a MESSAGE_SYNC/update frame to every connection', () => {
    const room = collabDoc._getRoomForTests('p8-broadcast');
    assert.equal(room, null, 'room starts empty');

    const frames = [];
    const fakeConn = { readyState: 1, send: (payload) => frames.push(payload) };
    const room2 = collabDoc._getRoomForTests('p8-broadcast');
    assert.equal(room2, null, 'still lazy');

    // Creating the room through applyFile, then inject a fake connection.
    collabDoc.applyFile('p8-broadcast', 'x.js', 'v1');
    const live = collabDoc._getRoomForTests('p8-broadcast');
    live.conns.add(fakeConn);

    collabDoc.applyFile('p8-broadcast', 'x.js', 'v2');
    assert.ok(frames.length >= 1, 'update frame sent');
    // Frames can be sync OR awareness (agent presence updates on every write):
    // find the MESSAGE_SYNC=0 / messageYjsUpdate=2 frame explicitly.
    const syncUpdateFrames = frames.filter((f) => f[0] === 0 && f[1] === 2);
    assert.ok(syncUpdateFrames.length >= 1, 'a MESSAGE_SYNC/update frame was broadcast');
    const awarenessFrames = frames.filter((f) => f[0] === 1);
    assert.ok(awarenessFrames.length >= 1, 'agent presence re-broadcast with the write');

    live.conns.delete(fakeConn);
  });

  test('dead connections (readyState !== 1) are skipped without throwing', () => {
    collabDoc.applyFile('p8-dead', 'x.js', 'v1');
    const room = collabDoc._getRoomForTests('p8-dead');
    room.conns.add({ readyState: 3, send: () => { throw new Error('should not be called'); } });
    assert.doesNotThrow(() => collabDoc.applyFile('p8-dead', 'x.js', 'v2'));
  });
});

describe('collabDoc agent presence (P8)', () => {
  test('agent write publishes a named agent awareness state', () => {
    collabDoc.applyFile('p8-aware', 'src/App.jsx', 'hello');
    const room = collabDoc._getRoomForTests('p8-aware');
    const state = room.awareness.getLocalState();
    assert.ok(state, 'server awareness state set');
    assert.equal(state.name, 'AI-Dost Agent');
    assert.equal(state.agent, true);
    assert.equal(state.editing, 'src/App.jsx');
    assert.equal(state.color, '#6366f1');
  });

  test('a second write updates which file the agent is editing', () => {
    collabDoc.applyFile('p8-aware2', 'a.js', '1');
    collabDoc.applyFile('p8-aware2', 'b.js', '2');
    const room = collabDoc._getRoomForTests('p8-aware2');
    assert.equal(room.awareness.getLocalState().editing, 'b.js');
  });
});

describe('collabDoc persistence (P8)', () => {
  test('state survives a full reset (restart simulation) via collab_docs', () => {
    collabDoc.applyFile('p8-persist', 'src/keep.js', 'const keep = true;');
    collabDoc._resetForTests(); // persists + drops in-memory rooms

    // Simulated restart: fresh room must reload from SQLite.
    collabDoc.applyFile('p8-persist', 'src/keep.js', 'const keep = true;');
    const room = collabDoc._getRoomForTests('p8-persist');
    assert.equal(
      room.doc.getText('file:src/keep.js').toString(),
      'const keep = true;',
      'content rehydrated from collab_docs after reset'
    );

    const row = getDatabase().prepare('SELECT state FROM collab_docs WHERE project_id = ?').get('p8-persist');
    assert.ok(row && row.state && row.state.length > 0, 'BLOB row persisted');
  });

  test('reset persists a clean no-op row too (persistNow never throws)', () => {
    collabDoc.applyFile('p8-empty', 'x.js', '');
    assert.doesNotThrow(() => collabDoc._resetForTests());
  });
});
