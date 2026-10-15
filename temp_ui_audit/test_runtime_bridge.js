/**
 * Functional test for runtimeBridge against a REAL project.
 * Case A: deps declared, build succeeds -> must report exit 0 + real evidence.
 * Case B: build script that fails       -> must report exit != 0 + real stderr.
 * Case C: no build script              -> must skip honestly, not invent success.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const rt = require(path.join(__dirname, '..', 'backend', 'services', 'runtimeBridge'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtb-test-'));

function mk(name, pkg, files = {}) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  for (const [f, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  return dir;
}

(async () => {
  // ── Case A: real install + real build ─────────────────────────────────────
  console.log('\n=== CASE A: deps declared, build succeeds ===');
  const a = mk('caseA', {
    name: 'case-a',
    version: '1.0.0',
    scripts: { build: 'node build.js' },
    devDependencies: {},
  }, { 'build.js': "require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/index.html','<!doctype html><html><body><div id=root><h1>REAL BUILD OUTPUT</h1></div></body></html>');" });

  const logs = [];
  const inst = await rt.installDependencies(a, { onLog: m => { logs.push(m); console.log('   ' + m); } });
  console.log('   install ->', JSON.stringify({ ok: inst.ok, skipped: inst.skipped, exitCode: inst.exitCode, reason: inst.reason }));
  if (!inst.ok && !inst.skipped) console.log('   install tail:', inst.tail);

  const build = await rt.runBuild(a);
  console.log('   build ->', JSON.stringify({ ok: build.ok, exitCode: build.exitCode, cmd: build.cmd }));

  const verifyA = await rt.verifyBuild(a, { onLog: m => console.log('   ' + m) });
  console.log('   VERDICT ok =', verifyA.ok, '| runtimeOk =', verifyA.runtime?.ok, '| unverified =', verifyA.runtime?.unverified);
  console.log('   rootSample:', JSON.stringify(verifyA.runtime?.rootSample));
  console.log('   screenshot:', verifyA.runtime?.screenshot ? `${Math.round(verifyA.runtime.screenshot.length * 0.75 / 1024)}KB png` : 'none');
  console.log('   --- describe ---');
  console.log(rt.describeVerification(verifyA).split('\n').map(l => '   ' + l).join('\n'));

  // ── Case B: build fails ───────────────────────────────────────────────────
  console.log('\n=== CASE B: build script fails ===');
  const b = mk('caseB', {
    name: 'case-b', version: '1.0.0',
    scripts: { build: 'node build.js' },
  }, { 'build.js': "console.error('FAIL: Cannot find module \\'./missing\\''); process.exit(1);" });

  const verifyB = await rt.verifyBuild(b, { onLog: m => console.log('   ' + m) });
  console.log('   VERDICT ok =', verifyB.ok, '| buildOk =', verifyB.buildOk);
  console.log('   build exitCode =', verifyB.build?.exitCode);
  console.log('   build stderr  =', JSON.stringify(verifyB.build?.stderr));
  console.log('   --- describe ---');
  console.log(rt.describeVerification(verifyB).split('\n').map(l => '   ' + l).join('\n'));

  // ── Case C: no build script ───────────────────────────────────────────────
  console.log('\n=== CASE C: no build script ===');
  const c = mk('caseC', { name: 'case-c', version: '1.0.0' });
  const verifyC = await rt.verifyBuild(c, { onLog: m => console.log('   ' + m) });
  console.log('   VERDICT ok =', verifyC.ok);
  console.log('   --- describe ---');
  console.log(rt.describeVerification(verifyC).split('\n').map(l => '   ' + l).join('\n'));

  // ── Case D: no deps declared -> must SKIP install, not waste 2 minutes ────
  console.log('\n=== CASE D: package.json with no dependencies ===');
  const d = mk('caseD', { name: 'case-d', version: '1.0.0', scripts: {} });
  const t0 = Date.now();
  const instD = await rt.installDependencies(d);
  console.log('   install ->', JSON.stringify({ ok: instD.ok, skipped: instD.skipped, reason: instD.reason }), `in ${Date.now() - t0}ms`);

  // ── Case E: REAL dependency install (proves the EINVAL fix) ───────────────
  console.log('\n=== CASE E: real dependency install + real build ===');
  const e = mk('caseE', {
    name: 'case-e', version: '1.0.0',
    scripts: { build: 'node build.js' },
    dependencies: { 'is-odd': '3.0.1' },
  }, { 'build.js': "const odd=require('is-odd');require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/index.html','<!doctype html><html><body><div id=root><h1>REAL BUILD '+ (odd(7)?'ODD':'EVEN') +' OUTPUT</h1></div></body></html>');" });

  const tE = Date.now();
  const instE = await rt.installDependencies(e, { onLog: m => console.log('   ' + m) });
  console.log('   install ->', JSON.stringify({ ok: instE.ok, skipped: instE.skipped, exitCode: instE.exitCode }), `in ${Math.round((Date.now()-tE)/100)/10}s`);
  console.log('   steps ->', JSON.stringify(instE.steps));
  const verifyE = await rt.verifyBuild(e, { onLog: m => console.log('   ' + m) });
  console.log('   VERDICT ok =', verifyE.ok, '| runtimeOk =', verifyE.runtime?.ok);
  console.log('   rootSample:', JSON.stringify(verifyE.runtime?.rootSample));
  console.log('   consoleErrors:', JSON.stringify(verifyE.runtime?.consoleErrors));
  console.log('   screenshot:', verifyE.runtime?.screenshot ? `${Math.round(verifyE.runtime.screenshot.length*0.75/1024)}KB png` : 'none');
  console.log('   --- describe ---');
  console.log(rt.describeVerification(verifyE).split('\n').map(l => '   ' + l).join('\n'));

  fs.rmSync(root, { recursive: true, force: true });
  console.log('\nDone.');
})().catch(e => { console.error('FATAL', e); process.exit(1); });