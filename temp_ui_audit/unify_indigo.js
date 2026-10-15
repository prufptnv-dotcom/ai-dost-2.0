// Unify the whole frontend on the indigo accent: map every leftover clay/warm
// hex from the earlier palette pass back onto the indigo system.
const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\vikash kumar\\Pictures\\ai dost 3.0\\frontend';

const targets = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'coverage', '.git'].includes(e.name)) continue;
      walk(full);
    } else if (/\.(jsx?|css)$/.test(e.name)) targets.push(full);
  }
};
walk(path.join(root, 'styles'));
walk(path.join(root, 'components'));
walk(path.join(root, 'pages'));

const MAP = [
  ['rgba(217, 119, 87', 'rgba(99, 102, 241'],
  ['rgba(217,119,87', 'rgba(99,102,241'],
  ['rgba(193, 98, 63', 'rgba(79, 70, 229'],
  ['rgba(193,98,63', 'rgba(79,70,229'],
  ['#d97757', '#6366f1'],
  ['#e8935f', '#818cf8'],
  ['#e8b45f', '#a5b4fc'],
  ['#e5736e', '#4f46e5'],
  ['#c1623f', '#4f46e5'],
  ['#a44e30', '#4338ca'],
];

let touched = 0;
for (const file of targets) {
  const before = fs.readFileSync(file, 'utf8');
  let after = before;
  for (const [from, to] of MAP) after = after.split(from).join(to);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    touched++;
    console.log('updated', path.relative(root, file));
  }
}
console.log(`\n${touched} files recoloured`);