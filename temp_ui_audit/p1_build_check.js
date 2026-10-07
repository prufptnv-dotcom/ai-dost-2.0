// Stand-in "compiler" for the P1 repair-loop proof.
// Performs a real structural parse of src/App.jsx: tracks line numbers,
// strings, template literals and comments. Exits 1 with the offending line on
// an unbalanced construct, otherwise writes dist/index.html and exits 0.
const fs = require('fs');
const src = fs.readFileSync('src/App.jsx', 'utf8');

const pairs = { '(': ')', '{': '}', '[': ']' };
const openers = new Set(Object.keys(pairs));
const closers = new Set(Object.values(pairs));

const stack = [];
let line = 1;
let quote = null;
let lineComment = false;
let blockComment = false;

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  const n = src[i + 1] || '';

  if (c === '\n') { line++; lineComment = false; continue; }
  if (lineComment) continue;
  if (blockComment) {
    if (c === '*' && n === '/') { blockComment = false; i++; }
    continue;
  }
  if (!quote) {
    if (c === '/' && n === '/') { lineComment = true; i++; continue; }
    if (c === '/' && n === '*') { blockComment = true; i++; continue; }
  }

  if (quote) {
    if (c === '\\') { i++; continue; }
    if (c === quote) quote = null;
    continue;
  }

  if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
  if (openers.has(c)) { stack.push({ c, line }); continue; }
  if (closers.has(c)) {
    const last = stack.pop();
    if (!last || pairs[last.c] !== c) {
      console.error(`src/App.jsx:${line}: ERROR: Unexpected token '${c}'`);
      process.exit(1);
    }
  }
}

if (stack.length) {
  const last = stack[stack.length - 1];
  console.error(`src/App.jsx:${last.line}: ERROR: Unclosed '${last.c}'`);
  process.exit(1);
}

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync(
  'dist/index.html',
  '<!doctype html><html><body><div id="root"><h1>P1 REPAIRED</h1></div></body></html>'
);
console.log('built ok');