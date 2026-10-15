/**
 * P4 proof: the 218s problem.
 *
 * 1. Seed the dependency cache from an EXISTING golden workspace that already
 *    ran a real install (p3-dedup).
 * 2. A brand-new project with the same dependency set gets a cache hit —
 *    measure how long install takes versus a cold install.
 * 3. Regeneration path: node_modules survives, so install is a rebuild.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const runtimeBridge = require(path.join(__dirname, '..', 'backend', 'services', 'runtimeBridge'));

const existingWs = path.join(os.tmpdir(), 'agent-ws-p3-dedup');

(async () => {
  console.log('=== P4: dependency cache timing proof ===\n');

  if (!fs.existsSync(path.join(existingWs, 'node_modules'))) {
    console.log(`SKIP: ${existingWs} has no node_modules (run a scaffold first)`);
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(existingWs, 'package.json'), 'utf8'));
  const sig = runtimeBridge.dependencySignature(pkg);
  console.log(`dependency signature: ${sig}`);
  console.log(`deps: ${Object.keys(pkg.dependencies || {}).length} + ${Object.keys(pkg.devDependencies || {}).length} dev\n`);

  // ── STEP 1: snapshot the existing install into the cache ─────────────────
  console.log('STEP 1: recording cache from existing install…');
  let t0 = Date.now();
  runtimeBridge.recordDependencyCache(existingWs, pkg);
  // recordDependencyCache is fire-and-forget; wait for the marker.
  const ready = path.join(runtimeBridge.depsCacheDirFor(sig), '.ready');
  for (let i = 0; i < 600 && !fs.existsSync(ready); i++) {
    await new Promise(r => setTimeout(r, 500));
  }
  if (!fs.existsSync(ready)) { console.log('FAIL: cache was never written'); process.exit(1); }
  console.log(`   ✔ cache ready in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  // ── STEP 2: fresh project, same dep set → cache hit ──────────────────────
  console.log('STEP 2: fresh project with the SAME dependency set…');
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-fresh-'));
  fs.writeFileSync(path.join(fresh, 'package.json'), JSON.stringify(pkg, null, 2));

  const logs = [];
  t0 = Date.now();
  const result = await runtimeBridge.installDependencies(fresh, { onLog: m => logs.push(m) });
  const freshMs = Date.now() - t0;

  for (const m of logs) console.log('   ' + m);
  console.log(`   ⏱ install took ${(freshMs / 1000).toFixed(1)}s  (cacheHit=${result.cacheHit === true})`);
  console.log(`   node_modules present: ${fs.existsSync(path.join(fresh, 'node_modules'))}`);
  console.log(`   vite binary present:  ${fs.existsSync(path.join(fresh, 'node_modules', '.bin', 'vite.cmd')) || fs.existsSync(path.join(fresh, 'node_modules', '.bin', 'vite'))}\n`);

  // ── STEP 3: "regeneration" — node_modules preserved → rebuild only ───────
  console.log('STEP 3: simulate regeneration — node_modules kept, package.json same…');
  t0 = Date.now();
  const rebuild = await runtimeBridge.installDependencies(fresh, { onLog: () => {} });
  const rebuildMs = Date.now() - t0;
  console.log(`   ⏱ install took ${(rebuildMs / 1000).toFixed(1)}s  (node_modules preserved path)`);
  console.log(`   ok=${rebuild.ok}\n`);

  // ── VERDICT ───────────────────────────────────────────────────────────────
  console.log('=== VERDICT ===');
  console.log(`cache-hit install : ${(freshMs / 1000).toFixed(1)}s`);
  console.log(`preserved rebuild : ${(rebuildMs / 1000).toFixed(1)}s`);
  console.log(`vs cold install   : ~218s (measured live earlier)`);
  console.log(`speedup           : ~${Math.round(218 / Math.max(1, freshMs / 1000))}x on repeat runs\n`);

  fs.rmSync(fresh, { recursive: true, force: true });
  process.exit(result.ok && rebuild.ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });