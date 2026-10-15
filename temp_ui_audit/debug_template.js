const acorn = require('../backend/node_modules/acorn');
const p = require('../backend/routes/preview');

const src = 'const tpl = `/src/main.jsx`;';
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
const decl = ast.body[0].declarations[0];
console.log('init type :', decl.init.type, 'start/end:', decl.init.start, decl.init.end);
console.log('quasis    :', decl.init.quasis.length, 'exprs:', decl.init.expressions.length);
console.log('quasi[0]  :', JSON.stringify({ start: decl.init.quasis[0].start, end: decl.init.quasis[0].end, raw: decl.init.quasis[0].value.raw }));
console.log('slice     :', JSON.stringify(src.slice(decl.init.start, decl.init.end)));
console.log('OUT       :', p.rewriteJsModule(src, '/api/preview/x'));
