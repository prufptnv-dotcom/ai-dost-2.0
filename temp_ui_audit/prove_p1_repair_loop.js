/**
 * Live proof of the P1 repair loop using REAL builds (no LLM).
 *
 * 1. A project whose `npm run build` genuinely fails (real exit code).
 * 2. verifyBuild detects it → hasActionableFailure says yes.
 * 3. The repair function rewrites the file on disk.
 * 4. The loop re-runs the REAL build → it now passes.
 *
 * This is the generate → verify → observe → repair cycle that P0 could not do.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const runtimeBridge = require(path.join(__dirname, '..', 'backend', 'services', 'runtimeBridge'));
const projectRepair = require(path.join(__dirname, '..', 'backend', 'services', 'projectRepair'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-live-'));

// A project that builds ONLY when App.jsx is valid.
fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
  name: 'p1-live', version: '1.0.0',
  scripts: {
    // esbuild ships with nothing here, so use node to "compile": the build
    // script parses App.jsx with a real parser and fails on a syntax error.
    build: 'node build.js',
  },
}, null, 2));

// Copy the stand-in compiler in rather than inlining it — embedding it in a
// template literal breaks on the quote characters it needs to emit errors.
fs.copyFileSync(path.join(__dirname, 'p1_build_check.js'), path.join(dir, 'build.js'));

fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
// Deliberately broken: missing closing paren.
fs.writeFileSync(path.join(dir, 'src', 'App.jsx'),
  'export default function App() { return <div>(unclosed </div>; }');

let verifyCalls = 0;
const verify = async () => {
  verifyCalls++;
  return runtimeBridge.verifyBuild(dir, { onLog: m => console.log(`   [verify ${verifyCalls}] ${m}`) });
};

// Deterministic "model": rewrites the broken construct.
const repair = async (verification) => {
  const src = path.join(dir, 'src', 'App.jsx');
  const fixed = 'export default function App() { return <div>P1 REPAIRED</div>; }';
  fs.writeFileSync(src, fixed);
  return { applied: [{ path: 'src/App.jsx' }] };
};

(async () => {
  console.log('\n=== STEP 1: first verification (project is broken) ===');
  const first = await verify();
  console.log(`   ok=${first.ok} buildExit=${first.build?.exitCode}`);
  console.log('   describe:', runtimeBridge.describeVerification(first).split('\n').join('\n              '));
  console.log('   actionable?', projectRepair.hasActionableFailure(first));

  console.log('\n=== STEP 2: run the repair loop ===');
  const res = await projectRepair.repairUntilVerified({
    dir, verify, repair, maxAttempts: 3,
    onLog: m => console.log(`   ${m}`),
  });

  console.log('\n=== STEP 3: result ===');
  console.log(`   ok=${res.ok} attempts=${res.attempts} repairs=${res.repairs.length}`);
  console.log('   describe:', runtimeBridge.describeVerification(res.verification).split('\n').join('\n              '));
  console.log(`   rootSample: ${JSON.stringify(res.verification.runtime?.rootSample)}`);
  console.log(`   screenshot: ${res.verification.runtime?.screenshot ? 'real PNG captured' : 'none'}`);
  console.log(`\n   VERDICT: ${res.ok ? '✅ loop repaired the project and PROVED it with a real build' : '❌ still broken'}`);
  console.log(`   build exit codes seen: ${verifyCalls} verification runs`);

  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(res.ok ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });