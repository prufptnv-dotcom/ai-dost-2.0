// P8 live verification: read collab doc; insert/remove a marker and let the
// server broadcast it to all connected browser peers.
const WebSocket = require('ws');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

const PROJECT = process.argv[2] || 'default';
const ACTION = process.argv[3] || 'read'; // read | insert | delete
const KEY = 'file:src/index.css';
const MARKER = '/*SYNC83*/';

const doc = new Y.Doc();
const ws = new WebSocket(`ws://localhost:5000/yws/${PROJECT}`);
let synced = false;
let done = false;

function sendUpdate(update) {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0); // message type: sync
  encoding.writeVarUint(enc, 2); // sync subtype: messageYjsUpdate (0=step1, 1=step2, 2=update)
  encoding.writeVarUint8Array(enc, update);
  ws.send(encoding.toUint8Array(enc));
}

doc.on('update', (update, origin) => {
  if (origin === 'remote') return; // don't echo what we received
  if (ws.readyState === WebSocket.OPEN) sendUpdate(update);
});

function finish(code) {
  if (done) return;
  done = true;
  try { ws.close(); } catch (_) {}
  setTimeout(() => process.exit(code), 200);
}

ws.on('error', (e) => { console.log(JSON.stringify({ error: String(e.message) })); finish(1); });
ws.on('close', (code, reason) => {
  if (!synced) {
    console.log(JSON.stringify({ closed: code, reason: String(reason || '') }));
    finish(1);
  }
});
ws.on('unexpected-response', (_req, res) => {
  console.log(JSON.stringify({ unexpected: res.statusCode }));
  finish(1);
});

ws.on('open', () => {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, 0); // outer messageSync byte (writeSyncStep1 = sync layer only)
  syncProtocol.writeSyncStep1(enc, doc);
  ws.send(encoding.toUint8Array(enc));
  setTimeout(() => { if (!synced) { console.log(JSON.stringify({ error: 'sync timeout' })); finish(1); } }, 8000);
});

ws.on('message', (raw) => {
  try {
    const dec = decoding.createDecoder(new Uint8Array(raw));
    const messageType = decoding.readVarUint(dec);
    if (process.env.P8_DEBUG) console.log(`frame type=${messageType} bytes=${raw.length}`);
    if (messageType !== 0) return; // awareness — skip
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 0); // outer messageSync byte (y-websocket writes it too)
    // readSyncMessage handles sync subtypes (step1/step2/update) itself and
    // queues any reply (e.g. our step2) into `enc`
    const syncType = syncProtocol.readSyncMessage(dec, enc, doc, 'remote');
    if (encoding.length(enc) > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(encoding.toUint8Array(enc));
    }
    if (!synced && (syncType === 1 || syncType === 2)) { // step2 or update = state arrived
      synced = true;
      act();
    }
  } catch (e) {
    console.log(JSON.stringify({ protocolError: e.message }));
    finish(1);
  }
});

function act() {
  const t = doc.getText(KEY);
  const app = doc.getText('file:src/App.jsx');
  const firstLine = (s) => JSON.stringify((s.split('\n')[0] || '').slice(0, 70));
  const out = {
    project: PROJECT,
    action: ACTION,
    indexCss_first: firstLine(t.toString()),
    appJsx_first: firstLine(app.toString()),
    indexCss_len: t.length,
    appJsx_len: app.length,
  };
  if (ACTION === 'repair') {
    // Ground truth from the workspace API -> replace the WHOLE poisoned
    // file:src/App.jsx ytext in one transaction (broadcast to all peers).
    fetch(`http://localhost:5000/api/memory/project/${PROJECT}`)
      .then(r => r.json())
      .then(data => {
        const files = Array.isArray(data) ? data : (data.files || []);
        const target = files.find(f => f.path === 'src/App.jsx');
        const correct = target && target.content ? target.content : '';
        if (!correct) throw new Error('src/App.jsx not found/empty in workspace store');
        doc.transact(() => { app.delete(0, app.length); app.insert(0, correct); }, 'local');
        out.repaired = true;
        out.appJsx_len_after = app.length;
        out.appJsx_first_after = firstLine(app.toString());
        console.log(JSON.stringify(out));
        setTimeout(() => finish(0), 500); // let the update flush to the server
      })
      .catch(e => { console.log(JSON.stringify({ repairError: e.message })); finish(1); });
    return;
  }
  if (ACTION === 'insert') {
    doc.transact(() => { t.insert(0, MARKER); }, 'local');
    out.inserted = MARKER;
    out.now_first = firstLine(t.toString());
  } else if (ACTION === 'delete') {
    const str = t.toString();
    const idx = str.indexOf(MARKER);
    if (idx >= 0) {
      doc.transact(() => { t.delete(idx, MARKER.length); }, 'local');
      out.deletedAt = idx;
      out.now_first = firstLine(t.toString());
    } else {
      out.markerNotFound = true;
    }
  }
  console.log(JSON.stringify(out));
  // give the update a moment to flush before closing
  setTimeout(() => finish(0), 300);
}
