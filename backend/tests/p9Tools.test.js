/**
 * P9 tools — browser session SSRF policy + git commit/push/PR honesty tiers.
 * Zero network for the policy tests; git tests run REAL local git in a temp
 * dir (no remote, no gh — so every claim stays machine-verifiable).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const browserTool = require('../services/browserTool');
const repoTools = require('../services/repoTools');

let gitAvailable = true;
try {
  execFileSync('git', ['--version'], { encoding: 'utf8', timeout: 8000 });
} catch (_) {
  gitAvailable = false;
}

describe('browserTool SSRF policy (P9)', () => {
  test('allows loopback on ANY port (preview verification is the point)', () => {
    for (const u of ['http://localhost:5173', 'http://127.0.0.1:3000', 'http://localhost:8080/app', 'https://localhost:8443']) {
      const r = browserTool.urlPolicy(u);
      assert.equal(r.ok, true, u);
      assert.equal(r.loopback, true, u);
    }
  });

  test('allows public http/https and defers to DNS', () => {
    const r = browserTool.urlPolicy('https://example.com/docs');
    assert.equal(r.ok, true);
    assert.equal(r.needsDns, true, 'public hostnames get the DNS gate');
  });

  test('blocks dangerous schemes, credentials, and metadata hosts', () => {
    assert.equal(browserTool.urlPolicy('file:///etc/passwd').ok, false);
    assert.equal(browserTool.urlPolicy('ftp://example.com').ok, false);
    assert.equal(browserTool.urlPolicy('http://user:pass@example.com').ok, false);
    const meta = browserTool.urlPolicy('http://169.254.169.254/latest/meta-data/');
    assert.equal(meta.ok, false, 'cloud metadata IP blocked');
    assert.equal(browserTool.urlPolicy('http://metadata.google.internal/computeMetadata/v1/').ok, false);
    assert.equal(browserTool.urlPolicy('http://foo.internal/admin').ok, false);
    assert.equal(browserTool.urlPolicy('').ok, false);
    assert.equal(browserTool.urlPolicy('not a url').ok, false);
  });

  test('blocks literal private-range IPs (LAN routers etc.)', () => {
    for (const u of ['http://192.168.1.1:8080', 'http://10.0.0.5', 'http://172.16.4.2', 'http://100.64.0.1', 'http://[fd00::1]/']) {
      assert.equal(browserTool.urlPolicy(u).ok, false, u);
    }
    assert.equal(browserTool.urlPolicy('http://8.8.8.8').ok, true, 'public IP stays allowed');
  });

  test('isPrivateIp classification (v4 ranges + v6 forms)', () => {
    const priv = ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '100.64.1.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1'];
    const pub = ['8.8.8.8', '172.32.0.1', '172.15.0.1', '100.63.0.1', '1.1.1.1', '2606:4700:4700::1111'];
    for (const ip of priv) assert.equal(browserTool.isPrivateIp(ip), true, `${ip} should be private`);
    for (const ip of pub) assert.equal(browserTool.isPrivateIp(ip), false, `${ip} should be public`);
    assert.equal(browserTool.isPrivateIp(null), true, 'unknown = unsafe');
    assert.equal(browserTool.isLoopbackIp('127.0.0.1'), true);
    assert.equal(browserTool.isLoopbackIp('8.8.8.8'), false);
    assert.equal(browserTool.isLoopbackIp('::1'), true);
  });
});

describe('repoTools git tiers (P9)', () => {
  let dir;

  before(() => {
    if (!gitAvailable) return;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-repo-'));
    fs.writeFileSync(path.join(dir, 'app.js'), "console.log('v1');\n");
  });

  after(() => {
    if (dir) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    }
  });

  test('git_commit creates a real local commit (or honest skip)', { skip: !gitAvailable }, () => {
    const res = repoTools.gitCommit(dir, 'feat: v1');
    assert.equal(res.success, true);
    if (res.committed) {
      assert.ok(res.commit, 'short sha returned');
      assert.equal(res.filesChanged, 1);
      assert.match(res.note, /local commit only/i, 'never implies a push happened');
    } else {
      assert.match(res.reason, /clean/);
    }
  });

  test('git_commit on a clean tree says nothing to commit (no fake success)', { skip: !gitAvailable }, () => {
    const res = repoTools.gitCommit(dir, 'again');
    assert.equal(res.success, true);
    assert.equal(res.committed, false);
    assert.match(res.reason, /clean/);
  });

  test('git_push without a remote: commit kept, pushed:false, exact next step', { skip: !gitAvailable }, () => {
    fs.writeFileSync(path.join(dir, 'app.js'), "console.log('v2');\n");
    const res = repoTools.gitPush(dir, { message: 'feat: v2' });
    assert.equal(res.success, true, 'local work succeeded');
    assert.equal(res.pushed, false, 'must NOT claim a push');
    assert.match(res.reason, /git remote add origin/);
    // the v2 commit really exists locally
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    assert.equal(res.commit, sha);
  });

  test('create_pr without a remote returns structured guidance (no exception)', { skip: !gitAvailable }, () => {
    const res = repoTools.createPullRequest(dir, { title: 'x', body: 'y' });
    assert.equal(res.success, false);
    assert.match(res.error, /remote/i);
  });

  test('compareUrl builds a GitHub PR link from an https remote', () => {
    const url = repoTools.compareUrl('https://github.com/acme/widget.git', 'main', 'feat/x');
    assert.equal(url, 'https://github.com/acme/widget/compare/main...feat%2Fx?expand=1');
    assert.equal(repoTools.compareUrl('git@gitlab.com:acme/widget.git', 'main', 'f'), null, 'non-GitHub = no fake link');
  });

  test('execute() routes all three actions and rejects unknown ones', { skip: !gitAvailable }, async () => {
    const unknown = await repoTools.execute('git_fly', {}, dir);
    assert.equal(unknown.success, false);
    assert.match(unknown.error, /unknown action/);

    const commit = await repoTools.execute('git_commit', { message: 'via execute' }, dir);
    assert.equal(commit.success, true);
    assert.equal(commit.committed, false, 'tree still clean from prior tests');

    const push = await repoTools.execute('git_push', {}, dir);
    assert.equal(push.success, true);
    assert.equal(push.pushed, false, 'no remote in the temp repo');
  });
});
