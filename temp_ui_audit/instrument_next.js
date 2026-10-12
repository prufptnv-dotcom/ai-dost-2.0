// Temporary debug instrumentation of next/dist/client/index.js — REVERT after diagnosis.
const fs = require('fs');
const f = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/frontend/node_modules/next/dist/client/index.js';
let s = fs.readFileSync(f, 'utf8');

const swaps = [
  ['async function initialize(opts = {}) {',
   "async function initialize(opts = {}) {\n    console.log('[DBG] initialize called');"],
  ['async function hydrate(opts) {\n    let initialErr = initialData.err;',
   "async function hydrate(opts) {\n    console.log('[DBG] hydrate start');\n    let initialErr = initialData.err;"],
  ['const { component: app, exports: mod } = appEntrypoint;',
   "console.log('[DBG] _app entry OK');\n        const { component: app, exports: mod } = appEntrypoint;"],
  ['CachedComponent = pageEntrypoint.component;',
   "CachedComponent = pageEntrypoint.component;\n        console.log('[DBG] page entry OK');"],
  ['initialErr = (0, _iserror.getProperError)(error);',
   "initialErr = (0, _iserror.getProperError)(error);\n        console.log('[DBG] hydrate caught: ' + initialErr.message);"],
  ['if (window.__NEXT_PRELOADREADY) {',
   "console.log('[DBG] before preloadready, ids=' + JSON.stringify(initialData.dynamicIds));\n    if (window.__NEXT_PRELOADREADY) {"],
  ['router = (0, _router.createRouter)(initialData.page',
   "console.log('[DBG] createRouter');\n    router = (0, _router.createRouter)(initialData.page"],
  ['    render(renderCtx);\n}',
   "    console.log('[DBG] calling render');\n    render(renderCtx);\n}"],
];

let done = 0;
for (const [a, b] of swaps) {
  if (!s.includes(a)) { console.log('MISS: ' + a.slice(0, 50)); continue; }
  if (s.includes(b.slice(0, 60))) { console.log('ALREADY: ' + a.slice(0, 40)); continue; }
  s = s.replace(a, b);
  done++;
}
fs.writeFileSync(f, s);
console.log('inserted markers: ' + done + '/' + swaps.length);
