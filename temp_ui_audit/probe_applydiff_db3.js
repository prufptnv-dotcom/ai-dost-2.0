// Forensic probe 3: what happened between rowid 650-670 + the single successful run_terminal
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');

console.log('--- ALL rows 648..672 ---');
const rows = db.prepare(`
  SELECT rowid, tool_name, status, input, step_id FROM tool_calls
  WHERE rowid BETWEEN 648 AND 672 ORDER BY rowid ASC
`).all();
for (const r of rows) {
  let input;
  try { input = JSON.parse(r.input); } catch { input = { RAW: String(r.input).slice(0, 120) }; }
  const brief = input.path ? `path=${input.path}` : '';
  const cmd = input.command || input.cmd || input.customCommand || '';
  const content = input.content ? ` contentLen=${input.content.length} head=${JSON.stringify(input.content.slice(0, 80))}` : '';
  const search = input.search ? ` search=${JSON.stringify(String(input.search).slice(0, 80))}` : '';
  console.log(`rowid=${r.rowid} ${r.tool_name} status=${r.status} ${brief}${cmd ? ' cmd=' + JSON.stringify(cmd) : ''}${content}${search}`);
}

console.log('\n--- ALL run_terminal rows ---');
const tt = db.prepare(`SELECT rowid, status, input, step_id FROM tool_calls WHERE tool_name='run_terminal' ORDER BY rowid ASC`).all();
for (const r of tt) {
  let input; try { input = JSON.parse(r.input); } catch { input = { RAW: String(r.input).slice(0, 200) }; }
  console.log(`rowid=${r.rowid} status=${r.status} step=${r.step_id}`);
  console.log(`   ${JSON.stringify(input).slice(0, 500)}`);
}

console.log('\n--- any delete-ish tools ---');
const del = db.prepare(`SELECT rowid, tool_name, status, input FROM tool_calls WHERE tool_name LIKE '%delete%' OR tool_name LIKE '%remove%' OR input LIKE '%rm %' ORDER BY rowid ASC LIMIT 20`).all();
for (const r of del) console.log(`rowid=${r.rowid} ${r.tool_name} status=${r.status} input=${String(r.input).slice(0, 300)}`);
db.close();
