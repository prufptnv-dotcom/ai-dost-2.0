const { describe, it } = require('node:test');
const assert = require('node:assert');

const devServerManager = require('../sandbox/devServerManager');
const ensureViteHostScripts = devServerManager.ensureViteHostScripts;

describe('devServerManager.ensureViteHostScripts — vite host binding normalization', () => {
  it('adds --host 0.0.0.0 to plain vite dev script', () => {
    const pkg = { scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' } };
    const res = ensureViteHostScripts(pkg);
    assert.strictEqual(res.changed, true);
    assert.deepStrictEqual(res.updated, ['dev']);
    assert.strictEqual(pkg.scripts.dev, 'vite --host 0.0.0.0');
    assert.strictEqual(pkg.scripts.build, 'vite build');
    assert.strictEqual(pkg.scripts.preview, 'vite preview');
  });

  it('normalizes nested dev scripts behind concurrently meta-runner', () => {
    const pkg = {
      scripts: {
        dev: 'concurrently -n api,web "npm:dev:server" "npm:dev:client"',
        'dev:server': 'node server.js',
        'dev:client': 'vite',
        build: 'vite build'
      }
    };
    const res = ensureViteHostScripts(pkg);
    assert.strictEqual(res.changed, true);
    assert.deepStrictEqual(res.updated, ['dev:client']);
    assert.strictEqual(pkg.scripts['dev:client'], 'vite --host 0.0.0.0');
    assert.strictEqual(pkg.scripts.dev, 'concurrently -n api,web "npm:dev:server" "npm:dev:client"');
    assert.strictEqual(pkg.scripts['dev:server'], 'node server.js');
  });

  it('skips scripts that already carry --host', () => {
    const pkg = { scripts: { dev: 'vite --host 0.0.0.0' } };
    const res = ensureViteHostScripts(pkg);
    assert.strictEqual(res.changed, false);
    assert.strictEqual(pkg.scripts.dev, 'vite --host 0.0.0.0');
  });

  it('skips non-vite and non-dev commands', () => {
    const pkg = {
      scripts: {
        dev: 'next dev',
        start: 'node server.js',
        test: 'jest',
        'dev:svelte': 'vite dev'
      }
    };
    const res = ensureViteHostScripts(pkg);
    assert.strictEqual(res.changed, true);
    assert.deepStrictEqual(res.updated, ['dev:svelte']);
    assert.strictEqual(pkg.scripts['dev:svelte'], 'vite dev --host 0.0.0.0');
    assert.strictEqual(pkg.scripts.dev, 'next dev');
    assert.strictEqual(pkg.scripts.start, 'node server.js');
  });

  it('handles vite bin path invocation (node node_modules/vite/bin/vite.js)', () => {
    const pkg = { scripts: { dev: 'node node_modules/vite/bin/vite.js --port 4000' } };
    const res = ensureViteHostScripts(pkg);
    assert.strictEqual(res.changed, true);
    assert.ok(pkg.scripts.dev.endsWith('--host 0.0.0.0'));
  });

  it('is a no-op for missing scripts or non-string values', () => {
    assert.strictEqual(ensureViteHostScripts(null).changed, false);
    assert.strictEqual(ensureViteHostScripts({}).changed, false);
    assert.strictEqual(ensureViteHostScripts({ scripts: { dev: 123 } }).changed, false);
  });
});
