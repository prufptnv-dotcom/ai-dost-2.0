'use strict';
// one-off: exact analysis of rejected write contents (escaping + line 117)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const BE = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/backend';
const db = new DatabaseSync(path.join(BE, 'data', 'app.db'), { readOnly: true });
const ids = ['step_1791555878273_d33246da', 'step_1791555878386_1e7e8902'];
const rows = db.prepare('SELECT step_id, input FROM tool_calls WHERE step_id IN (?,?)').all(...ids);
for (const r of rows) {
  const parsed = JSON.parse(r.input); // layer 1: stored JSON
  const c = parsed.content;
  console.log(`\n=== ${parsed.path} (step ${r.step_id}) ===`);
  console.log('stored-input length:', r.input.length, '| content length:', c.length);
  console.log('content line count:', c.split('\n').length);
  console.log('first 120 chars RAW:', JSON.stringify(c.slice(0, 120)));
  console.log('has literal backslash-n:', c.includes('\\n') && !c.includes('\n'));
  const lines = c.split('\n');
  console.log('line 115-119:');
  for (let i = 114; i < Math.min(119, lines.length); i++) console.log(`  ${i + 1}: ${JSON.stringify(lines[i])}`);
  // try parse as the guard would
  try { JSON.parse(c); console.log('JSON.parse: OK'); }
  catch (e) { console.log('JSON.parse FAIL:', e.message.slice(0, 120)); }
}
db.close();
