// Read-only: inspect tool calls for the E2E run to see why write_file produced no file_written
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('C:/Users/vikash kumar/Pictures/ai dost 3.0/backend/data/app.db', { readOnly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
const names = tables.map(t => t.name);
console.log('tables:', names.filter(n => /tool|step|task|agent|run/i.test(n)).join(', '));

for (const tbl of names.filter(n => /tool_call/i.test(n))) {
  const cols = db.prepare(`PRAGMA table_info(${tbl})`).all().map(c => c.name);
  console.log(`\n${tbl} columns:`, cols.join(', '));
  const rows = db.prepare(`SELECT * FROM ${tbl} ORDER BY rowid DESC LIMIT 40`).all();
  for (const r of rows) {
    const input = r.input || r.inputs || r.params || JSON.stringify(r);
    const out = r.output || r.result || '';
    const outStr = typeof out === 'string' ? out : JSON.stringify(out);
    console.log(`--- ${r.id || r.rowid} ${r.toolName || r.tool_name || ''} status=${r.status || ''}`);
    console.log('  input:', String(input).slice(0, 300));
    console.log('  output:', outStr.slice(0, 300));
  }
}
db.close();
