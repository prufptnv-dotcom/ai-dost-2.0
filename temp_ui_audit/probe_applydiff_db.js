// Forensic probe: inspect actual apply_diff tool-call payloads from run #10/#11
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');

const rows = db.prepare(`
  SELECT id, step_id, tool_name, status, input
  FROM tool_calls
  WHERE tool_name IN ('apply_diff', 'write_file')
  ORDER BY rowid DESC
  LIMIT 16
`).all();

for (const r of rows) {
  console.log('='.repeat(70));
  console.log(`${r.tool_name} | status=${r.status} | step=${r.step_id}`);
  let input;
  try { input = JSON.parse(r.input); } catch { input = { RAW: String(r.input).slice(0, 300) }; }
  if (r.tool_name === 'apply_diff') {
    const s = input.search ?? '';
    const rp = input.replace ?? '';
    console.log(`  path: ${input.path}`);
    console.log(`  search len=${s.length} hasRealNewline=${/\n/.test(s)} hasLiteralBackslashN=${/\\n/.test(s)}`);
    console.log(`  search head=${JSON.stringify(s.slice(0, 200))}`);
    console.log(`  replace len=${rp.length} head=${JSON.stringify(rp.slice(0, 120))}`);
  } else {
    console.log(`  path: ${input.path} content len=${(input.content || '').length}`);
    console.log(`  content head: ${JSON.stringify((input.content || '').slice(0, 160))}`);
  }
}
db.close();
