// Grep vite's server-side dist for ws upgrade attachment + token validation.
const fs = require('fs');
const path = require('path');

const dist = path.join(process.env.TEMP, 'agent-ws-p5-live', 'node_modules', 'vite', 'dist', 'node');
const patterns = [
  { name: 'upgrade listener', re: /\.on\(\s*['"]upgrade['"]/ },
  { name: 'wsToken/token gen', re: /wsToken|hmrToken|randomBytes\(/ },
  { name: 'handleUpgrade', re: /handleUpgrade/ },
  { name: 'verifyClient', re: /verifyClient/ },
];

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.js')) yield p;
  }
}

const hits = {};
for (const p of walk(dist)) {
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of patterns) {
      if (re.test(line)) {
        (hits[name] = hits[name] || []).push({ f: path.basename(p), l: i + 1, t: line.trim().slice(0, 230) });
      }
    }
  });
}
for (const { name } of patterns) {
  console.log(`=== ${name} ===`);
  (hits[name] || []).slice(0, 5).forEach((h) => console.log(`  ${h.f}:${h.l}\n    ${h.t}`));
  if (!hits[name]) console.log('  (none)');
}
