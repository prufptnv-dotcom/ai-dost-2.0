const fs = require('fs');
const path = require('path');
const root = 'C:\\Users\\vikash kumar\\Pictures\\ai dost 3.0\\frontend';
const files = [
  path.join(root, 'styles', 'globals.css'),
  path.join(root, 'styles', 'tokens.css'),
  path.join(root, 'styles', 'chat-ux.css'),
  path.join(root, 'styles', 'markdown.css'),
];
const map = {
  '#1ba1e2': '#e8935f',
  '#4285f4': '#d97757',
  '#9b72cb': '#e8b45f',
  '#d96570': '#e5736e',
  '#4893fc': '#d97757',
  'rgba(66, 133, 244': 'rgba(217, 119, 87',
  'rgba(155, 114, 203': 'rgba(232, 180, 95',
  'rgba(72, 147, 252': 'rgba(217, 119, 87',
  'rgba(27, 161, 226': 'rgba(232, 147, 95',
  'rgba(217, 101, 112': 'rgba(229, 115, 110',
  '#1e3a8a': '#8a4526',
  '#1a73e8': '#c1623f',
};
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('missing', f); continue; }
  const before = fs.readFileSync(f, 'utf8');
  let s = before;
  for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
  if (s !== before) { fs.writeFileSync(f, s, 'utf8'); console.log('updated', path.basename(f)); }
  else console.log('no change', path.basename(f));
}
