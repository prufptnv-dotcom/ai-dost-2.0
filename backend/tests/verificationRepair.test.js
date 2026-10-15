const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRepair = require('../services/projectRepair');
const runtimeBridge = require('../services/runtimeBridge');

/**
 * P1 — Deterministic verification + repair.
 *
 * The invariant under test: the agent's "it works" claim must be produced by a
 * real build + real browser observation, and a real failure must be handed to
 * the model verbatim and then re-proven — never assumed fixed.
 */

function tmpDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `p1-${name}-`));
}

// ─────────────────────────────────────────────────────────────────────────────
describe('projectRepair.parseFilePayload — salvage model output', () => {
  it('parses a clean JSON payload', () => {
    const files = projectRepair.parseFilePayload('{"files":[{"path":"src/App.jsx","content":"const a=1;"}]}');
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].path, 'src/App.jsx');
  });

  it('salvages a fenced ```json block', () => {
    const files = projectRepair.parseFilePayload('Here you go:\n```json\n{"files":[{"path":"a.js","content":"x"}]}\n```\nHope that helps!');
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].path, 'a.js');
  });

  it('salvages prose wrapped around the JSON', () => {
    const files = projectRepair.parseFilePayload('I fixed it. {"files":[{"path":"b.js","content":"y"}]} Let me know.');
    assert.strictEqual(files.length, 1);
  });

  it('rejects junk rather than returning a bogus "repair"', () => {
    for (const junk of ['', '   ', 'null', 'I cannot help with that.', '{"files":[]}', '{ broken', null, undefined]) {
      assert.deepStrictEqual(projectRepair.parseFilePayload(junk), [], `should reject: ${JSON.stringify(junk)}`);
    }
  });

  it('drops entries missing path or content', () => {
    const files = projectRepair.parseFilePayload('{"files":[{"path":"a.js"},{"content":"x"},{"path":"b.js","content":"y"}]}');
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].path, 'b.js');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('projectRepair.hasActionableFailure — do not waste LLM calls', () => {
  it('a failed build IS actionable', () => {
    assert.strictEqual(projectRepair.hasActionableFailure({
      build: { ok: false, exitCode: 1 },
      runtime: { attempted: false, reason: 'build failed' },
    }), true);
  });

  it('runtime errors ARE actionable', () => {
    assert.strictEqual(projectRepair.hasActionableFailure({
      build: { ok: true, exitCode: 0 },
      runtime: { attempted: true, ok: false, pageErrors: ['ReferenceError: x is not defined'] },
    }), true);
  });

  it('UNVERIFIED is NOT actionable — there is no error to give the model', () => {
    assert.strictEqual(projectRepair.hasActionableFailure({
      build: { ok: true, exitCode: 0 },
      runtime: { attempted: true, ok: false, unverified: true, reason: 'no index.html' },
    }), false);
  });

  it('a passing verification is NOT actionable', () => {
    assert.strictEqual(projectRepair.hasActionableFailure({
      build: { ok: true, exitCode: 0 },
      runtime: { attempted: true, ok: true },
    }), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('projectRepair.diffAgainstDisk — a no-op is not a repair', () => {
  it('separates genuinely changed files from identical ones', () => {
    const dir = tmpDir('diff');
    fs.writeFileSync(path.join(dir, 'same.js'), 'const a = 1;');
    fs.writeFileSync(path.join(dir, 'changed.js'), 'const b = 2;');

    const { applied, unchanged } = projectRepair.diffAgainstDisk(dir, [
      { path: 'same.js', content: 'const a = 1;' },      // identical
      { path: 'changed.js', content: 'const b = 3;' },   // real change
    ]);

    assert.deepStrictEqual(applied.map(f => f.path), ['changed.js']);
    assert.deepStrictEqual(unchanged, ['same.js']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('projectRepair.manifestChanged — a dependency change needs a re-install', () => {
  it('detects a package.json change', () => {
    assert.strictEqual(projectRepair.manifestChanged(['package.json']), true);
    assert.strictEqual(projectRepair.manifestChanged(['src/package.json']), true);
    assert.strictEqual(projectRepair.manifestChanged(['a\\b\\package.json']), true);
  });

  it('does not fire for an ordinary code change', () => {
    for (const paths of [['src/App.jsx'], ['index.html'], ['src/styles.css'], []]) {
      assert.strictEqual(projectRepair.manifestChanged(paths), false, `should not fire for ${JSON.stringify(paths)}`);
    }
  });

  it('is not fooled by a similarly named file', () => {
    assert.strictEqual(projectRepair.manifestChanged(['src/package.json.bak']), false);
    assert.strictEqual(projectRepair.manifestChanged(['my-package.json']), false);
  });

  it('tolerates junk input', () => {
    for (const bad of [null, undefined, [null], [undefined], [{}], ['']]) {
      assert.doesNotThrow(() => projectRepair.manifestChanged(bad));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('projectRepair.repairUntilVerified — the closed loop', () => {
  it('does not repair at all when the first verification passes', async () => {
    let verifyCalls = 0, repairCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('ok'),
      verify: async () => {
        verifyCalls++;
        return { ok: true, build: { ok: true, exitCode: 0 }, runtime: { attempted: true, ok: true } };
      },
      repair: async () => { repairCalls++; return { applied: [{ path: 'a' }] }; },
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.attempts, 0);
    assert.strictEqual(verifyCalls, 1, 'a passing build must not be re-verified');
    assert.strictEqual(repairCalls, 0, 'no LLM call when nothing is broken');
  });

  it('trusts an initialVerification the caller already ran (P3)', async () => {
    let verifyCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('dupverify'),
      // Caller just built + browser-checked; hand it over instead of paying twice.
      initialVerification: { ok: true, build: { ok: true, exitCode: 0 }, runtime: { attempted: true, ok: true } },
      verify: async () => { verifyCalls++; return { ok: true }; },
      repair: async () => ({ applied: [{ path: 'x' }] }),
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(verifyCalls, 0, 'a duplicate initial build must be skipped');
  });

  it('still re-verifies after a repair even when initialVerification was supplied', async () => {
    let verifyCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('reverify'),
      initialVerification: { ok: false, build: { ok: false, exitCode: 1 }, runtime: { attempted: false } },
      verify: async () => {
        verifyCalls++;
        return { ok: true, build: { ok: true, exitCode: 0 }, runtime: { attempted: true, ok: true } };
      },
      repair: async () => ({ applied: [{ path: 'src/App.jsx' }] }),
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(verifyCalls, 1, 'the fix must still be proven by a real re-run');
    assert.strictEqual(res.attempts, 1);
  });

  it('re-verifies after every repair and stops as soon as it passes', async () => {
    let verifyCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('loop'),
      verify: async (attempt) => {
        verifyCalls++;
        // Fails once, then passes — the model actually fixed it.
        return attempt >= 1
          ? { ok: true, build: { ok: true, exitCode: 0 }, runtime: { attempted: true, ok: true } }
          : { ok: false, build: { ok: false, exitCode: 1, stderr: 'SYNTAX ERROR' }, runtime: { attempted: false } };
      },
      repair: async () => ({ applied: [{ path: 'src/App.jsx' }] }),
    });

    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.attempts, 1);
    assert.strictEqual(verifyCalls, 2, 'must re-run the real check after the fix');
    assert.deepStrictEqual(res.repairs[0].applied.map(f => f.path), ['src/App.jsx']);
  });

  it('respects the attempt budget and reports honest failure', async () => {
    let verifyCalls = 0, repairCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('budget'),
      maxAttempts: 3,
      verify: async () => {
        verifyCalls++;
        return { ok: false, build: { ok: false, exitCode: 1, stderr: 'still broken' }, runtime: { attempted: false } };
      },
      repair: async () => { repairCalls++; return { applied: [{ path: 'src/App.jsx' }] }; },
    });

    assert.strictEqual(res.ok, false, 'a permanently broken build must NOT report success');
    assert.strictEqual(res.attempts, 3);
    assert.strictEqual(repairCalls, 3);
    assert.strictEqual(verifyCalls, 4, 'initial + one re-verify per attempt');
  });

  it('stops immediately when the model returns nothing usable', async () => {
    let repairCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('nopay'),
      verify: async () => ({ ok: false, build: { ok: false, exitCode: 1 }, runtime: { attempted: false } }),
      repair: async () => { repairCalls++; return { applied: [], reason: 'model returned no files' }; },
    });

    assert.strictEqual(res.ok, false);
    assert.strictEqual(repairCalls, 1, 'must not re-ask a model that already failed');
    assert.strictEqual(res.attempts, 1);
    assert.match(res.repairs[0].reason, /no files/);
  });

  it('never enters the loop for an UNVERIFIED run', async () => {
    let repairCalls = 0;
    const res = await projectRepair.repairUntilVerified({
      dir: tmpDir('unver'),
      verify: async () => ({
        ok: false,
        build: { ok: true, skipped: true, reason: 'no build script' },
        runtime: { attempted: true, ok: false, unverified: true, reason: 'no index.html' },
      }),
      repair: async () => { repairCalls++; return { applied: [{ path: 'x' }] }; },
    });

    assert.strictEqual(repairCalls, 0, 'nothing actionable ⇒ no wasted LLM call');
    assert.strictEqual(res.ok, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('projectRepair.requestRepair — the model sees the real error', () => {
  it('puts the verbatim compiler output in the prompt', async () => {
    const dir = tmpDir('prompt');
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'App.jsx'), 'export default function App(){');

    let seenSystem = '', seenUser = '';
    const res = await projectRepair.requestRepair({
      dir,
      evidence: "src/App.jsx:12:3: ERROR: Expected ')' but found '}'",
      summary: '`npm run build` exited with code 1',
      intent: 'build a pomodoro timer',
      callLLM: async (system, user) => {
        seenSystem = system; seenUser = user;
        return '{"files":[{"path":"src/App.jsx","content":"fixed"}]}';
      },
    });

    assert.strictEqual(res.files.length, 1);
    assert.match(seenUser, /Expected '\)' but found '\}'/, 'the real compiler message must be passed through');
    assert.match(seenUser, /pomodoro timer/, 'the original intent gives the model context');
    assert.match(seenSystem, /JSON object/, 'response format must be pinned');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports a reason instead of throwing when the LLM call fails', async () => {
    const dir = tmpDir('llmfail');
    fs.writeFileSync(path.join(dir, 'a.js'), 'x');
    const res = await projectRepair.requestRepair({
      dir,
      evidence: 'boom',
      callLLM: async () => { throw new Error('all providers down'); },
    });
    assert.deepStrictEqual(res.files, []);
    assert.match(res.reason, /all providers down/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge.verifySourceFile — real parsing, honestly labelled', () => {
  it('reports a genuine syntax error with its line number', () => {
    const dir = tmpDir('src-err');
    fs.writeFileSync(path.join(dir, 'ok.js'), 'const a = 1;');
    const res = runtimeBridge.verifySourceFile(dir, 'ok.js', 'const a = ;;; function (( {');
    assert.strictEqual(res.ok, false);
    assert.ok(res.error && res.error.length > 0, 'must explain what is wrong');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts valid JSX-free JS', () => {
    const dir = tmpDir('src-ok');
    const res = runtimeBridge.verifySourceFile(dir, 'a.js', 'export const add = (a, b) => a + b;');
    assert.strictEqual(res.ok, true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('labels a weak (no-parser) result as weak, never as a full pass', () => {
    const dir = tmpDir('src-weak');
    const res = runtimeBridge.verifySourceFile(dir, 'a.js', 'const a = 1;');
    assert.ok(['strong', 'weak'].includes(res.strength));
    if (res.strength === 'weak') {
      assert.ok(res.note, 'a weak verdict must say why it is weak');
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });
});