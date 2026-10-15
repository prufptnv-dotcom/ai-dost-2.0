const fs = require('fs');
const path = require('path');
const root = 'C:\\Users\\vikash kumar\\Pictures\\ai dost 3.0\\frontend\\components';
const files = [
  path.join(root, 'agent', 'CrewPanel.jsx'),
  path.join(root, 'brand', 'AiDostMark.jsx'),
  path.join(root, 'public', 'DocsLayout.jsx'),
  path.join(root, 'public', 'PublicFooter.jsx'),
  path.join(root, 'public', 'PublicNavbar.jsx'),
  path.join(root, 'public', 'PublicLayout.jsx'),
];
const map = {
  '#1ba1e2': '#e8935f',
  '#4285f4': '#d97757',
  '#9b72cb': '#e8b45f',
  '#d96570': '#e5736e',
  '#4893fc': '#d97757',
  'rgba(66,133,244': 'rgba(217,119,87',
  'rgba(66, 133, 244': 'rgba(217, 119, 87',
};
for (const f of files) {
  if (!fs.existsSync(f)) { console.log('missing', f); continue; }
  const before = fs.readFileSync(f, 'utf8');
  let s = before;
  for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
  if (s !== before) { fs.writeFileSync(f, s, 'utf8'); console.log('updated', path.basename(f)); }
  else console.log('no change', path.basename(f));
}
