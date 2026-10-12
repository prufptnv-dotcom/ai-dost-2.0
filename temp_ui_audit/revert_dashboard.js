const fs = require('fs');
const f = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/frontend/pages/dashboard.jsx';
let s = fs.readFileSync(f, 'utf8');
const inserted = `      <section data-smoke="1">
        <div id="smoke-content" className="text-2xl font-bold">SMOKE RENDERED OK</div>
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400">Welcome back. Select a project to get started.</p>
      </section>`;
const original = `      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-400">Welcome back. Select a project to get started.</p>`;
if (!s.includes(inserted)) {
  console.log('PATTERN MISS — current file:');
  console.log(s);
} else {
  s = s.replace(inserted, original);
  fs.writeFileSync(f, s);
  console.log('dashboard.js reverted: ' + (s.includes('smoke') ? 'SMOKE LEFTOVER!' : 'clean'));
}
