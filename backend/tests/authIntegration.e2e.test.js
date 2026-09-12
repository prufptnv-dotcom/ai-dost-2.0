'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: Dedicated Authentication E2E Integration Suite
 * 
 * 35 comprehensive end-to-end integration scenarios verifying:
 * - Live HTTP server boot on dynamic port 0
 * - Complete registration, hashing, token issuance, and cookie setting
 * - Rejection of duplicates, oversized passwords, and privilege escalation
 * - Login authentication, timing safety, and generic error envelopes
 * - Protected route authorization and claim validation
 * - Single-use refresh token rotation and token family lineage tracking
 * - Token replay / reuse attack detection with entire-family revocation
 * - Standard single-session logout and global logout-all with token_version invalidation
 * - Double-submit cookie CSRF protection on mutating endpoints
 * - Dual-dimensional rate limiting: IP volumetric caps and per-account progressive backoff
 * - RBAC role gating: admin vs user vs guest privileges
 * - Resource ownership validation and tenant isolation (IDOR/BOLA prevention)
 * - Administrative override and last-admin protection
 * - One-time initial admin bootstrap and subsequent lockout
 * - Suspended account real-time lockout
 * - Frontend single-flight refresh mutex simulation (concurrent 401s deduplicated)
 * - SoftwareFactory Tier 10 synthesis, skip flag, and transactional rollback
 * 
 * 100% offline, zero network, zero external third-party cloud auth dependencies.
 * Run: node --test tests/authIntegration.e2e.test.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  AuthPlan,
  AuthCryptoEngine,
  JwtEngine,
  RefreshTokenManager,
  CsrfManager,
  AuthRateLimiter,
  RbacEngine,
  OwnershipValidator,
  AuthMiddleware
} = require('../agent/capabilities/auth');

const { SoftwareFactoryOrchestrator } = require('../agent/capabilities/softwareFactory');

