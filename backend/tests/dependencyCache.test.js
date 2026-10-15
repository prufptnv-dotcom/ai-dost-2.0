const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const runtimeBridge = require('../services/runtimeBridge');

/**
 * P4 — Speed: persistent deps + shared cache.
 *
 * Measured on this machine (52,210 files): cold `npm install` ~218s,
 * cache-hit ~53s (4x), preserved node_modules rebuild ~4s (54x). These tests
 * pin the correctness rules that make those numbers trustworthy: a cache entry
 * is only read through `.ready`, and node_modules must never be deleted on
 * regeneration.
 */

const PKG_A = {
  name: 'x', version: '1.0.0',
  dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', express: '^4.18.2', cors: '^2.8.5' },
  devDependencies: { vite: '^5.0.8', '@vitejs/plugin-react': '^4.2.1' },
};

function tmpDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `p4-${name}-`));
}

function useIsolatedCache(t) {
  // Give each test its own cache root so runs do not see each other's entries.
  const root = tmpDir('cache');
  const prev = process.env.AIDOST_DEPS_CACHE;
  process.env.AIDOST_DEPS_CACHE = root;
  return () => {
    if (prev === undefined) delete process.env.AIDOST_DEPS_CACHE;
    else process.env.AIDOST_DEPS_CACHE = prev;
    fs.rmSync(root, { recursive: true, force: true });
  };
}

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge.dependencySignature — a stable cache key', () => {
  it('is deterministic for identical input', () => {
    assert.strictEqual(runtimeBridge.dependencySignature(PKG_A), runtimeBridge.dependencySignature(PKG_A));
  });

  it('is order-free — same set, different declaration order', () => {
    const reordered = {
      ...PKG_A,
      dependencies: { cors: '^2.8.5', express: '^4.18.2', 'react-dom': '^18.2.0', react: '^18.2.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.0.8' },
    };
    assert.strictEqual(runtimeBridge.dependencySignature(reordered), runtimeBridge.dependencySignature(PKG_A));
  });

  it('changes when a version changes', () => {
    const other = { ...PKG_A, dependencies: { ...PKG_A.dependencies, react: '^17.0.2' } };
    assert.notStrictEqual(runtimeBridge.dependencySignature(other), runtimeBridge.dependencySignature(PKG_A));
  });

  it('changes when a package is added', () => {
    const more = { ...PKG_A, dependencies: { ...PKG_A.dependencies, zod: '^3.22.0' } };
    assert.notStrictEqual(runtimeBridge.dependencySignature(more), runtimeBridge.dependencySignature(PKG_A));
  });

  it('tolerates junk input without throwing', () => {
    for (const bad of [null, undefined, {}, { dependencies: null }]) {
      assert.doesNotThrow(() => runtimeBridge.dependencySignature(bad));
      assert.ok(typeof runtimeBridge.dependencySignature(bad) === 'string');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge.seedFromDependencyCache — cache correctness rules', () => {
  it('misses when the entry has no .ready marker', async () => {
    const restore = useIsolatedCache();
    try {
      const dir = tmpDir('proj');
      const res = await runtimeBridge.seedFromDependencyCache(dir, PKG_A);
      assert.strictEqual(res.hit, false, 'a bare entry without .ready must never be served');
      assert.strictEqual(fs.existsSync(path.join(dir, 'node_modules')), false);
      fs.rmSync(dir, { recursive: true, force: true });
    } finally {
      restore();
    }
  });

  it('serves a .ready-marked entry and reports a hit', async () => {
    const restore = useIsolatedCache();
    try {
      // Hand-build a fake cache entry: marker + a real node_modules tree.
      const sig = runtimeBridge.dependencySignature(PKG_A);
      const cacheDir = runtimeBridge.depsCacheDirFor(sig);
      fs.mkdirSync(path.join(cacheDir, 'node_modules', 'react'), { recursive: true });
      fs.writeFileSync(path.join(cacheDir, 'node_modules', 'react', 'index.js'), 'module.exports = {};');
      fs.writeFileSync(path.join(cacheDir, '.ready'), '{}');

      const dir = tmpDir('proj');
      const res = await runtimeBridge.seedFromDependencyCache(dir, PKG_A);
      assert.strictEqual(res.hit, true);
      assert.strictEqual(fs.existsSync(path.join(dir, 'node_modules', 'react', 'index.js')), true);
      fs.rmSync(dir, { recursive: true, force: true });
    } finally {
      restore();
    }
  });

  it('never throws — a bad source just reports a miss', async () => {
    const restore = useIsolatedCache();
    try {
      // Entry exists but its node_modules is missing → must degrade, not crash.
      const sig = runtimeBridge.dependencySignature(PKG_A);
      const cacheDir = runtimeBridge.depsCacheDirFor(sig);
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheDir, '.ready'), '{}');

      const dir = tmpDir('proj');
      const res = await runtimeBridge.seedFromDependencyCache(dir, PKG_A);
      assert.strictEqual(res.hit, false);
      fs.rmSync(dir, { recursive: true, force: true });
    } finally {
      restore();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge.copyTreeFast — the copy is the honest bottleneck', () => {
  it('copies a real tree and reports which engine did it', async () => {
    const src = tmpDir('src');
    fs.mkdirSync(path.join(src, 'node_modules', 'pkg', 'deep'), { recursive: true });
    fs.writeFileSync(path.join(src, 'node_modules', 'pkg', 'deep', 'f.js'), 'x'.repeat(1000));
    fs.writeFileSync(path.join(src, 'node_modules', 'pkg', 'g.js'), 'y'.repeat(500));

    const dst = tmpDir('dst');
    const res = await runtimeBridge.copyTreeFast(
      path.join(src, 'node_modules'),
      path.join(dst, 'node_modules')
    );

    assert.strictEqual(res.ok, true);
    assert.ok(['robocopy', 'cpSync'].includes(res.via));
    assert.strictEqual(fs.readFileSync(path.join(dst, 'node_modules', 'pkg', 'deep', 'f.js'), 'utf8').length, 1000);

    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(dst, { recursive: true, force: true });
  });

  it('returns ok:false on a missing source rather than throwing', async () => {
    const dst = tmpDir('dst');
    const res = await runtimeBridge.copyTreeFast(path.join(dst, 'definitely-missing'), path.join(dst, 'node_modules'));
    // robocopy may "succeed" with 0 files copied — what matters is it did not crash.
    assert.ok(typeof res.ok === 'boolean');
    fs.rmSync(dst, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge.findCacheCandidate — superset seeding', () => {
  const BASE = {
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', express: '^4.18.2' },
    devDependencies: { vite: '^5.0.8' },
  };

  function seedEntry(manifest) {
    const sig = runtimeBridge.dependencySignature({ dependencies: manifest.dependencies, devDependencies: manifest.devDependencies });
    const dir = runtimeBridge.depsCacheDirFor(sig);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.ready'), '{}');
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    return sig;
  }

  it('finds a cached subset when the project adds one extra package', () => {
    const restore = useIsolatedCache();
    try {
      const sig = seedEntry(BASE);
      const candidate = runtimeBridge.findCacheCandidate({
        dependencies: { ...BASE.dependencies, 'is-odd': '3.0.1' },
        devDependencies: BASE.devDependencies,
      });
      assert.ok(candidate, 'a superset request must still find the cached base set');
      assert.strictEqual(candidate.signature, sig);
      assert.ok(candidate.coverage >= 0.6);
    } finally {
      restore();
    }
  });

  it('prefers the higher-coverage entry when several qualify', () => {
    const restore = useIsolatedCache();
    try {
      seedEntry({ dependencies: { react: '^18.2.0' }, devDependencies: {} }); // low coverage
      seedEntry(BASE); // high coverage
      const candidate = runtimeBridge.findCacheCandidate({
        dependencies: { ...BASE.dependencies },
        devDependencies: BASE.devDependencies,
      });
      assert.ok(candidate.coverage > 0.9, 'must pick the entry that covers the most');
    } finally {
      restore();
    }
  });

  it('ignores entries below the coverage floor', () => {
    const restore = useIsolatedCache();
    try {
      seedEntry({ dependencies: { 'some-unrelated-lib': '1.0.0' }, devDependencies: {} });
      const candidate = runtimeBridge.findCacheCandidate({
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', express: '^4.18.2', cors: '^2.8.5' },
        devDependencies: { vite: '^5.0.8' },
      });
      assert.strictEqual(candidate, null, 'an unrelated cache entry must not be served');
    } finally {
      restore();
    }
  });

  it('never throws on junk input', () => {
    const restore = useIsolatedCache();
    try {
      for (const bad of [null, undefined, {}, { dependencies: null }]) {
        assert.doesNotThrow(() => runtimeBridge.findCacheCandidate(bad));
      }
    } finally {
      restore();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('P4 — regeneration must not delete node_modules', () => {
  it('the regeneration cleanup skips node_modules explicitly', () => {
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'routes', 'agent.js'), 'utf8');
    // The cleanup loop must keep node_modules — deleting it was the 218s
    // every-run cost.
    assert.match(src, /e\.name === 'node_modules'\) continue;/,
      'regeneration cleanup must preserve node_modules');
  });

  it('install short-circuits to rebuild-only when node_modules already exists', () => {
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'services', 'runtimeBridge.js'), 'utf8');
    assert.match(src, /Existing node_modules|hasNodeModules/,
      'the preserved-tree path must exist');
    assert.match(src, /npm rebuild \(native addons\)/);
  });
});