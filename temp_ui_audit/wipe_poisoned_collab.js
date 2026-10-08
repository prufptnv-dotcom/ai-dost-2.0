// One-off: wipe poisoned collab_docs rows while NO backend is running.
// Poison = Y.Doc ytexts overwritten with CSS (58 bytes) by the stale-ref bind bug.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'data', 'app.db');
const db = new DatabaseSync(dbPath);

const rows = db.prepare('SELECT project_id, LENGTH(state) AS len, updated_at FROM collab_docs').all();
console.log('before:', JSON.stringify(rows));

const info = db.prepare('DELETE FROM collab_docs').run();
console.log('deleted rows:', Number(info.changes));

const after = db.prepare('SELECT COUNT(*) AS n FROM collab_docs').get();
console.log('after count:', Number(after.n));
db.close();
