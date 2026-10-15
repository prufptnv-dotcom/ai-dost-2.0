// Revert all instrumentation inserted by instrument_next.js + instrument_next2.js
const fs = require('fs');
const f = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/frontend/node_modules/next/dist/client/index.js';
let s = fs.readFileSync(f, 'utf8');

// reversed pairs: [inserted, original]
const swaps = [
  ["async function initialize(opts = {}) {\n    console.log('[DBG] initialize called');",
   'async function initialize(opts = {}) {'],
  ["async function hydrate(opts) {\n    console.log('[DBG] hydrate start');\n    let initialErr = initialData.err;",
   'async function hydrate(opts) {\n    let initialErr = initialData.err;'],
  ["console.log('[DBG] _app entry OK');\n        const { component: app, exports: mod } = appEntrypoint;",
   'const { component: app, exports: mod } = appEntrypoint;'],
  ["CachedComponent = pageEntrypoint.component;\n        console.log('[DBG] page entry OK');",
   'CachedComponent = pageEntrypoint.component;'],
  ["initialErr = (0, _iserror.getProperError)(error);\n        console.log('[DBG] hydrate caught: ' + initialErr.message);",
   'initialErr = (0, _iserror.getProperError)(error);'],
  ["console.log('[DBG] before preloadready, ids=' + JSON.stringify(initialData.dynamicIds));\n    if (window.__NEXT_PRELOADREADY) {",
   'if (window.__NEXT_PRELOADREADY) {'],
  ["console.log('[DBG] createRouter');\n    router = (0, _router.createRouter)(initialData.page",
   'router = (0, _router.createRouter)(initialData.page'],
  ["    console.log('[DBG] calling render');\n    render(renderCtx);\n}",
   '    render(renderCtx);\n}'],
  ["    console.log('[DBG] awaiting middleware promise...');\n    initialMatchesMiddleware = await router._initialMatchesMiddlewarePromise;\n    console.log('[DBG] middleware resolved: ' + String(initialMatchesMiddleware));",
   '    initialMatchesMiddleware = await router._initialMatchesMiddlewarePromise;'],
  ["    console.log('[DBG] has beforeRender: ' + String(!!opts?.beforeRender));\n    if (opts?.beforeRender) {\n        await opts.beforeRender();\n        console.log('[DBG] beforeRender done');\n    }",
   '    if (opts?.beforeRender) {\n        await opts.beforeRender();\n    }'],
];

let removed = 0, missed = [];
for (const [inserted, original] of swaps) {
  if (!s.includes(inserted)) { missed.push(inserted.slice(0, 45)); continue; }
  s = s.replace(inserted, original);
  removed++;
}
fs.writeFileSync(f, s);
const leftover = (s.match(/\[DBG\]/g) || []).length;
console.log('removed: ' + removed + '/10, leftover DBG markers: ' + leftover);
if (missed.length) console.log('missed: ' + JSON.stringify(missed));
