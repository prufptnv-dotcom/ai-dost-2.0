// Reproduce the empty-workspace preview mount failure.
import { generateLiveAppHtml, resolveRootAlias } from '../frontend/components/ide/PreviewEngine.js';

const cases = {
  'empty workspace': [[], {}],
  'index.html only': [[{ path: 'index.html', content: '<html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' }], {}],
  'App.jsx default fn': [[{ path: 'src/App.jsx', content: 'export default function App(){ return null; }' }], { 'src/App.jsx': 'export default function App(){ return null; }' }],
  'HomePage default': [[{ path: 'src/App.jsx', content: 'export default function HomePage(){ return null; }' }], { 'src/App.jsx': 'export default function HomePage(){ return null; }' }],
};

for (const [name, [files, contents]] of Object.entries(cases)) {
  const html = generateLiveAppHtml(files, contents, true);
  const hasGuard = html.includes("typeof App === 'undefined'");
  const hasAlias = html.includes('const App = typeof');
  const mounts = (html.match(/<App \/>/g) || []).length;
  const idx = html.indexOf('typeof App');
  console.log(`\n--- ${name} ---`);
  console.log(`guard=${hasGuard}  alias=${hasAlias}  <App/>count=${mounts}`);
  if (idx > -1) {
    console.log('mount region:\n' + html.slice(idx - 120, idx + 320).replace(/\n\s*\n/g, '\n'));
  } else {
    console.log('NO GUARD FOUND — mount would throw ReferenceError');
  }
}