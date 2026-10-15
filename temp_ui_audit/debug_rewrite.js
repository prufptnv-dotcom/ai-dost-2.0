const p = require('../backend/routes/preview');
const P = '/api/preview/x';

console.log('fn type:', typeof p.rewriteJsModule);

const cases = [
  'import App from "/src/App.jsx";',
  'const b = "/node_modules/.vite/deps/react.js?v=1";',
  'const c = ` /src/main.jsx `;',
  'const d = "/src/deep/real.jsx";',
];
for (const src of cases) {
  let out;
  try {
    out = p.rewriteJsModule(src, P);
  } catch (e) {
    out = 'THREW: ' + e.message;
  }
  console.log('IN :', src);
  console.log('OUT:', out);
}
