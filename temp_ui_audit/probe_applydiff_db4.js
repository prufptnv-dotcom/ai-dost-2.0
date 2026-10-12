// Forensic probe 4: wall-clock times for vite.config.js-related rows
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/app.db');

const rows = db.prepare(`
  SELECT rowid, tool_name, status, step_id, input FROM tool_calls
  WHERE tool_name='run_terminal' OR input LIKE '%vite.config.js%'
  ORDER BY rowid ASC
`).all();

const fmt = (ms) => new Date(ms).toLocaleString('en-US', { hour12: true });
for (const r of rows) {
  const m = String(r.step_id || '').match(/step_(\d{13})/);
  const t = m ? fmt(Number(m[1])) : 'no-epoch';
  let input; try { input = JSON.parse(r.input); } catch { input = {}; }
  console.log(`${String(r.rowid).padStart(4)} ${t.padEnd(22)} ${r.tool_name.padEnd(15)} ${r.status.padEnd(10)} ${input.path || (input.command ? 'cmd:' + String(input.command).slice(0, 60) : '')}`);
}
db.close();
