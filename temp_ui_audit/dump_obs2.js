'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const BE = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/backend';
const db = new DatabaseSync(path.join(BE, 'data', 'app.db'), { readOnly: true });
const rows = db.prepare('SELECT step_id, observation_type, payload, created_at FROM observations ORDER BY rowid DESC LIMIT 8').all();
for (const r of rows) {
  console.log(String(r.created_at), '|', r.step_id, '|', r.observation_type);
}
db.close();
