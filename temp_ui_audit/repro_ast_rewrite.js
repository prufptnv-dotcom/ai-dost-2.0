// Reproduce the AST rewrite on the exact regression input.
const p = require('../backend/routes/preview');
const P = '/api/preview/demo-app';

const js = [
  'var duotonePathRe = [/path d="([^"]+)".*path d="([^"]+)"/g, { wrap: 1 }];',
  'esc(str.replace(/"/g, "&quot;").replace(/\'/g, "&#39;"));',
  'el.render(/* @__PURE__ */ jsxDEV(App, {}, void 0));',
  'if (/^\\/api\\//.test(p)) return "/api/keep";',
  'const x = fetch("/api/tasks") + "//cdn.x/y.js" + "/";',
].join('\n');

const out = p.rewriteJsModule(js, P);
const oldLines = js.split('\n');
const newLines = out.split('\n');
console.log(out === js ? 'IDENTICAL' : 'CHANGED');
newLines.forEach((l, i) => {
  if (l !== oldLines[i]) {
    console.log(`L${i + 1} OLD: ${oldLines[i]}`);
    console.log(`L${i + 1} NEW: ${l}`);
  }
});

try {
  require('../backend/node_modules/acorn').parse(out, { ecmaVersion: 'latest', sourceType: 'module' });
  console.log('OUT PARSES OK');
} catch (e) {
  console.log('OUT PARSE FAIL:', e.message);
}
