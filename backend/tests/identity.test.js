/**
 * P1 FIX regression tests (#11-#14 identity + #12 anon identity middleware)
 *
 * Zero network, zero LLM. Covers the trusted-identity matrix that the
 * conversation/assessment ownership checks (server.js, routes/assessment.js)
 * depend on, plus the ad_uid cookie minting/reuse rules.
 *
 * Run: node --test tests/identity.test.js  (wired into npm run test:unit)
 */
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const projectAuth = require('../services/projectAuthorization');
const anonIdentity = require('../middleware/anonIdentity');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const savedEnv = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, savedEnv);
});

function mockRes() {
  return {
    cookies: [],
    cookie(name, value, opts) { this.cookies.push({ name, value, opts }); },
  };
}

describe('P1 #12 — projectAuthorization.resolveUser identity matrix', () => {
  test('loopback request IPs (IPv4 + IPv6 + mapped) resolve to local-user', () => {
    for (const ip of ['127.0.0.1', '127.0.0.53', '::1', '::ffff:127.0.0.1']) {
      assert.equal(projectAuth.resolveUser({ ip }), 'local-user', `ip=${ip}`);
    }
  });

  test('socket fallback works when req.ip is missing', () => {
    assert.equal(
      projectAuth.resolveUser({ socket: { remoteAddress: '::ffff:127.0.0.1' } }),
      'local-user'
    );
  });

  test('context-less req keeps legacy local-user contract (unreachable for real HTTP)', () => {
    assert.equal(projectAuth.resolveUser({}), 'local-user');
    assert.equal(projectAuth.resolveUser({ headers: {} }), 'local-user');
  });

  test('non-loopback IP without cookie → deterministic anon id (stable, IP-scoped)', () => {
    const a = projectAuth.resolveUser({ ip: '192.168.5.9' });
    const b = projectAuth.resolveUser({ ip: '192.168.5.9' });
    const c = projectAuth.resolveUser({ ip: '192.168.5.10' });

    assert.match(a, /^anon-/);
    assert.equal(a, b, 'same IP must map to the same anon id');
    assert.notEqual(a, c, 'different IPs must not collide');
    assert.notEqual(a, 'local-user');
  });

  test('non-loopback IP with valid ad_uid cookie → cookie-backed stable id', () => {
    const uid = crypto.randomUUID();
    const req1 = { ip: '10.5.6.7', adUid: uid, headers: { cookie: `ad_uid=${uid}` } };
    const req2 = { ip: '10.5.6.7', adUid: uid, headers: { cookie: `ad_uid=${uid}` } };
    assert.equal(projectAuth.resolveUser(req1), `anon-${uid}`);
    assert.equal(projectAuth.resolveUser(req1), projectAuth.resolveUser(req2));
  });

  test('forged/squatted adUid value (not a UUID) is never honoured', () => {
    const id = projectAuth.resolveUser({ ip: '10.5.6.7', adUid: 'local-user' });
    assert.match(id, /^anon-[0-9a-f]{16}$/, 'invalid uid falls back to IP hash');
    assert.notEqual(id, 'anon-local-user');
  });

  test('body/query userId is never accepted as identity', () => {
    const id = projectAuth.resolveUser({ ip: '10.5.6.7', body: { userId: 'mallory' } });
    assert.notEqual(id, 'mallory');
    assert.match(id, /^anon-/);
  });

  test('x-user-id header ignored without ALLOW_UNTRUSTED_USER_HEADER opt-in', () => {
    delete process.env.ALLOW_UNTRUSTED_USER_HEADER;
    const id = projectAuth.resolveUser({ ip: '10.5.6.7', headers: { 'x-user-id': 'mallory' } });
    assert.notEqual(id, 'mallory');
    assert.match(id, /^anon-/);

    process.env.ALLOW_UNTRUSTED_USER_HEADER = 'true';
    assert.equal(
      projectAuth.resolveUser({ ip: '10.5.6.7', headers: { 'x-user-id': 'mallory' } }),
      'mallory'
    );
  });

  test('production keeps legacy local-user fallback for unauthenticated calls', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(projectAuth.resolveUser({ ip: '10.5.6.7' }), 'local-user');
    assert.equal(projectAuth.resolveUser({ user: { id: 'alice' } }), 'alice');
  });
});

describe('P1 #12 — anonIdentity middleware', () => {
  test('mints a UUID ad_uid cookie when none present', () => {
    const req = { headers: {} };
    const res = mockRes();
    let called = false;
    anonIdentity(req, res, () => { called = true; });

    assert.ok(called, 'must call next()');
    assert.match(req.adUid, UUID_RE);
    assert.equal(res.cookies.length, 1);
    const { name, value, opts } = res.cookies[0];
    assert.equal(name, 'ad_uid');
    assert.equal(value, req.adUid);
    assert.equal(opts.httpOnly, true);
    assert.equal(opts.sameSite, 'lax');
    assert.equal(opts.path, '/');
    assert.ok(opts.maxAge >= 365 * 24 * 60 * 60 * 1000 - 1000);
  });

  test('reuses a valid ad_uid cookie and does not re-issue Set-Cookie', () => {
    const uid = crypto.randomUUID();
    const req = { headers: { cookie: `foo=bar; ad_uid=${uid}; baz=1` } };
    const res = mockRes();
    anonIdentity(req, res, () => {});

    assert.equal(req.adUid, uid);
    assert.equal(res.cookies.length, 0, 'valid cookie must not be re-set');
  });

  test('replaces squatted/invalid cookie values with a fresh UUID', () => {
    for (const bad of ['local-user', 'anon-x', '../etc', '00000000-0000-0000-0000-000000000000'.slice(0, 30)]) {
      const req = { headers: { cookie: `ad_uid=${encodeURIComponent(bad)}` } };
      const res = mockRes();
      anonIdentity(req, res, () => {});
      assert.match(req.adUid, UUID_RE, `bad value "${bad}" must be replaced`);
      assert.notEqual(req.adUid, bad);
      assert.equal(res.cookies.length, 1);
    }
  });

  test('keeps an already-minted req.adUid (first request identity survives handlers)', () => {
    const uid = crypto.randomUUID();
    const req = { headers: {}, adUid: uid };
    const res = mockRes();
    anonIdentity(req, res, () => {});
    assert.equal(req.adUid, uid);
    assert.equal(res.cookies.length, 0);
  });
});
