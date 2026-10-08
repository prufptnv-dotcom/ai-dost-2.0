'use strict';
// P7 — Share URL: scoped-server gating (the public link must ONLY see the one
// project's preview), tunnel-output parsing, and always-on live-server
// persistence. Zero network: fake backend + no SSH.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const shareTunnel = require('../services/shareTunnel');

function get(port, urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, headers }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('P7 — extractTunnelUrl (provider output parsing)', () => {
  it('cloudflared: extracts the trycloudflare URL out of INF log noise', () => {
    const out = [
      '2026-10-07T12:00:00Z INF +----------------------------------------------+',
      '2026-10-07T12:00:00Z INF |  https://atlanta-arrangement-dennis.trycloudflare.com  |',
      '2026-10-07T12:00:00Z INF +----------------------------------------------+',
      '2026-10-07T12:00:00Z INF Version 2026.10.0 (built 2026-10-05)',
    ].join('\n');
    assert.strictEqual(
      shareTunnel.extractTunnelUrl('cloudflared', out),
      'https://atlanta-arrangement-dennis.trycloudflare.com'
    );
    // docs/marketing links never become a "tunnel URL"
    assert.strictEqual(
      shareTunnel.extractTunnelUrl('cloudflared', 'see https://developers.cloudflare.com for docs'),
      null
    );
  });

  it('serveo: HTTP subdomain mode AND anonymous TCP mode both parse', () => {
    assert.strictEqual(
      shareTunnel.extractTunnelUrl('serveo', 'Forwarding HTTP traffic from https://abc123.serveo.net'),
      'https://abc123.serveo.net'
    );
    assert.strictEqual(
      shareTunnel.extractTunnelUrl(
        'serveo',
        'Allocated port 46789 for remote forward to localhost:55313\nForwarding TCP connections from serveousercontent.com:46789'
      ),
      'http://serveousercontent.com:46789'
    );
  });

  it('unknown providers fall back to a generic https URL minus denylisted hosts', () => {
    assert.strictEqual(shareTunnel.extractTunnelUrl('other', 'go to https://example.com/x'), 'https://example.com/x');
    assert.strictEqual(shareTunnel.extractTunnelUrl('other', 'issues: https://github.com/a/b'), null);
  });

  it('returns null for noise-only output (blocked network case)', () => {
    assert.strictEqual(shareTunnel.extractTunnelUrl('cloudflared', 'Permission denied (publickey).'), null);
    assert.strictEqual(shareTunnel.extractTunnelUrl('serveo', ''), null);
    assert.strictEqual(shareTunnel.extractTunnelUrl('localhost.run', 'Welcome! docs at https://localhost.run/docs/'), null);
  });
});

