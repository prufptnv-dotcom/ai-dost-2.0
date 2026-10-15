// Forensic probe 2: all tool_calls rows for vite.config.js / package.json / server.js with status
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');

const statuses = db.prepare(`
  SELECT tool_name, status, COUNT(*) AS n FROM tool_calls
  GROUP BY tool_name, status ORDER BY n DESC
`).all();
console.log('--- status distribution ---');
console.table(statuses);

const rows = db.prepare(`
  SELECT rowid, tool_name, status, input
  FROM tool_calls
  WHERE input LIKE '%vite.config.js%' OR input LIKE '%server.js%'
  ORDER BY rowid ASC
`).all();
console.log(`--- vite/server rows: ${rows.length} ---`);
for (const r of rows) {
  let input;
  try { input = JSON.parse(r.input); } catch { input = { RAW: String(r.input).slice(0, 100) }; }
  if (input.path && !String(input.path).includes('vite.config') && !String(input.path).includes('server')) continue;
  console.log(`rowid=${r.rowid} ${r.tool_name} status=${r.status} path=${input.path}`);
  if (r.tool_name === 'apply_diff') {
    console.log(`   search=${JSON.stringify((input.search || '').slice(0, 120))}`);
    console.log(`   replace=${JSON.stringify((input.replace || '').slice(0, 160))}`);
  } else if (r.tool_name === 'write_file') {
    console.log(`   content head=${JSON.stringify((input.content || '').slice(0, 120))} len=${(input.content||'').length}`);
  } else {
    console.log(`   keys=${Object.keys(input).join(',')}`);
  }
}
db.close();
