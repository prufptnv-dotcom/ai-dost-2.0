import { resolveRootAlias, generateLiveAppHtml } from '../components/ide/PreviewEngine';

describe('resolveRootAlias', () => {
  it('aliases a non-App default export so <App /> resolves', () => {
    const { rootAlias, rootName } = resolveRootAlias(
      'export default function HomePage() { return <div/>; }',
      'function HomePage() { return <div/>; }'
    );
    expect(rootName).toBe('HomePage');
    expect(rootAlias).toBe(
      'const App = typeof HomePage !== \'undefined\' ? HomePage : undefined;'
    );
  });

  it('emits no alias when the workspace already declares App', () => {
    expect(resolveRootAlias('export default function App() {}', 'function App() {}'))
      .toEqual({ rootAlias: '', rootName: 'App' });
  });

  it('emits no alias for an anonymous default export (cleaned to App)', () => {
    const { rootAlias } = resolveRootAlias('export default function () {}', 'function App () {}');
    expect(rootAlias).toBe('');
  });

  it('emits no alias when there is no default export at all', () => {
    expect(resolveRootAlias('const A = () => null;', 'const A = () => null;').rootAlias).toBe('');
  });

  it('handles `export default Identifier;` re-exports', () => {
    const { rootAlias } = resolveRootAlias('function Dashboard() {}\nexport default Dashboard;', '');
    expect(rootAlias).toContain('typeof Dashboard');
  });

  it('handles `export default const` arrow components', () => {
    const { rootAlias } = resolveRootAlias('export default const TodoApp = () => null;', '');
    expect(rootAlias).toContain('typeof TodoApp');
  });

  it('handles `export default class` components', () => {
    const { rootAlias } = resolveRootAlias('export default class Shell {}', '');
    expect(rootAlias).toContain('typeof Shell');
  });

  it('never aliases onto a JavaScript keyword', () => {
    // `export default function ...` without a name must not capture `function`.
    const { rootAlias, rootName } = resolveRootAlias(
      'export default function HomePage() {}',
      'function App () {}'
    );
    expect(rootAlias).not.toContain('function;');
    expect(rootName).not.toBe('function');
  });
});

describe('generateLiveAppHtml (mount guard)', () => {
  const htmlFor = (src) => generateLiveAppHtml(
    [{ path: 'src/App.jsx' }],
    { 'src/App.jsx': src }
  );

  it('injects the alias for a HomePage entry instead of crashing on <App />', () => {
    const html = htmlFor('export default function HomePage() { return <div>hi</div>; }');
    expect(html).toContain('const App = typeof HomePage');
    expect(html).toContain('<App />');
  });

  it('does not inject a redundant alias when App is declared', () => {
    const html = htmlFor('export default function App() { return <div>hi</div>; }');
    expect(html).not.toContain('const App = typeof App');
  });

  it('always renders a readable card instead of an uncaught ReferenceError', () => {
    const html = htmlFor('export default function HomePage() { return <div/>; }');
    expect(html).toContain('typeof App === \'undefined\'');
    expect(html).toContain('Preview could not mount a root component');
    expect(html).toContain('Root component not found');
  });
});
