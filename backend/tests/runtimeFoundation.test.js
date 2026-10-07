const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const runtimeBridge = require('../services/runtimeBridge');

/**
 * P0 — Runtime Foundation regression suite.
 *
 * Before P0 the agent could print "UI rendered with 0 console errors" for a
 * project that had never been installed, built, or executed. These tests pin
 * the three properties that make that impossible:
 *
 *   1. Real exit codes — a failing command is reported as failing, with output.
 *   2. No invented success — an unverifiable run is UNVERIFIED, never "passed".
 *   3. Windows spawn correctness — npm must actually run on modern Node.
 */

function tmpProject(name, pkg, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `p0-${name}-`));
  if (pkg) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge — Windows spawn correctness', () => {
  it('never spawns a .cmd directly with shell:false (CVE-2024-27980 EINVAL)', () => {
    const inv = runtimeBridge.resolveInvocation('npm.cmd', ['install']);
    if (process.platform === 'win32') {
      // Must route through cmd.exe, otherwise Node throws `spawn EINVAL`.
      assert.ok(
        /cmd(\.exe)?$/i.test(inv.command),
        `expected a cmd.exe shim on Windows, got ${inv.command}`
      );
      assert.deepStrictEqual(inv.args.slice(0, 3), ['/d', '/s', '/c']);
      assert.ok(inv.args[3].includes('npm.cmd'), 'the command line must still name npm');
    } else {
      assert.strictEqual(inv.command, 'npm.cmd');
      assert.deepStrictEqual(inv.args, ['install']);
    }
  });

  it('refuses arguments that could change command-line structure', () => {
    // Shell-injection guard: only literals this module defines may be spawned.
    assert.throws(() => runtimeBridge.resolveInvocation('npm.cmd', ['install; rm -rf /']), /non-literal/);
    assert.throws(() => runtimeBridge.resolveInvocation('npm.cmd', ['run && curl evil']), /non-literal/);
    assert.throws(() => runtimeBridge.resolveInvocation('npm.cmd', ['$(whoami)']), /non-literal/);
  });

  it('actually executes a command and reports its real exit code', async () => {
    // Written to a script file rather than passed via `-e`: resolveInvocation
    // deliberately rejects arguments containing shell metacharacters, so the
    // process payload must live in a file, not on the command line.
    const dir = tmpProject('exitcode', null);
    const okScript = path.join(dir, 'ok.js');
    const badScript = path.join(dir, 'bad.js');
    fs.writeFileSync(okScript, 'process.exit(0);');
    fs.writeFileSync(badScript, 'process.exit(3);');

    const ok = await runtimeBridge.runCommand(process.execPath, [okScript], dir, 15000);
    assert.strictEqual(ok.ok, true, ok.stderr);
    assert.strictEqual(ok.exitCode, 0);

    const bad = await runtimeBridge.runCommand(process.execPath, [badScript], dir, 15000);
    assert.strictEqual(bad.ok, false);
    assert.strictEqual(bad.exitCode, 3);

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('never rejects — a bad binary resolves instead of throwing', async () => {
    const res = await runtimeBridge.runCommand('definitely-not-a-real-binary-xyz', ['--x'], process.cwd(), 5000);
    assert.strictEqual(res.ok, false);
    assert.ok(res.exitCode !== 0);
    assert.ok(typeof res.stderr === 'string' && res.stderr.length > 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge — installDependencies', () => {
  it('skips when there is no package.json instead of claiming success', async () => {
    const dir = tmpProject('nopkg', null);
    const res = await runtimeBridge.installDependencies(dir);
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.ok, false, 'a missing package.json is not a successful install');
    assert.match(res.reason, /no package\.json/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips fast when no dependencies are declared', async () => {
    const dir = tmpProject('nodeps', { name: 'x', version: '1.0.0' });
    const t0 = Date.now();
    const res = await runtimeBridge.installDependencies(dir);
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.ok, true);
    assert.match(res.reason, /declares no dependencies/);
    assert.ok(Date.now() - t0 < 5000, 'must not shell out when there is nothing to install');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge — build + test report real exit codes', () => {
  it('reports the real failing exit code and the real compiler output', async () => {
    // The failing logic lives in a script file: an inline `node -e "…"` inside a
    // package.json script collides with cmd quoting on Windows, and a quoted
    // absolute interpreter path breaks outright once it contains a space.
    const dir = tmpProject('failbuild', {
      name: 'f', version: '1.0.0',
      scripts: { build: 'node build.js' },
    }, { 'build.js': "console.error('BOOM missing module'); process.exit(7);" });

    const res = await runtimeBridge.runBuild(dir);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.exitCode, 7);
    assert.match(res.stderr, /BOOM missing module/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips build honestly when the project defines no build script', async () => {
    const dir = tmpProject('nobuild', { name: 'x', version: '1.0.0' });
    const res = await runtimeBridge.runBuild(dir);
    assert.strictEqual(res.skipped, true);
    assert.strictEqual(res.ok, true);
    assert.match(res.reason, /no build script/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge — verifyBuild never invents success', () => {
  it('a failed build short-circuits the runtime check and surfaces the error', async () => {
    const dir = tmpProject('vfail', {
      name: 'v', version: '1.0.0',
      scripts: { build: 'node build.js' },
    }, {
      'build.js': "console.error('SYNTAX ERROR: unexpected token'); process.exit(1);",
      'index.html': '<!doctype html><html><body><div id=root>x</div></body></html>',
    });

    const v = await runtimeBridge.verifyBuild(dir);
    assert.strictEqual(v.ok, false);
    assert.strictEqual(v.buildOk, false);
    assert.strictEqual(v.build.exitCode, 1);
    assert.strictEqual(v.runtime.attempted, false, 'must not pretend to check a broken build');
    assert.match(v.runtime.reason, /build failed/);

    const described = runtimeBridge.describeVerification(v);
    assert.match(described, /FAILED/);
    assert.match(described, /SYNTAX ERROR/, 'the actual compiler message must reach the user');
    assert.doesNotMatch(described, /0 console errors/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports UNVERIFIED (not passed, not failed) when nothing can be loaded', async () => {
    const dir = tmpProject('vnone', { name: 'v', version: '1.0.0' });
    const v = await runtimeBridge.verifyBuild(dir);
    // No build script + no index.html ⇒ we have zero evidence.
    assert.strictEqual(v.runtime.unverified, true);
    assert.notStrictEqual(v.runtime.ok, true);

    const described = runtimeBridge.describeVerification(v);
    assert.match(described, /UNVERIFIED/);
    assert.doesNotMatch(described, /passed/i, 'must not claim a pass without evidence');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('verifies real built output end-to-end with a genuine screenshot', async () => {
    const dir = tmpProject('vreal', {
      name: 'v', version: '1.0.0',
      scripts: { build: 'node build.js' },
    }, {
      'build.js': "require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/index.html','<!doctype html><html><body><div id=\"root\"><h1>P0 REAL</h1></div></body></html>');",
    });

    const v = await runtimeBridge.verifyBuild(dir);
    assert.strictEqual(v.buildOk, true, v.build.stderr);
    assert.strictEqual(v.runtime.ok, true);
    assert.strictEqual(v.runtime.via, 'static-build');
    assert.strictEqual(v.runtime.rootRendered, true);
    assert.match(v.runtime.rootSample, /P0 REAL/);
    assert.ok(v.runtime.screenshot, 'a real PNG of the real output is required');
    assert.deepStrictEqual(v.runtime.pageErrors, []);
    assert.match(runtimeBridge.describeVerification(v), /passed \(exit 0/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge — describeVerification honesty contract', () => {
  it('never emits the old unconditional "0 console errors" claim', () => {
    const fake = {
      evidence: [{ cmd: 'npm run build', exitCode: 0, ok: true, ms: 10 }],
      build: { ok: true, exitCode: 0, ms: 10, stderr: '' },
      runtime: { attempted: true, ok: true, status: 200, pageErrors: [], consoleErrors: [] },
    };
    const text = runtimeBridge.describeVerification(fake);
    // The old system printed this string unconditionally, for a page it had
    // fabricated. It must only ever appear backed by real evidence.
    assert.doesNotMatch(text, /0 console errors/);
    assert.match(text, /exit 0/);
  });

  it('reports a runtime failure with the actual console/uncaught counts', () => {
    const fake = {
      evidence: [{ cmd: 'npm run build', exitCode: 0, ok: true, ms: 5 }],
      build: { ok: true, exitCode: 0, ms: 5, stderr: '' },
      runtime: {
        attempted: true, ok: false, via: 'static-build',
        pageErrors: [], consoleErrors: ['ReferenceError: API is not defined'],
      },
    };
    const text = runtimeBridge.describeVerification(fake);
    assert.match(text, /FAILED/);
    assert.match(text, /1 console error/);
    assert.match(text, /API is not defined/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('runtimeBridge — static server containment', () => {
  it('serves the built output and refuses to escape its root', async () => {
    const outer = tmpProject('serve', null, {
      'secret.txt': 'do-not-serve',
    });
    // Serve a nested directory so `secret.txt` genuinely lives OUTSIDE the root.
    const root = path.join(outer, 'public');
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><html><body><div id=root>SERVE OK</div></body></html>');

    const server = await runtimeBridge.serveStatic(root);
    assert.strictEqual(server.ok, true);

    // Raw http request: fetch() normalises "../" away before it hits the wire,
    // so the traversal has to be sent percent-encoded to actually be tested.
    const rawGet = (p) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.port, path: p }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });

    try {
      const rootRes = await rawGet('/');
      assert.strictEqual(rootRes.status, 200);
      assert.match(rootRes.body, /SERVE OK/);

      const escaped = await rawGet('/%2e%2e%2fsecret.txt');
      assert.notStrictEqual(escaped.status, 200, 'path traversal must not read outside the served root');
      assert.doesNotMatch(escaped.body, /do-not-serve/);
    } finally {
      server.close();
      fs.rmSync(outer, { recursive: true, force: true });
    }
  });
});