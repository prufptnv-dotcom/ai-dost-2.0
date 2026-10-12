// Dump @monaco-editor/react Editor.tsx (from source map) — lines 40..260
const fs = require('fs');
const map = JSON.parse(fs.readFileSync(
  'C:/Users/vikash kumar/Pictures/ai dost 3.0/frontend/node_modules/@monaco-editor/react/dist/index.mjs.map',
  'utf8'
));
const src = map.sourcesContent[map.sources.findIndex(s => s.endsWith('Editor/Editor.tsx'))];
const lines = src.split('\n');
// print targeted ranges: mount/value/subscription/dispose
const ranges = [[40, 135], [190, 260]];
for (const [a, b] of ranges) {
  console.log(`\n=== Editor.tsx ${a}-${b} ===`);
  for (let i = a - 1; i < b && i < lines.length; i++) console.log(`${i + 1}: ${lines[i]}`);
}
