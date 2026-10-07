// Find which proxied module got corrupted by the URL rewrite.
const acorn = require('../backend/node_modules/acorn');
const P = '/api/preview/p5-live';

const FILES = ['/src/main.jsx', '/src/App.jsx', '/src/index.css', '/src/services/api.js', '/@vite/client', '/@react-refresh'];

(async () => {
  for (const f of FILES) {
    const res = await fetch(`http://localhost:5000${P}${f}`);
    const text = await res.text();
    const ctype = res.headers.get('content-type') || '';
    if (!/javascript/.test(ctype)) { console.log(`${f} -> ${res.status} (${ctype}) skipped`); continue; }
    try {
      acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
      console.log(`${f} -> ${res.status} PARSE OK (${text.length}B)`);
    } catch (e) {
      console.log(`${f} -> ${res.status} PARSE FAIL: ${e.message}`);
      const line = text.split('\n')[(e.loc ? e.loc.line : 1) - 1] || '';
      console.log(`   line ${e.loc ? e.loc.line : '?'}: ${line.slice(0, 300)}`);
      // show every rewrite marker with 60 chars of context
      let idx = -1;
      while ((idx = text.indexOf(P, idx + 1)) !== -1) {
        const before = text.slice(Math.max(0, idx - 70), idx);
        if (!/["'`]$/.test(before.trimEnd()) && !/url\(\s*['"]?$/.test(before)) {
          // not obviously in a string — print for review only on FAIL
        }
      }
    }
  }
})();
