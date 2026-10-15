'use strict';
// one-off: dump recent portfolio-run tool observations (failures + writes)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const BE = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/backend';
const db = new DatabaseSync(path.join(BE, 'data', 'app.db'), { readOnly: true });
const rows = db.prepare(`
  SELECT step_id, observation_type, payload, created_at
  FROM observations
  WHERE created_at >= '2026-10-09 14:23'
  ORDER BY rowid ASC
`).all();
console.log(`recent observations: ${rows.length}`);
for (const r of rows) {
  let p = r.payload;
  try { p = typeof p === 'string' ? p : JSON.stringify(p); } catch { p = String(p); }
  if (/false|error|forbid|reject|missing|invalid|approval|package|server|terminal|npm/i.test(p)) {
    console.log(`\n[${r.created_at}] ${r.step_id} ${r.observation_type}:\n  ${p.slice(0, 700)}`);
  }
}
db.close();
