/**
 * P4 superset proof: a new project whose deps are a SUPERSET of a cached set
 * should seed from it and only fetch the delta.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const runtimeBridge = require(path.join(__dirname, '..', 'backend', 'services', 'runtimeBridge'));

const cacheDir = path.join(os.tmpdir(), 'aidost-deps-cache', '6fa8ab4d24b09092');
const manifest = JSON.parse(fs.readFileSync(path.join(cacheDir, 'manifest.json'), 'utf8'));

(async () => {
  console.log('=== P4: superset seeding ===\n');

  // The new project needs everything in the cache PLUS two new packages.
  const pkg = {
    name: 'superset-test', version: '1.0.0',
    dependencies: {
      ...manifest.dependencies,
      'is-odd': '3.0.1',           // ← the delta
      'left-pad': '1.3.0',         // ← the delta
    },
    devDependencies: { ...manifest.devDependencies },
  };

  const needed = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
  console.log(`needed: ${needed.length} packages (cache covers ${needed.length - 2})\n`);

  const candidate = runtimeBridge.findCacheCandidate(pkg);
  console.log(`findCacheCandidate: ${candidate ? `${candidate.signature} coverage=${Math.round(candidate.coverage * 100)}%` : 'none'}`);
  if (!candidate) { console.log('FAIL: no candidate found'); process.exit(1); }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-superset-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));

  const logs = [];
  const t0 = Date.now();
  const res = await runtimeBridge.installDependencies(dir, { onLog: m => logs.push(m) });
  const ms = Date.now() - t0;

  for (const m of logs) console.log('  ' + m);
  console.log(`\n⏱ install took ${(ms / 1000).toFixed(1)}s  cacheHit=${res.cacheHit} coverage=${res.coverage ? Math.round(res.coverage * 100) + '%' : 'exact'}`);
  console.log(`ok=${res.ok}`);
  console.log(`is-odd installed: ${fs.existsSync(path.join(dir, 'node_modules', 'is-odd'))}`);
  console.log(`left-pad installed: ${fs.existsSync(path.join(dir, 'node_modules', 'left-pad'))}`);
  console.log(`vite present: ${fs.existsSync(path.join(dir, 'node_modules', 'vite'))}`);

  console.log(`\n=== VERDICT ===`);
  console.log(`superset install: ${(ms / 1000).toFixed(1)}s vs cold ~218s → ~${Math.round(218 / Math.max(1, ms / 1000))}x`);

  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(res.ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });