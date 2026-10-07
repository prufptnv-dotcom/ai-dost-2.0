// Recursively fetch + parse every proxied module (import graph) to find corruption.
const acorn = require('../backend/node_modules/acorn');
const P = '/api/preview/p5-live';
const seen = new Set();
const queue = [`${P}/src/main.jsx`];
const misses = [];
let bad = 0;

function importsOf(code) {
  const out = [];
  const re = /(?:^|[\s;}])(?:import|export)\s*(?:[\s\S]*?from\s*)?["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(code))) out.push(m[1]);
  const dyn = /import\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = dyn.exec(code))) out.push(m[1]);
  return out;
}

(async () => {
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const res = await fetch(`http://localhost:5000${url}`);
    const text = await res.text();
    const ctype = res.headers.get('content-type') || '';
    if (res.status !== 200) { console.log(`HTTP ${res.status}  ${url}`); bad++; continue; }
    if (!/javascript/.test(ctype)) continue;
    try {
      acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
    } catch (e) {
      bad++;
      console.log(`PARSE FAIL  ${url}  :: ${e.message}`);
      const line = text.split('\n')[(e.loc ? e.loc.line : 1) - 1] || '';
      console.log(`   L${e.loc ? e.loc.line : '?'}: ${line.slice(0, 400)}`);
    }
    for (const spec of importsOf(text)) {
      if (/^(https?:)?\/\//.test(spec)) continue;      // external
      if (spec.startsWith('data:')) continue;
      const resolved = new URL(spec, `http://localhost:5000${url}`).pathname;
      if (!resolved.startsWith(P)) {
        // Root-absolute URL that did NOT get prefixed → rewrite miss (bug).
        misses.push(`${resolved}  (from ${url})`);
        continue;
      }
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  console.log(`\nscanned ${seen.size} module URL(s), ${bad} bad, ${misses.length} un-prefixed root-absolute import(s)`);
  [...new Set(misses)].slice(0, 20).forEach((m) => console.log(`   MISS: ${m}`));
})();
