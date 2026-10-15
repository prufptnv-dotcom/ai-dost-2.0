// Forensic probe 5: schema + exact error/output per key apply/read/write row
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');

const cols = db.prepare(`PRAGMA table_info(tool_calls)`).all();
console.log('columns:', cols.map(c => c.name).join(', '));

const rows = db.prepare(`
  SELECT rowid, tool_name, status, input, output, error_info FROM tool_calls
  WHERE rowid IN (643, 644, 647, 652, 654, 665, 678, 680, 687, 689, 702, 704)
  ORDER BY rowid ASC
`).all();

for (const r of rows) {
  let input; try { input = JSON.parse(r.input); } catch { input = {}; }
  console.log('='.repeat(60));
  console.log(`rowid=${r.rowid} ${r.tool_name} status=${r.status} path=${input.path}`);
  if (r.error_info) console.log(`  ERROR: ${String(r.error_info).slice(0, 300)}`);
  if (r.output) {
    let out = String(r.output);
    try { const p = JSON.parse(out); out = JSON.stringify(p); } catch {}
    console.log(`  OUTPUT: ${out.slice(0, 400)}`);
  }
}
db.close();
