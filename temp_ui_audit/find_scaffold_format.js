// One-off: find where scaffold/agent prompts specify their output format (JSON vs FILE:)
const fs = require('fs');
const src = fs.readFileSync('C:/Users/vikash kumar/Pictures/ai dost 3.0/backend/routes/agent.js', 'utf8');
const pats = [
  'JSON object with',
  'respond with JSON',
  'Return a JSON',
  'strict JSON',
  '"files"',
  'ONLY valid JSON',
  'valid JSON',
  'FILE: path',
  'files array',
  'array of files',
];
for (const p of pats) {
  let i = -1;
  let n = 0;
  while ((i = src.indexOf(p, i + 1)) !== -1 && n < 3) {
    const line = src.slice(0, i).split('\n').length;
    console.log(`=== [${p}] line ${line}`);
    console.log(src.slice(Math.max(0, i - 240), i + 280).replace(/\n/g, ' '));
    console.log();
    n++;
  }
}
