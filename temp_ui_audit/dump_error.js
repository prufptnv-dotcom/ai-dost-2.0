'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const BE = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/backend';
const db = new DatabaseSync(path.join(BE, 'data', 'app.db'), { readOnly: true });
for (const t of ['agent_runs', 'agent_tasks']) {
  const cols = db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
  console.log(t, '=>', cols.join(', '));
}
console.log('\n--- failed agent_runs ---');
const runs = db.prepare("SELECT * FROM agent_runs WHERE status='FAILED' ORDER BY rowid DESC LIMIT 3").all();
for (const r of runs) {
  const { id, status, created_at, updated_at, ...rest } = r;
  console.log(created_at, '|', id, '|', JSON.stringify(rest).slice(0, 400));
}
console.log('\n--- recent agent_tasks ---');
const tasks = db.prepare('SELECT * FROM agent_tasks ORDER BY rowid DESC LIMIT 12').all();
for (const t of tasks) console.log(t.status, '|', String(t.title || t.name || '').slice(0, 55), '|', JSON.stringify({ error: t.error, metadata: t.metadata }).slice(0, 220));
db.close();
