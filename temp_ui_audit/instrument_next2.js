const fs = require('fs');
const f = 'C:/Users/vikash kumar/Pictures/ai dost 3.0/frontend/node_modules/next/dist/client/index.js';
let s = fs.readFileSync(f, 'utf8');
const swaps = [
  ['    initialMatchesMiddleware = await router._initialMatchesMiddlewarePromise;',
   "    console.log('[DBG] awaiting middleware promise...');\n    initialMatchesMiddleware = await router._initialMatchesMiddlewarePromise;\n    console.log('[DBG] middleware resolved: ' + String(initialMatchesMiddleware));"],
  ['    if (opts?.beforeRender) {\n        await opts.beforeRender();\n    }',
   "    console.log('[DBG] has beforeRender: ' + String(!!opts?.beforeRender));\n    if (opts?.beforeRender) {\n        await opts.beforeRender();\n        console.log('[DBG] beforeRender done');\n    }"],
];
let done = 0;
for (const [a, b] of swaps) {
  if (!s.includes(a)) { console.log('MISS: ' + a.slice(0, 60)); continue; }
  if (s.includes(b.slice(0, 50))) { console.log('ALREADY'); continue; }
  s = s.replace(a, b); done++;
}
fs.writeFileSync(f, s);
console.log('inserted: ' + done + '/2');