describe('P7 — scoped share server', () => {
  let fakeBackend;
  let fakePort;
  let scoped;
  let sharePort;
  const KEY = 'unit-share-key-abc';
  const PID = 'proj-scoped';

  before(async () => {
    // fake backend: echoes which path + which forwarding headers it received
    fakeBackend = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          proxied: req.url,
          xff: req.headers['x-forwarded-for'] || null,
          origin: req.headers.origin || null,
          referer: req.headers.referer || null,
          cfRay: req.headers['cf-ray'] || null,
        })
      );
    });
    await new Promise((r) => fakeBackend.listen(0, '127.0.0.1', r));
    fakePort = fakeBackend.address().port;

    scoped = await shareTunnel.startShareServer(PID, KEY, { proxyPort: fakePort });
    sharePort = scoped.server.address().port;
  });

  after(() => {
    try { scoped.server.close(); } catch (_) {}
    try { fakeBackend.close(); } catch (_) {}
  });

  it('rejects a missing key with 403 (root path)', async () => {
    const r = await get(sharePort, '/');
    assert.strictEqual(r.status, 403);
    assert.match(r.body, /invalid share link/i);
  });

  it('rejects a wrong key even on an allowed path', async () => {
    const r = await get(sharePort, `/api/preview/${PID}/`, { cookie: `aidost_share=wrong` });
    assert.strictEqual(r.status, 403);
  });

  it('mints a cookie for ?key= on root and lands on the preview root', async () => {
    const r = await get(sharePort, `/?key=${KEY}`);
    assert.strictEqual(r.status, 302);
    const cookies = [].concat(r.headers['set-cookie'] || []).join(';');
    assert.match(cookies, new RegExp(`aidost_share=${KEY}`));
    assert.strictEqual(r.headers.location, `/api/preview/${PID}/`);
  });

  it('SECURITY: a WRONG ?key on root gets 403 and NEVER a cookie (leak regression)', async () => {
    const r = await get(sharePort, '/?key=attacker-guess');
    assert.strictEqual(r.status, 403);
    assert.ok(!r.headers['set-cookie'], 'invalid attempt must not mint a session cookie');
  });

  it('proxies THIS project preview for a cookie-bearing request', async () => {
    const r = await get(sharePort, `/api/preview/${PID}/index.html`, { cookie: `aidost_share=${KEY}` });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(JSON.parse(r.body).proxied, `/api/preview/${PID}/index.html`);
  });

  it('sends `/` with a valid session to the preview root', async () => {
    const r = await get(sharePort, '/', { cookie: `aidost_share=${KEY}` });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(JSON.parse(r.body).proxied, `/api/preview/${PID}/`);
  });

  it('BLOCKS another project path through this share (project isolation)', async () => {
    const r = await get(sharePort, '/api/preview/other-project/', { cookie: `aidost_share=${KEY}` });
    assert.strictEqual(r.status, 403);
  });

  it('BLOCKS backend power paths (/api/agent, /api/document, settings) even with a valid key', async () => {
    for (const p of ['/api/agent/run', '/api/document/generate', '/api/settings', '/health']) {
      const r = await get(sharePort, p, { cookie: `aidost_share=${KEY}` });
      assert.strictEqual(r.status, 403, `${p} must not be reachable through a share`);
    }
  });

  it('still allows key-in-query on deep links (cookie-less clients)', async () => {
    const r = await get(sharePort, `/api/preview/${PID}/style.css?key=${KEY}`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(JSON.parse(r.body).proxied, `/api/preview/${PID}/style.css?key=${KEY}`);
  });

  it('REGRESSION: strips tunnel identity headers on the hop (LOCAL_ONLY fix)', async () => {
    // cloudflared puts the visitor's PUBLIC IP in X-Forwarded-For; the backend
    // runs `trust proxy = loopback` so a forwarded XFF became req.ip →
    // localApiGuard LOCAL_ONLY 403 on every shared preview (seen live). The
    // share proxy must present THIS hop (127.0.0.1) instead.
    const r = await get(sharePort, `/api/preview/${PID}/deep`, {
      cookie: `aidost_share=${KEY}`,
      'x-forwarded-for': '203.0.113.9',
      'x-real-ip': '203.0.113.9',
      origin: 'https://sneaky.trycloudflare.com',
      referer: 'https://sneaky.trycloudflare.com/api/preview/',
      'cf-ray': 'deadbeef1234',
      'cf-connecting-ip': '203.0.113.9',
    });
    assert.strictEqual(r.status, 200);
    const body = JSON.parse(r.body);
    assert.strictEqual(body.xff, null, 'X-Forwarded-For must not reach the backend');
    assert.strictEqual(body.origin, null, 'tunnel Origin must be stripped (isCrossSiteBrowser)');
    assert.strictEqual(body.referer, null, 'tunnel Referer must be stripped');
    assert.strictEqual(body.cfRay, null, 'cloudflared identity headers must be stripped');
    // path scoping still intact after stripping
    assert.strictEqual(body.proxied, `/api/preview/${PID}/deep`);
  });

  it('isAllowedPath allowlists exactly the preview/instant surface', () => {
    assert.ok(shareTunnel.isAllowedPath('/', PID));
    assert.ok(shareTunnel.isAllowedPath(`/api/preview/${PID}/`, PID));
    assert.ok(shareTunnel.isAllowedPath(`/instant/${PID}`, PID));
    assert.ok(shareTunnel.isAllowedPath('/wc/index.js', PID));
    assert.ok(!shareTunnel.isAllowedPath('/api/agent/run', PID));
    assert.ok(!shareTunnel.isAllowedPath(`/api/preview/${PID}-evil/`, PID) &&
      !shareTunnel.isAllowedPath(`/api/preview/evil/${PID}`, PID));
    assert.ok(!shareTunnel.isAllowedPath('/socket.io/?EIO=4', PID));
  });

  it('startShare(tunnel:false) opens a local share without SSH', async () => {
    const res = await shareTunnel.startShare('proj-notunnel', { tunnel: false });
    assert.strictEqual(res.provider, 'none');
    assert.ok(res.key && res.localPort > 0);
    assert.strictEqual(res.url, null);
    assert.strictEqual(res.success, false);
    await shareTunnel.stopShare('proj-notunnel');
  });
});

describe('P7 — always-on live-server persistence', () => {
  const devServerManager = require('../sandbox/devServerManager');
  let tmpFile;

  before(() => {
    tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-live-')), 'live.json');
    process.env.AIDOST_LIVE_FILE = tmpFile;
  });

  after(() => {
    delete process.env.AIDOST_LIVE_FILE;
    try { fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true }); } catch (_) {}
  });

  it('persist → list → unpersist round-trip via the env-overridable file', async () => {
    assert.deepStrictEqual(await devServerManager.listLiveServers(), []);

    await devServerManager.persistLiveServer('proj-a', 'C:/work/a');
    await devServerManager.persistLiveServer('proj-b', 'C:/work/b');
    const listed = await devServerManager.listLiveServers();
    assert.strictEqual(listed.length, 2);
    assert.ok(listed.find((e) => e.projectId === 'proj-a' && e.projectPath === 'C:/work/a'));

    await devServerManager.unpersistLiveServer('proj-a');
    const after = await devServerManager.listLiveServers();
    assert.strictEqual(after.length, 1);
    assert.strictEqual(after[0].projectId, 'proj-b');

    // missing file / unknown id never throw
    await devServerManager.unpersistLiveServer('never-existed');
    assert.strictEqual((await devServerManager.listLiveServers()).length, 1);
    await devServerManager.unpersistLiveServer('proj-b');
    assert.deepStrictEqual(await devServerManager.listLiveServers(), []);
  });

  it('ignores junk entries when persisting (defensive read)', async () => {
    fs.writeFileSync(tmpFile, 'not-json{{{');
    assert.strictEqual(await devServerManager.persistLiveServer('proj-c', 'C:/work/c'), true);
    const listed = await devServerManager.listLiveServers();
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].projectId, 'proj-c');
  });

  it('server.js wires share routes + boot restore (static audit)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.match(src, /require\('\.\/routes\/share'\)/);
    assert.match(src, /app\.use\('\/api\/share'/);
    const mainBlock = src.slice(src.indexOf('if (require.main === module)'));
    assert.match(mainBlock, /restoreLiveServers\(\)/, 'boot must restore live servers (inside require.main guard)');
    const restoreIdx = mainBlock.indexOf('restoreLiveServers');
    const telegramIdx = mainBlock.indexOf('startTelegramBot');
    assert.ok(telegramIdx < restoreIdx || telegramIdx === -1, 'restore runs in the guarded main block');
  });
});
