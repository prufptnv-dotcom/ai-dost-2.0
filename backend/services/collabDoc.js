/**
 * collabDoc — P8 multiplayer: per-project Yjs documents over WebSocket.
 *
 * Protocol: y-websocket wire format (MESSAGE_SYNC + MESSAGE_AWARENESS via
 * y-protocols/lib0), served through the server.js upgrade chain at
 * `/yws/:projectId` (claimed via `socket.__upgradeHandled`). y-websocket v3
 * no longer exports `bin/utils`, so the connection handler is hand-rolled
 * here — same frames, storage we control.
 *
 * Content model: one Y.Text per file, named `file:<relativePath>`. The text
 * is seeded from whichever side has content first (client binding inserts its
 * model when the doc is empty; applyFile replaces when the doc has content).
 *
 * Agent as a participant: every agent write flows through applyFile() (hooked
 * in routes/agent.js send()), which also publishes a server-side awareness
 * state — `{name:'AI-Dost Agent', agent:true, editing:<file>}` — so connected
 * humans SEE the agent editing, and it disappears ~20s after the last write.
 *
 * Persistence: debounced 1s snapshot into collab_docs (migration 012).
 */
const { WebSocketServer } = require('ws');
const Y = require('yjs');
const awarenessProtocol = require('y-protocols/awareness');
const syncProtocol = require('y-protocols/sync');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const logger = require('../logger');
const { getDatabase } = require('../db');

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const PERSIST_DEBOUNCE_MS = 1000;
const AGENT_VISIBLE_MS = 20000;
const MAX_FILE_CHARS = 2000000; // refuse to mirror absurd blobs into the doc

let wss = null;
const rooms = new Map(); // projectId -> { doc, awareness, conns, persistTimer, agentTimer }

function safeSend(ws, payload) {
  try {
    if (ws.readyState === 1) ws.send(payload);
  } catch (e) {
    logger.warn(`[Collab] send failed: ${e.message}`);
  }
}

function loadPersistedState(projectId) {
  try {
    const row = getDatabase().prepare('SELECT state FROM collab_docs WHERE project_id = ?').get(projectId);
    if (!row || !row.state) return null;
    return row.state instanceof Uint8Array ? row.state : new Uint8Array(row.state);
  } catch (e) {
    logger.warn(`[Collab] load failed for ${projectId}: ${e.message}`);
    return null;
  }
}

function persistNow(projectId, room) {
  try {
    const state = Y.encodeStateAsUpdate(room.doc);
    getDatabase()
      .prepare(
        `INSERT INTO collab_docs (project_id, state, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(project_id) DO UPDATE SET state = excluded.state, updated_at = datetime('now')`
      )
      .run(projectId, state);
    return true;
  } catch (e) {
    logger.warn(`[Collab] persist failed for ${projectId}: ${e.message}`);
    return false;
  }
}

function schedulePersist(projectId, room) {
  if (room.persistTimer) return;
  room.persistTimer = setTimeout(() => {
    room.persistTimer = null;
    persistNow(projectId, room);
  }, PERSIST_DEBOUNCE_MS);
  if (typeof room.persistTimer.unref === 'function') room.persistTimer.unref();
}

function getRoom(projectId) {
  let room = rooms.get(projectId);
  if (room) return room;

  const doc = new Y.Doc();
  const persisted = loadPersistedState(projectId);
  if (persisted && persisted.length) {
    try {
      Y.applyUpdate(doc, persisted, 'persistence');
    } catch (e) {
      logger.warn(`[Collab] persisted state corrupt for ${projectId} (ignored): ${e.message}`);
    }
  }
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null); // the server itself speaks only when the agent acts

  room = { doc, awareness, conns: new Set(), persistTimer: null, agentTimer: null };
  rooms.set(projectId, room);

  doc.on('update', (update, origin) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    encoding.writeVarUint(enc, syncProtocol.messageYjsUpdate);
    encoding.writeVarUint8Array(enc, update);
    const payload = encoding.toUint8Array(enc);
    for (const conn of room.conns) {
      if (conn === origin) continue; // the sender already has this state
      safeSend(conn, payload);
    }
    if (origin !== 'persistence') schedulePersist(projectId, room);
  });

  awareness.on('update', ({ added, updated, removed }, origin) => {
    const changed = added.concat(updated, removed);
    if (!changed.length) return;
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed));
    const payload = encoding.toUint8Array(enc);
    for (const conn of room.conns) {
      if (conn === origin) continue;
      safeSend(conn, payload);
    }
  });

  return room;
}

