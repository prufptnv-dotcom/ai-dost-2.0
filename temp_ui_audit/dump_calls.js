'use strict';
// one-off: dump tool_call inputs for the rejected writes
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const BE = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/backend';
const db = new DatabaseSync(path.join(BE, 'data', 'app.db'), { readOnly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
const tcTable = tables.find(t => /tool_call/i.test(t)) || 'tool_calls';
const cols = db.prepare(`PRAGMA table_info(${tcTable})`).all().map(c => c.name);
console.log('table:', tcTable, 'cols:', cols.join(','));

// our failing step ids
const ids = [
  'step_1791555878273_d33246da', // WASM json pos1 — package.json?
  'step_1791555878386_1e7e8902', // WASM invalid token line 117 — server?
  'step_1791555878312_8e2aedd1', // WRITE_FORBIDDEN App.jsx
];
const rows = db.prepare(`SELECT * FROM ${tcTable} WHERE step_id IN (?,?,?)`).all(...ids);
for (const r of rows) {
  console.log('\n=== step', r.step_id, 'tool:', r.tool_name || r.toolName, '===');
  let inp = r.input || r.arguments || r.params;
  try { inp = typeof inp === 'string' ? inp : JSON.stringify(inp); } catch { inp = String(inp); }
  console.log(String(inp).slice(0, 900));
}
// also: which file paths were attempted recently
const all = db.prepare(`SELECT step_id, tool_name, input, created_at FROM ${tcTable} WHERE created_at >= '2026-10-09 14:23' ORDER BY rowid ASC`).all();
console.log(`\n--- all recent tool calls: ${all.length} ---`);
for (const r of all) {
  let inp = r.input;
  try { inp = typeof inp === 'string' ? inp : JSON.stringify(inp); } catch { inp = String(inp); }
  const m = String(inp).match(/"path":"([^"]+)"|"filePath":"([^"]+)"|"file_path":"([^"]+)"/);
  console.log(r.created_at, r.step_id, r.tool_name, '->', m ? (m[1] || m[2] || m[3]) : String(inp).slice(0, 80));
}
db.close();
