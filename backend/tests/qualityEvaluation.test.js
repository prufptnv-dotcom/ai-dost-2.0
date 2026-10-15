'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '..', 'scripts', 'score-generated-app.js');

describe('generated-app quality diagnostic', () => {
  test('reports static signals as diagnostics and leaves behavior unevaluated', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-quality-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'App.jsx'), [
      'export function App() {',
      '  const [search, setSearch] = useState("");',
      '  return <main><label htmlFor="search">Search</label><input id="search" aria-label="Search" />',
      '  <button onClick={exportCsv}>Export CSV</button><p>{loading ? "Loading" : error ? "Error" : "Empty"}</p></main>;',
      '}',
    ].join('\n'));
    fs.writeFileSync(path.join(root, 'styles.css'), '@media (max-width: 768px) { main { width: 100%; } }');

    const result = spawnSync(process.execPath, [
      script,
      '--case', 'dashboard-search-charts-csv',
      '--project-dir', root,
    ], { encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, 'DIAGNOSTIC_ONLY');
    assert.equal(report.staticSignals.totalCount, 6);
    assert.ok(report.staticSignals.observedCount >= 4);
    assert.ok(report.requiredBehaviors.every((item) => item.status === 'NOT_EVALUATED'));
    assert.ok(report.limitations.some((item) => /does not execute code/i.test(item)));
  });

  test('rejects unknown cases and missing project directories', () => {
    const unknown = spawnSync(process.execPath, [
      script, '--case', 'not-a-real-case', '--project-dir', os.tmpdir(),
    ], { encoding: 'utf8' });
    assert.equal(unknown.status, 2);
    assert.match(unknown.stderr, /Unknown case/);

    const missing = spawnSync(process.execPath, [
      script, '--case', 'dashboard-search-charts-csv', '--project-dir', path.join(os.tmpdir(), 'missing-ai-dost-project'),
    ], { encoding: 'utf8' });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /does not exist/);
  });

  test('flags placeholder markers without converting them into a quality score', (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-dost-quality-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.writeFileSync(path.join(root, 'App.jsx'), '// TODO: wire the export button\nexport default function App() { return <main />; }');

    const result = spawnSync(process.execPath, [
      script, '--case', 'dashboard-search-charts-csv', '--project-dir', root,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.placeholderMarkers.count, 1);
    assert.equal(report.status, 'DIAGNOSTIC_ONLY');
    assert.equal(Object.hasOwn(report, 'qualityScore'), false);
  });
});