function onConnection(ws, projectId) {
  const room = getRoom(projectId);
  const { doc, awareness } = room;
  room.conns.add(ws);

  // Kick off sync: step1 (server state vector) + current awareness snapshot.
  const syncEnc = encoding.createEncoder();
  encoding.writeVarUint(syncEnc, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(syncEnc, doc);
  safeSend(ws, encoding.toUint8Array(syncEnc));

  const states = awareness.getStates();
  if (states.size > 0) {
    const awEnc = encoding.createEncoder();
    encoding.writeVarUint(awEnc, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(awEnc, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(states.keys())));
    safeSend(ws, encoding.toUint8Array(awEnc));
  }

  // Track which awareness clientIDs this connection owns, so a disconnect
  // removes ITS cursors/presence (not the agent's, not other humans').
  const ownedIds = new Set();
  const trackOwnership = ({ added, updated }, origin) => {
    if (origin !== ws) return;
    for (const id of added.concat(updated)) ownedIds.add(id);
  };
  awareness.on('update', trackOwnership);

  ws.on('message', (data) => {
    try {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const decoder = decoding.createDecoder(bytes);
      const messageType = decoding.readVarUint(decoder);
      if (messageType === MESSAGE_SYNC) {
        const syncType = decoding.readVarUint(decoder);
        if (syncType === syncProtocol.messageYjsSyncStep1) {
          const reply = encoding.createEncoder();
          encoding.writeVarUint(reply, MESSAGE_SYNC);
          syncProtocol.writeSyncStep2(reply, doc, decoding.readVarUint8Array(decoder));
          safeSend(ws, encoding.toUint8Array(reply));
        } else if (syncType === syncProtocol.messageYjsSyncStep2 || syncType === syncProtocol.messageYjsUpdate) {
          Y.applyUpdate(doc, decoding.readVarUint8Array(decoder), ws);
        }
      } else if (messageType === MESSAGE_AWARENESS) {
        awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), ws);
      }
    } catch (e) {
      logger.warn(`[Collab] bad frame from ${projectId} client: ${e.message}`);
    }
  });

  const cleanup = () => {
    if (!room.conns.has(ws)) return;
    room.conns.delete(ws);
    // Room already torn down (test reset / shutdown): awareness + persistence
    // are gone with it — do not touch a closed database.
    if (rooms.get(projectId) !== room) return;
    awareness.off('update', trackOwnership);
    if (ownedIds.size) {
      try {
        awarenessProtocol.removeAwarenessStates(awareness, Array.from(ownedIds), 'connection-closed');
      } catch (_) { /* room already torn down */ }
    }
    if (room.conns.size === 0) {
      // Last human gone: flush immediately — debounced timers must not be the
      // only thing between the session and data loss.
      if (room.persistTimer) {
        clearTimeout(room.persistTimer);
        room.persistTimer = null;
      }
      persistNow(projectId, room);
    }
  };
  ws.on('close', cleanup);
  ws.on('error', () => { try { ws.close(); } catch (_) { /* already dead */ } });
}

/**
 * Claim an HTTP upgrade for `/yws/:projectId`. Called from server.js's
 * upgrade chain (marks `socket.__upgradeHandled` before this runs).
 */
function handleUpgrade(request, socket, head, projectId) {
  if (!projectId) {
    socket.destroy();
    return;
  }
  if (!wss) wss = new WebSocketServer({ noServer: true });
  wss.handleUpgrade(request, socket, head, (ws) => onConnection(ws, String(projectId).slice(0, 120)));
}

/**
 * Agent-as-participant: mirror an agent-written file into the shared doc and
 * publish the agent's presence. Returns true when the doc actually changed.
 */
function applyFile(projectId, filePath, content) {
  try {
    if (!projectId || !filePath || typeof content !== 'string' || content.length > MAX_FILE_CHARS) return false;
    const room = getRoom(String(projectId));
    const ytext = room.doc.getText(`file:${filePath}`);
    if (ytext.length > 0 && ytext.toString() === content) return false; // identical = no churn
    room.doc.transact(() => {
      if (ytext.length > 0) ytext.delete(0, ytext.length);
      if (content) ytext.insert(0, content);
    }, 'agent');
    markAgentActive(projectId, filePath);
    return true;
  } catch (e) {
    logger.warn(`[Collab] applyFile failed for ${projectId}/${filePath}: ${e.message}`);
    return false;
  }
}

/** Server-side awareness: the agent is a visible, named participant. */
function markAgentActive(projectId, filePath) {
  try {
    const room = getRoom(String(projectId));
    room.awareness.setLocalState({
      name: 'AI-Dost Agent',
      color: '#6366f1',
      agent: true,
      editing: filePath || null,
      lastSeen: Date.now(),
    });
    if (room.agentTimer) clearTimeout(room.agentTimer);
    room.agentTimer = setTimeout(() => {
      room.agentTimer = null;
      try {
        room.awareness.setLocalState(null); // quiet agent drops out of the strip
      } catch (_) { /* room gone */ }
    }, AGENT_VISIBLE_MS);
    if (typeof room.agentTimer.unref === 'function') room.agentTimer.unref();
  } catch (e) {
    logger.warn(`[Collab] agent awareness failed: ${e.message}`);
  }
}

/** Test/observability helper — current text of `file:<path>` (or null). */
function peekText(projectId, filePath) {
  try {
    const room = rooms.get(projectId);
    if (!room) return null;
    return room.doc.getText(`file:${filePath}`).toString();
  } catch (_) {
    return null;
  }
}

function stats() {
  let conns = 0;
  for (const room of rooms.values()) conns += room.conns.size;
  return { rooms: rooms.size, connections: conns };
}

/** Test seam — flush + drop all room state (used between unit suites). */
function _resetForTests() {
  for (const [projectId, room] of rooms) {
    if (room.persistTimer) clearTimeout(room.persistTimer);
    if (room.agentTimer) clearTimeout(room.agentTimer);
    persistNow(projectId, room);
    try { room.awareness.destroy(); } catch (_) { /* ignore */ }
    try { room.doc.destroy(); } catch (_) { /* ignore */ }
  }
  rooms.clear();
}

module.exports = {
  handleUpgrade,
  applyFile,
  markAgentActive,
  peekText,
  stats,
  persistNow,
  _resetForTests,
  _getRoomForTests: (projectId) => rooms.get(projectId) || null,
  MESSAGE_SYNC,
  MESSAGE_AWARENESS,
};