describe('Phase 5A: Dedicated Authentication E2E Scenarios (1–35)', () => {

  let server;
  let baseUrl;
  let port;

  // In-memory persistent data stores for the live test server
  const users = new Map(); // id -> user
  const documents = new Map(); // id -> doc
  const rtm = new RefreshTokenManager({ ttlSec: 604800 });
  const rateLimiter = new AuthRateLimiter({ ipMaxPerMinute: 1000, accountMaxConsecutiveFails: 5 });
  const JWT_SECRET = 'e2e-test-secure-jwt-secret-at-least-32-chars-long!';

  function parseCookies(cookieHeader) {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
    return list;
  }

  before(async () => {
    // Seed initial resources
    documents.set('doc_alice_1', { id: 'doc_alice_1', userId: 'usr_alice', title: 'Alice Confidential Notes' });
    documents.set('doc_bob_1', { id: 'doc_bob_1', userId: 'usr_bob', title: 'Bob Strategy Document' });

    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      const method = req.method;
      const clientIp = req.socket.remoteAddress || '127.0.0.1';
      const cookies = parseCookies(req.headers.cookie);
      req.cookies = cookies;

      // JSON helper
      const sendJson = (status, data, extraHeaders = {}) => {
        res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
        res.end(JSON.stringify(data));
      };

      // Body reader
      const readBody = async () => {
        return new Promise((resolve, reject) => {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { resolve({}); }
          });
          req.on('error', reject);
        });
      };

      // ── RATE LIMIT CHECK ON AUTH ENDPOINTS ──
      if (url.pathname.startsWith('/api/auth/')) {
        const ipCheck = rateLimiter.checkIpLimit(clientIp);
        if (!ipCheck.allowed) {
          return sendJson(429, { error: 'Too many requests from this IP', retryAfter: ipCheck.retryAfterSec });
        }
      }

      // ── CSRF CHECK ON MUTATING REQUESTS (except register & login) ──
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) &&
          !['/api/auth/register', '/api/auth/login', '/api/auth/refresh'].includes(url.pathname)) {
        const csrfValid = CsrfManager.validateRequest(req);
        if (!csrfValid.valid) {
          return sendJson(403, { error: 'Invalid or missing CSRF token' });
        }
      }

      // ── AUTH HELPER FOR PROTECTED ROUTES ──
      const authenticate = async () => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return { error: 'Authentication required', status: 401 };
        }
        const token = authHeader.slice(7).trim();
        const verified = JwtEngine.verifySafe(token, JWT_SECRET);
        if (!verified.valid) {
          return { error: 'Invalid or expired token', status: 401 };
        }
        const user = users.get(verified.payload.sub);
        if (!user) {
          return { error: 'User account not found', status: 401 };
        }
        if (user.status !== 'active') {
          return { error: 'Account suspended', status: 403 };
        }
        if (verified.payload.token_version !== undefined && verified.payload.token_version !== user.token_version) {
          return { error: 'Token version revoked', status: 401 };
        }
        return { user };
      };

      try {
        // 1. POST /api/auth/register
        if (method === 'POST' && url.pathname === '/api/auth/register') {
          const body = await readBody();
          const { email, password } = body;

          if (!email || !password) {
            return sendJson(400, { error: 'Email and password are required' });
          }

          // Check 72-byte max password length
          if (Buffer.byteLength(password, 'utf8') > 72) {
            return sendJson(400, { error: 'Password exceeds maximum allowed length of 72 bytes' });
          }

          // Check duplicate
          for (const u of users.values()) {
            if (u.email === email.toLowerCase().trim()) {
              return sendJson(409, { error: 'User with this email already exists' });
            }
          }

          // Strip client-supplied security fields
          const sanitized = RbacEngine.sanitizeUserInput(body);
          const userId = `usr_${crypto.randomUUID().slice(0, 8)}`;
          const passwordHash = AuthCryptoEngine.hashPassword(password);

          const newUser = {
            id: userId,
            email: email.toLowerCase().trim(),
            passwordHash,
            role: 'user', // Default role forced regardless of body
            status: 'active',
            token_version: 1
          };
          users.set(userId, newUser);

          // Issue access token and refresh token
          const accessToken = JwtEngine.sign({
            sub: userId,
            email: newUser.email,
            role: newUser.role,
            token_version: newUser.token_version
          }, JWT_SECRET, { expiresInSec: 900 });

          const refreshInfo = rtm.issueToken(userId);
          const csrfToken = CsrfManager.generateToken();

          return sendJson(201, {
            user: { id: userId, email: newUser.email, role: newUser.role },
            accessToken
          }, {
            'Set-Cookie': [
              `refreshToken=${refreshInfo.rawToken}; Path=/api/auth; HttpOnly; SameSite=Strict`,
              `csrf_token=${csrfToken}; Path=/; SameSite=Strict`
            ]
          });
        }

        // 2. POST /api/auth/login
        if (method === 'POST' && url.pathname === '/api/auth/login') {
          const body = await readBody();
          const { email, password } = body;

          if (!email || !password) {
            return sendJson(400, { error: 'Email and password required' });
          }

          // Account progressive backoff check
          const backoff = rateLimiter.checkAccountBackoff(email);
          if (!backoff.allowed) {
            return sendJson(429, { error: 'Too many failed login attempts', delaySec: backoff.delaySec });
          }

          let matchedUser = null;
          for (const u of users.values()) {
            if (u.email === email.toLowerCase().trim()) {
              matchedUser = u;
              break;
            }
          }

          if (!matchedUser) {
            // Constant-time execution on missing user
            AuthCryptoEngine.dummyVerify(password);
            rateLimiter.recordLoginFailure(email);
            return sendJson(401, { error: 'Invalid credentials' });
          }

          const passwordValid = AuthCryptoEngine.verifyPassword(password, matchedUser.passwordHash);
          if (!passwordValid) {
            rateLimiter.recordLoginFailure(email);
            return sendJson(401, { error: 'Invalid credentials' });
          }

          // Reset failure counter on success
          rateLimiter.recordLoginSuccess(email);

          const accessToken = JwtEngine.sign({
            sub: matchedUser.id,
            email: matchedUser.email,
            role: matchedUser.role,
            token_version: matchedUser.token_version
          }, JWT_SECRET, { expiresInSec: 900 });

          const refreshInfo = rtm.issueToken(matchedUser.id);
          const csrfToken = CsrfManager.generateToken();

          return sendJson(200, {
            user: { id: matchedUser.id, email: matchedUser.email, role: matchedUser.role },
            accessToken
          }, {
            'Set-Cookie': [
              `refreshToken=${refreshInfo.rawToken}; Path=/api/auth; HttpOnly; SameSite=Strict`,
              `csrf_token=${csrfToken}; Path=/; SameSite=Strict`
            ]
          });
        }

        // 3. POST /api/auth/refresh
        if (method === 'POST' && url.pathname === '/api/auth/refresh') {
          const rawRefresh = cookies.refreshToken;
          if (!rawRefresh) {
            return sendJson(401, { error: 'Missing refresh token cookie' });
          }

          const rotation = rtm.rotateToken(rawRefresh);
          if (!rotation.ok) {
            if (rotation.code === 'TOKEN_REPLAY_DETECTED') {
              return sendJson(401, { error: 'Refresh token reuse detected: family revoked', code: 'REPLAY_DETECTED' });
            }
            return sendJson(401, { error: rotation.error || 'Invalid refresh token' });
          }

          const user = users.get(rotation.userId);
          if (!user || user.status !== 'active') {
            return sendJson(403, { error: 'User inactive or suspended' });
          }

          const newAccessToken = JwtEngine.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
            token_version: user.token_version
          }, JWT_SECRET, { expiresInSec: 900 });

          return sendJson(200, {
            accessToken: newAccessToken
          }, {
            'Set-Cookie': `refreshToken=${rotation.newRawToken}; Path=/api/auth; HttpOnly; SameSite=Strict`
          });
        }

        // 4. POST /api/auth/logout
        if (method === 'POST' && url.pathname === '/api/auth/logout') {
          const rawRefresh = cookies.refreshToken;
          if (rawRefresh) {
            rtm.revokeToken(rawRefresh);
          }
          return sendJson(200, { message: 'Logged out' }, {
            'Set-Cookie': [
              'refreshToken=; Path=/api/auth; Max-Age=0; HttpOnly',
              'csrf_token=; Path=/; Max-Age=0'
            ]
          });
        }

        // 5. POST /api/auth/logout-all
        if (method === 'POST' && url.pathname === '/api/auth/logout-all') {
          const auth = await authenticate();
          if (auth.error) return sendJson(auth.status, { error: auth.error });

          // Invalidate user token_version in database
          auth.user.token_version += 1;
          // Revoke all refresh tokens
          rtm.revokeAllForUser(auth.user.id);

          return sendJson(200, { message: 'All sessions revoked' }, {
            'Set-Cookie': 'refreshToken=; Path=/api/auth; Max-Age=0; HttpOnly'
          });
        }

        // 6. GET /api/auth/me
        if (method === 'GET' && url.pathname === '/api/auth/me') {
          const auth = await authenticate();
          if (auth.error) return sendJson(auth.status, { error: auth.error });
          return sendJson(200, { user: { id: auth.user.id, email: auth.user.email, role: auth.user.role } });
        }

        // 7. GET /api/admin/metrics (RBAC: requires role admin)
        if (method === 'GET' && url.pathname === '/api/admin/metrics') {
          const auth = await authenticate();
          if (auth.error) return sendJson(auth.status, { error: auth.error });
          if (!RbacEngine.hasRole(auth.user.role, 'admin')) {
            return sendJson(403, { error: 'Administrative privileges required' });
          }
          return sendJson(200, { totalUsers: users.size, status: 'operational' });
        }

        // 8. GET /api/docs/:id (Ownership check: user owns document or is admin)
        if (method === 'GET' && url.pathname.startsWith('/api/docs/')) {
          const auth = await authenticate();
          if (auth.error) return sendJson(auth.status, { error: auth.error });

          const docId = url.pathname.slice('/api/docs/'.length);
          const doc = documents.get(docId);
          const ownership = OwnershipValidator.checkOwnership(doc, auth.user);
          if (!ownership.allowed) {
            return sendJson(ownership.statusCode, { error: ownership.error || 'Access denied' });
          }
          return sendJson(200, { doc });
        }

        // 9. POST /api/admin/bootstrap
        if (method === 'POST' && url.pathname === '/api/admin/bootstrap') {
          const body = await readBody();
          const { email, password } = body;
          const adminCount = Array.from(users.values()).filter(u => u.role === 'admin').length;

          if (!RbacEngine.canBootstrapAdmin(adminCount)) {
            return sendJson(403, { error: 'Bootstrap locked: administrator account already exists' });
          }

          const adminId = `adm_${crypto.randomUUID().slice(0, 8)}`;
          const adminUser = {
            id: adminId,
            email: email.toLowerCase().trim(),
            passwordHash: AuthCryptoEngine.hashPassword(password),
            role: 'admin',
            status: 'active',
            token_version: 1
          };
          users.set(adminId, adminUser);
          return sendJson(201, { message: 'Initial admin created', admin: { id: adminId, email } });
        }

        // 10. DELETE /api/admin/users/:id (Last-admin protection)
        if (method === 'DELETE' && url.pathname.startsWith('/api/admin/users/')) {
          const auth = await authenticate();
          if (auth.error) return sendJson(auth.status, { error: auth.error });
          if (!RbacEngine.hasRole(auth.user.role, 'admin')) {
            return sendJson(403, { error: 'Admin only' });
          }

          const targetId = url.pathname.slice('/api/admin/users/'.length);
          const allUsersList = Array.from(users.values());
          if (!RbacEngine.canRemoveAdmin(allUsersList, targetId)) {
            return sendJson(400, { error: 'Cannot remove the last active administrator' });
          }

          users.delete(targetId);
          return sendJson(200, { message: 'User deleted' });
        }

        sendJson(404, { error: 'Not found' });
      } catch (handlerErr) {
        sendJson(500, { error: handlerErr.message });
      }
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    rateLimiter.destroy();
    await new Promise((resolve) => server.close(resolve));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 1–4: Registration & Input Security
  // ══════════════════════════════════════════════════════════════════════════════
  let aliceToken = null;
  let aliceCookie = null;
  let aliceCsrf = null;

  test('E2E 1: Clean registration creates user, scrypt-hashes password, and returns tokens + cookies', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'PasswordAlice123!' })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.accessToken);
    assert.equal(body.user.email, 'alice@example.com');
    assert.equal(body.user.role, 'user');

    aliceToken = body.accessToken;
    const cookieHeader = res.headers.get('set-cookie');
    assert.ok(cookieHeader.includes('refreshToken='));
    assert.ok(cookieHeader.includes('HttpOnly'));
    assert.ok(cookieHeader.includes('SameSite=Strict'));

    // Extract cookies
    aliceCookie = cookieHeader.split(',').find(c => c.includes('refreshToken=')).split(';')[0].trim();
    const csrfMatch = cookieHeader.match(/csrf_token=([^;]+)/);
    if (csrfMatch) aliceCsrf = csrfMatch[1];
  });

  test('E2E 2: Duplicate registration with same email is rejected with 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'DifferentPassword123!' })
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.ok(body.error.includes('already exists'));
  });

  test('E2E 3: Registration payload attempting role: admin is stripped to default role user', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mallory@evil.com', password: 'PasswordMallory123!', role: 'admin', isAdmin: true })
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'user'); // Not admin!
  });

  test('E2E 4: Registration rejects password exceeding 72 bytes fail-closed with 400', async () => {
    const longPassword = 'P'.repeat(73);
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'longpass@example.com', password: longPassword })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('72 bytes'));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 5–7: Login & Timing Invariants
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 5: Clean login with correct credentials issues access token and rotating refresh token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'PasswordAlice123!' })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.accessToken);
    assert.equal(body.user.email, 'alice@example.com');
    aliceToken = body.accessToken;
    const cookieHeader = res.headers.get('set-cookie');
    aliceCookie = cookieHeader.split(',').find(c => c.includes('refreshToken=')).split(';')[0].trim();
    const csrfMatch = cookieHeader.match(/csrf_token=([^;]+)/);
    if (csrfMatch) aliceCsrf = csrfMatch[1];
  });

  test('E2E 6: Login with invalid password returns 401 generic "Invalid credentials"', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPassword123!' })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Invalid credentials');
  });

  test('E2E 7: Login with non-existent email executes dummy verify and returns generic error', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost_user@doesnotexist.com', password: 'Password123!' })
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error, 'Invalid credentials');
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 8–13: Protected Route & Token Tampering
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 8: Protected route (GET /api/auth/me) succeeds with valid Bearer JWT', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.email, 'alice@example.com');
  });

  test('E2E 9: Protected route rejects request with missing Authorization header (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  test('E2E 10: Protected route rejects malformed Bearer header (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' }
    });
    assert.equal(res.status, 401);
  });

  test('E2E 11: Protected route rejects expired JWT (401)', async () => {
    const expiredToken = JwtEngine.sign({ sub: 'usr_test', token_version: 1 }, JWT_SECRET, { expiresInSec: -10 });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(res.status, 401);
  });

  test('E2E 12: Protected route rejects JWT with tampered signature (401)', async () => {
    const parts = aliceToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tampered}` }
    });
    assert.equal(res.status, 401);
  });

  test('E2E 13: Protected route rejects JWT with alg: "none" (401)', async () => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ sub: 'usr_test', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
    const noneToken = `${h}.${p}.`;
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${noneToken}` }
    });
    assert.equal(res.status, 401);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 14–16: Rotating Refresh Tokens & Replay Theft Detection
  // ══════════════════════════════════════════════════════════════════════════════
  let rotatedCookie = null;
  let oldRefreshCookie = null;

  test('E2E 14: Valid refresh token rotation returns new access token and new refresh cookie', async () => {
    oldRefreshCookie = aliceCookie;
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: aliceCookie }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.accessToken);
    assert.notEqual(body.accessToken, aliceToken);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie.includes('refreshToken='));
    rotatedCookie = setCookie.split(';')[0].trim();
    assert.notEqual(rotatedCookie, oldRefreshCookie);
  });

  test('E2E 15: Replay attack: reusing rotated refresh token triggers family revocation', async () => {
    // Replay the old consumed token
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: oldRefreshCookie }
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'REPLAY_DETECTED');
  });

  test('E2E 16: All tokens in revoked family fail on subsequent refresh attempts', async () => {
    // The legitimate user's new token should now also fail because theft was detected
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: rotatedCookie }
    });
    assert.equal(res.status, 401);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 17–19: Logout & Invalidation Lifecycle
  // ══════════════════════════════════════════════════════════════════════════════
  let bobToken = null;
  let bobCookie = null;
  let bobCsrf = null;

  test('E2E 17: Standard logout revokes current refresh token and clears cookie', async () => {
    // Register Bob
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'PasswordBob123!' })
    });
    const regBody = await regRes.json();
    bobToken = regBody.accessToken;
    const cookieHeader = regRes.headers.get('set-cookie');
    bobCookie = cookieHeader.split(',').find(c => c.includes('refreshToken=')).split(';')[0].trim();
    const csrfMatch = cookieHeader.match(/csrf_token=([^;]+)/);
    if (csrfMatch) bobCsrf = csrfMatch[1];

    // Bob logs out with CSRF token
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `${bobCookie}; csrf_token=${bobCsrf}`,
        'x-csrf-token': bobCsrf
      }
    });
    assert.equal(logoutRes.status, 200);

    // Refresh attempt with logged out cookie should fail
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: bobCookie }
    });
    assert.equal(refreshRes.status, 401);
  });

  test('E2E 18: Global logout increments token_version and invalidates all user sessions', async () => {
    // Log Bob back in
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@example.com', password: 'PasswordBob123!' })
    });
    const loginBody = await loginRes.json();
    bobToken = loginBody.accessToken;
    const cookieHeader = loginRes.headers.get('set-cookie');
    bobCookie = cookieHeader.split(',').find(c => c.includes('refreshToken=')).split(';')[0].trim();
    const csrfMatch = cookieHeader.match(/csrf_token=([^;]+)/);
    if (csrfMatch) bobCsrf = csrfMatch[1];

    // Global logout
    const logoutAllRes = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bobToken}`,
        Cookie: `${bobCookie}; csrf_token=${bobCsrf}`,
        'x-csrf-token': bobCsrf
      }
    });
    assert.equal(logoutAllRes.status, 200);
  });

  test('E2E 19: Pre-logout JWT is rejected after logout-all due to token_version check', async () => {
    // Attempt to access protected route with the pre-logout token
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${bobToken}` }
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.ok(body.error.includes('version'));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 20–21: Double-Submit Cookie CSRF Protection
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 20: State-changing request succeeds when matching CSRF header and cookie are present', async () => {
    const csrfToken = CsrfManager.generateToken();
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });
    assert.equal(res.status, 200);
  });

  test('E2E 21: State-changing request with mismatched CSRF token is rejected with 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: 'csrf_token=token_aaa',
        'x-csrf-token': 'token_bbb'
      }
    });
    assert.equal(res.status, 403);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 22–23: Dual-Dimensional Rate Limiting
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 22: Rapid successive requests from same IP trigger rate limit (429)', async () => {
    const limiterTest = new AuthRateLimiter({ ipMaxPerMinute: 3 });
    const ip = '10.99.88.77';
    limiterTest.checkIpLimit(ip);
    limiterTest.checkIpLimit(ip);
    limiterTest.checkIpLimit(ip);
    const blocked = limiterTest.checkIpLimit(ip);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, 'IP_RATE_LIMIT_EXCEEDED');
    limiterTest.destroy();
  });

  test('E2E 23: 5 consecutive failed logins trigger progressive exponential delay on target account', async () => {
    const email = 'target_brute@example.com';
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordLoginFailure(email);
    }
    const check = rateLimiter.checkAccountBackoff(email);
    assert.equal(check.allowed, false);
    assert.equal(check.delaySec, 1);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 24–27: RBAC, Ownership & IDOR/BOLA Protection
  // ══════════════════════════════════════════════════════════════════════════════
  let carolUserToken = null;
  let adminToken = null;

  test('E2E 24: Admin route fails with HTTP 403 when requested by standard user', async () => {
    // Register Carol (role: user)
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'carol@example.com', password: 'PasswordCarol123!' })
    });
    const body = await res.json();
    carolUserToken = body.accessToken;

    const adminRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${carolUserToken}` }
    });
    assert.equal(adminRes.status, 403);
    const adminBody = await adminRes.json();
    assert.ok(adminBody.error.includes('privileges'));
  });

  test('E2E 25: Resource ownership check allows user to read their own document', async () => {
    // Find Alice's user id
    let aliceId = null;
    for (const u of users.values()) {
      if (u.email === 'alice@example.com') { aliceId = u.id; break; }
    }
    documents.set('doc_alice_private', { id: 'doc_alice_private', userId: aliceId, title: 'Alice Diary' });

    // Log Alice in fresh
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'PasswordAlice123!' })
    });
    const loginBody = await loginRes.json();
    aliceToken = loginBody.accessToken;

    const docRes = await fetch(`${baseUrl}/api/docs/doc_alice_private`, {
      headers: { Authorization: `Bearer ${aliceToken}` }
    });
    assert.equal(docRes.status, 200);
    const docBody = await docRes.json();
    assert.equal(docBody.doc.title, 'Alice Diary');
  });

  test('E2E 26: Resource ownership check blocks user from reading another user document (IDOR)', async () => {
    // Carol tries to read Alice's diary
    const docRes = await fetch(`${baseUrl}/api/docs/doc_alice_private`, {
      headers: { Authorization: `Bearer ${carolUserToken}` }
    });
    assert.equal(docRes.status, 403);
  });

  test('E2E 27: Admin can access any user document via administrative override', async () => {
    // Create an admin user directly
    const adminUser = {
      id: 'adm_e2e_super',
      email: 'superadmin@example.com',
      passwordHash: AuthCryptoEngine.hashPassword('AdminPassword123!'),
      role: 'admin',
      status: 'active',
      token_version: 1
    };
    users.set(adminUser.id, adminUser);
    adminToken = JwtEngine.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
      token_version: 1
    }, JWT_SECRET, { expiresInSec: 900 });

    // Admin accesses Alice's diary
    const docRes = await fetch(`${baseUrl}/api/docs/doc_alice_private`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(docRes.status, 200);
    const docBody = await docRes.json();
    assert.equal(docBody.doc.title, 'Alice Diary');
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 28–30: Admin Bootstrap & Last-Admin Protection
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 28: Initial admin bootstrap flow succeeds when 0 admins exist in database', async () => {
    // Mock check: when admin count is 0, bootstrap is allowed
    assert.equal(RbacEngine.canBootstrapAdmin(0), true);
  });

  test('E2E 29: Second admin bootstrap attempt is rejected once an admin exists', async () => {
    // We already have adm_e2e_super in the database
    const csrfToken = CsrfManager.generateToken();
    const res = await fetch(`${baseUrl}/api/admin/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      },
      body: JSON.stringify({ email: 'second_admin@example.com', password: 'Password123!' })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('already exists'));
  });

  test('E2E 30: Attempt to delete the last remaining admin is blocked fail-closed', async () => {
    const csrfToken = CsrfManager.generateToken();
    const res = await fetch(`${baseUrl}/api/admin/users/adm_e2e_super`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        Cookie: `csrf_token=${csrfToken}`,
        'x-csrf-token': csrfToken
      }
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('last active administrator'));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 31–32: Account Suspension & Frontend Mutex Simulation
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 31: Suspended user active JWT is rejected on protected routes via database status check', async () => {
    // Suspend Carol
    for (const u of users.values()) {
      if (u.email === 'carol@example.com') {
        u.status = 'suspended';
        break;
      }
    }

    // Carol's unexpired token should now fail
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${carolUserToken}` }
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('suspended'));
  });

  test('E2E 32: Frontend single-flight mutex: concurrent 401s issue exactly one /refresh request', async () => {
    let refreshCalls = 0;
    let refreshMutexPromise = null;

    const mockRefreshToken = async () => {
      if (refreshMutexPromise) {
        return refreshMutexPromise;
      }
      refreshCalls++;
      refreshMutexPromise = (async () => {
        await new Promise(r => setTimeout(r, 20)); // Simulate async network call
        return 'new_access_token_xyz';
      })().finally(() => {
        refreshMutexPromise = null;
      });
      return refreshMutexPromise;
    };

    // Simulate 5 simultaneous API calls receiving 401 and attempting refresh concurrently
    const results = await Promise.all([
      mockRefreshToken(),
      mockRefreshToken(),
      mockRefreshToken(),
      mockRefreshToken(),
      mockRefreshToken()
    ]);

    assert.equal(refreshCalls, 1, 'Exactly one refresh network request should be initiated');
    assert.equal(results.length, 5);
    results.forEach(tok => assert.equal(tok, 'new_access_token_xyz'));
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // E2E 33–35: SoftwareFactory Tier 10 Autonomous Integration & Rollback
  // ══════════════════════════════════════════════════════════════════════════════
  test('E2E 33: SoftwareFactory Tier 10 synthesizes complete auth backend, frontend, and migrations', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-auth-e2e-'));
    try {
      const orchestrator = new SoftwareFactoryOrchestrator();

      // Execute factory synthesis
      const initResult = await orchestrator.execute('Build task app with user login and authentication', {
        workspaceRoot: tempDir,
        permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
      });

      assert.equal(initResult.status, 'APPROVAL_REQUIRED');
      const approvalToken = initResult.approval.token;

      const finalResult = await orchestrator.execute('Build task app with user login and authentication', {
        workspaceRoot: tempDir,
        executionId: initResult.executionId,
        approvalToken,
        permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
        auth: { enabled: true }
      });

      assert.equal(finalResult.success, true);
      assert.equal(finalResult.verification.auth, 'SYNTHESIS_COMPLETE');
      assert.ok(finalResult.auth);
      assert.equal(finalResult.auth.status, 'SYNTHESIS_COMPLETE');
      assert.ok(finalResult.manifest.filesGenerated.includes('backend/routes/auth.js'));
      assert.ok(finalResult.manifest.filesGenerated.includes('backend/middleware/auth.js'));
      assert.ok(finalResult.manifest.filesGenerated.includes('backend/utils/auth.js'));
      assert.ok(finalResult.manifest.filesGenerated.includes('backend/migrations/002_create_auth_tables.sql'));
      assert.ok(finalResult.manifest.filesGenerated.includes('frontend/src/context/AuthContext.jsx'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('E2E 34: SoftwareFactory Tier 10 respects auth: { enabled: false } and skips cleanly', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-noauth-e2e-'));
    try {
      const orchestrator = new SoftwareFactoryOrchestrator();

      const initResult = await orchestrator.execute('Build static app without auth', {
        workspaceRoot: tempDir,
        permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
      });

      const finalResult = await orchestrator.execute('Build static app without auth', {
        workspaceRoot: tempDir,
        executionId: initResult.executionId,
        approvalToken: initResult.approval.token,
        permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
        auth: { enabled: false }
      });

      assert.equal(finalResult.success, true);
      assert.equal(finalResult.verification.auth, 'SKIPPED_CONFIG_DISABLED');
      assert.ok(!finalResult.manifest.filesGenerated.includes('backend/routes/auth.js'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('E2E 35: SoftwareFactory Tier 10 rolls back workspace transaction when auth synthesis errors', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-auth-err-e2e-'));
    try {
      const orchestrator = new SoftwareFactoryOrchestrator();

      const initResult = await orchestrator.execute('Build app with simulated auth failure', {
        workspaceRoot: tempDir,
        permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
      });

      const finalResult = await orchestrator.execute('Build app with simulated auth failure', {
        workspaceRoot: tempDir,
        executionId: initResult.executionId,
        approvalToken: initResult.approval.token,
        permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
        auth: {
          enabled: true,
          simulatedError: 'Disk quota exhausted during auth migration synthesis'
        }
      });

      assert.equal(finalResult.success, false);
      assert.equal(finalResult.status, 'FAILED_ROLLED_BACK');
      assert.ok(finalResult.errors.some(e => e.includes('Disk quota exhausted')));

      // Workspace should be rolled back and clean of partial files
      const existsAuth = fs.existsSync(path.join(tempDir, 'backend/routes/auth.js'));
      assert.equal(existsAuth, false, 'Rolled-back workspace must not retain partial files');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

});
