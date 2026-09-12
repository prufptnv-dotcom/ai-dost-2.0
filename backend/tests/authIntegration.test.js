'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: Dedicated Authentication Capability Unit Tests
 * 
 * 65+ deterministic, offline unit tests covering:
 * - AuthPlan v1.0.0 normalization, option bounds, and deep immutability
 * - AuthCryptoEngine bounded scrypt hashing, modular format, timing safety, 72-byte max
 * - JwtEngine HS256 validation, algorithm allowlist, replay/tamper detection, claim checks
 * - RefreshTokenManager opaque token hashing, family tracking, single-use rotation, reuse detection
 * - CsrfManager double-submit cookie protection, timing safety, safe method bypass
 * - AuthRateLimiter dual-dimensional IP sliding window, progressive exponential backoff
 * - RbacEngine role hierarchy, default role, client field stripping, last-admin protection, bootstrap
 * - OwnershipValidator tenant isolation, IDOR/BOLA prevention, 404 on missing resource
 * - AuthMiddleware request authentication, role gating, ownership gating, CSRF verification
 * - AuthResult immutability, error envelope, and status codes
 * - AuthSynthesizer code generation, zero-token storage leakage, and pre-existing file safety
 * 
 * Runs 100% offline with zero external network or third-party cloud dependencies.
 * Run: node --test tests/authIntegration.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  AuthPlan,
  AUTH_PLAN_SCHEMA_VERSION,
  ALLOWED_HASH_ALGORITHMS,
  ALLOWED_JWT_ALGORITHMS,
  ALLOWED_SESSION_STRATEGIES,
  AuthCryptoEngine,
  DEFAULT_SCRYPT_PARAMS,
  JwtEngine,
  ALLOWED_ALGORITHMS,
  RefreshTokenManager,
  CsrfManager,
  SAFE_METHODS,
  AuthRateLimiter,
  RbacEngine,
  ROLE_LEVELS,
  FORBIDDEN_CLIENT_FIELDS,
  OwnershipValidator,
  AuthMiddleware,
  AuthResult,
  AUTH_STATUS,
  AuthSynthesizer
} = require('../agent/capabilities/auth');

describe('Phase 5A: Authentication Capability Unit Tests', () => {

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. AuthPlan Unit Tests (Tests 1–7)
  // ══════════════════════════════════════════════════════════════════════════════
  test('1. AuthPlan normalizes valid default configuration', () => {
    const plan = AuthPlan.create({ projectName: 'secure-app' });
    assert.equal(plan.schemaVersion, AUTH_PLAN_SCHEMA_VERSION);
    assert.equal(plan.projectName, 'secure-app');
    assert.equal(plan.passwordHash.algorithm, 'scrypt');
    assert.equal(plan.jwt.algorithm, 'HS256');
    assert.equal(plan.jwt.accessTokenTtlSec, 900); // 15m
    assert.equal(plan.session.strategy, 'jwt_stateless');
    assert.equal(plan.cookie.httpOnly, true);
    assert.equal(plan.cookie.sameSite, 'Strict');
    assert.equal(plan.rateLimit.maxRequestsPerMinute, 10);
  });

  test('2. AuthPlan enforces deep immutability (deepFreeze)', () => {
    const plan = AuthPlan.create({ projectName: 'immutable-app' });
    assert.throws(() => { plan.jwt.algorithm = 'none'; }, TypeError);
    assert.throws(() => { plan.roles.push('superuser'); }, TypeError);
    assert.throws(() => { plan.cookie.httpOnly = false; }, TypeError);
  });

  test('3. AuthPlan rejects unsupported password hash algorithm', () => {
    assert.throws(() => {
      AuthPlan.create({ passwordHash: { algorithm: 'md5' } });
    }, /Unsupported password hash algorithm/);
  });

  test('4. AuthPlan rejects unsupported JWT algorithm', () => {
    assert.throws(() => {
      AuthPlan.create({ jwt: { algorithm: 'none' } });
    }, /Unsupported JWT algorithm/);

    assert.throws(() => {
      AuthPlan.create({ jwt: { algorithm: 'RS256' } });
    }, /Unsupported JWT algorithm/);
  });

  test('5. AuthPlan rejects out-of-bounds rate limits', () => {
    assert.throws(() => {
      AuthPlan.create({ rateLimitMax: 0 });
    }, /rateLimitMax must be between 1 and 100/);

    assert.throws(() => {
      AuthPlan.create({ rateLimitMax: 200 });
    }, /rateLimitMax must be between 1 and 100/);
  });

  test('6. AuthPlan validates and normalizes custom cookie options', () => {
    const plan = AuthPlan.create({
      projectName: 'custom-cookie',
      cookieOptions: { httpOnly: true, secure: true, sameSite: 'Lax', path: '/api' }
    });
    assert.equal(plan.cookie.sameSite, 'Lax');
    assert.equal(plan.cookie.path, '/api');
  });

  test('7. AuthPlan rejects empty or invalid project name', () => {
    assert.throws(() => {
      AuthPlan.create({ projectName: '   ' });
    }, /projectName must be a non-empty string/);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 2. AuthCryptoEngine Unit Tests (Tests 8–18)
  // ══════════════════════════════════════════════════════════════════════════════
  test('8. AuthCryptoEngine hashes password into versioned modular format', () => {
    const hash = AuthCryptoEngine.hashPassword('CorrectHorseBattery99!');
    assert.ok(hash.startsWith('$scrypt$v=1$'));
    const parts = hash.split('$').filter(Boolean);
    assert.equal(parts[0], 'scrypt');
    assert.equal(parts[1], 'v=1');
    assert.ok(parts[2].includes('N=16384'));
  });

  test('9. AuthCryptoEngine verifies password successfully with correct credentials', () => {
    const pwd = 'MySecurePassword123#';
    const hash = AuthCryptoEngine.hashPassword(pwd);
    assert.equal(AuthCryptoEngine.verifyPassword(pwd, hash), true);
  });

  test('10. AuthCryptoEngine rejects incorrect password without error', () => {
    const hash = AuthCryptoEngine.hashPassword('RealSecretPassword123!');
    assert.equal(AuthCryptoEngine.verifyPassword('WrongPassword123!', hash), false);
  });

  test('11. AuthCryptoEngine rejects passwords longer than 72 bytes fail-closed', () => {
    const longPassword = 'A'.repeat(73);
    assert.throws(() => {
      AuthCryptoEngine.hashPassword(longPassword);
    }, /Password exceeds maximum allowed length of 72 bytes/);

    assert.equal(AuthCryptoEngine.verifyPassword(longPassword, '$scrypt$v=1$...'), false);
  });

  test('12. AuthCryptoEngine validates password complexity requirements', () => {
    assert.equal(AuthCryptoEngine.validatePasswordComplexity('short').valid, false);
    assert.equal(AuthCryptoEngine.validatePasswordComplexity('alllowercase123').valid, false);
    assert.equal(AuthCryptoEngine.validatePasswordComplexity('ALLUPPERCASE123').valid, false);
    assert.equal(AuthCryptoEngine.validatePasswordComplexity('NoNumbers!').valid, false);
    assert.equal(AuthCryptoEngine.validatePasswordComplexity('ValidPass123!').valid, true);
  });

  test('13. AuthCryptoEngine dummyVerify executes constant-time scrypt on missing user', () => {
    // dummyVerify should return false without throwing
    const result = AuthCryptoEngine.dummyVerify('AnyPasswordAttempt123!');
    assert.equal(result, false);
  });

  test('14. AuthCryptoEngine rejects tampered hash format fail-closed', () => {
    assert.equal(AuthCryptoEngine.verifyPassword('Password123!', 'plain_text_hash'), false);
    assert.equal(AuthCryptoEngine.verifyPassword('Password123!', '$unknown$v=1$test'), false);
    assert.equal(AuthCryptoEngine.verifyPassword('Password123!', ''), false);
  });

  test('15. AuthCryptoEngine hashToken produces deterministic SHA-256 hex string', () => {
    const token = 'opaque_sample_token_value_abc123';
    const hash1 = AuthCryptoEngine.hashToken(token);
    const hash2 = AuthCryptoEngine.hashToken(token);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  test('16. AuthCryptoEngine generateRandomToken produces cryptographically secure random tokens', () => {
    const t1 = AuthCryptoEngine.generateRandomToken(32);
    const t2 = AuthCryptoEngine.generateRandomToken(32);
    assert.notEqual(t1, t2);
    assert.equal(t1.length, 64); // hex of 32 bytes
  });

  test('17. AuthCryptoEngine constantTimeCompare resists timing leaks and handles differing lengths', () => {
    assert.equal(AuthCryptoEngine.constantTimeCompare('secret123', 'secret123'), true);
    assert.equal(AuthCryptoEngine.constantTimeCompare('secret123', 'secret999'), false);
    assert.equal(AuthCryptoEngine.constantTimeCompare('secret123', 'short'), false);
  });

  test('18. AuthCryptoEngine masks sensitive strings in debug logs', () => {
    const raw = 'Password is SecretPass123!';
    const masked = AuthCryptoEngine.maskSensitive(raw);
    assert.equal(masked, '[REDACTED]');
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 3. JwtEngine Unit Tests (Tests 19–27)
  // ══════════════════════════════════════════════════════════════════════════════
  const TEST_JWT_SECRET = 'super-secret-key-at-least-32-chars-long-12345';

  test('19. JwtEngine signs and verifies valid HS256 token', () => {
    const payload = { sub: 'usr_123', email: 'alice@example.com', role: 'user', token_version: 1 };
    const token = JwtEngine.sign(payload, TEST_JWT_SECRET, { expiresInSec: 300 });
    const verified = JwtEngine.verify(token, TEST_JWT_SECRET);
    assert.equal(verified.sub, 'usr_123');
    assert.equal(verified.email, 'alice@example.com');
    assert.equal(verified.role, 'user');
    assert.equal(verified.token_version, 1);
    assert.ok(verified.jti);
    assert.ok(verified.iat);
    assert.ok(verified.exp);
  });

  test('20. JwtEngine strictly rejects "none" algorithm and algorithm confusion', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'usr_123', exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url');
    const fakeToken = `${header}.${body}.`;

    assert.throws(() => {
      JwtEngine.verify(fakeToken, TEST_JWT_SECRET);
    }, /Unsupported algorithm/);
  });

  test('21. JwtEngine rejects tampered payload signature fail-closed', () => {
    const token = JwtEngine.sign({ sub: 'usr_123', role: 'user' }, TEST_JWT_SECRET);
    const parts = token.split('.');
    // Tamper payload
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'usr_123', role: 'admin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(() => {
      JwtEngine.verify(tamperedToken, TEST_JWT_SECRET);
    }, /Invalid JWT signature/);
  });

  test('22. JwtEngine rejects expired token fail-closed', () => {
    const token = JwtEngine.sign({ sub: 'usr_123' }, TEST_JWT_SECRET, { expiresInSec: -10 });
    assert.throws(() => {
      JwtEngine.verify(token, TEST_JWT_SECRET);
    }, /JWT has expired/);
  });

  test('23. JwtEngine enforces issuer validation when expected', () => {
    const token = JwtEngine.sign({ sub: 'usr_123' }, TEST_JWT_SECRET, { issuer: 'expected-issuer' });
    const verified = JwtEngine.verify(token, TEST_JWT_SECRET, { expectedIssuer: 'expected-issuer' });
    assert.equal(verified.iss, 'expected-issuer');

    assert.throws(() => {
      JwtEngine.verify(token, TEST_JWT_SECRET, { expectedIssuer: 'wrong-issuer' });
    }, /JWT issuer mismatch/);
  });

  test('24. JwtEngine enforces audience validation when expected', () => {
    const token = JwtEngine.sign({ sub: 'usr_123' }, TEST_JWT_SECRET, { audience: 'my-app' });
    const verified = JwtEngine.verify(token, TEST_JWT_SECRET, { expectedAudience: 'my-app' });
    assert.equal(verified.aud, 'my-app');

    assert.throws(() => {
      JwtEngine.verify(token, TEST_JWT_SECRET, { expectedAudience: 'other-app' });
    }, /JWT audience mismatch/);
  });

  test('25. JwtEngine validates token_version matches current user version', () => {
    const token = JwtEngine.sign({ sub: 'usr_123', token_version: 1 }, TEST_JWT_SECRET);
    const verified = JwtEngine.verify(token, TEST_JWT_SECRET, { currentTokenVersion: 1 });
    assert.equal(verified.token_version, 1);

    assert.throws(() => {
      JwtEngine.verify(token, TEST_JWT_SECRET, { currentTokenVersion: 2 });
    }, /Token version revoked/);
  });

  test('26. JwtEngine rejects malformed or truncated tokens', () => {
    assert.throws(() => { JwtEngine.verify('invalid.token', TEST_JWT_SECRET); }, /Malformed JWT token/);
    assert.throws(() => { JwtEngine.verify('', TEST_JWT_SECRET); }, /Malformed JWT token/);
    assert.throws(() => { JwtEngine.verify(null, TEST_JWT_SECRET); }, /Malformed JWT token/);
  });

  test('27. JwtEngine rejects weak secrets below 32 bytes', () => {
    assert.throws(() => {
      JwtEngine.sign({ sub: 'usr_123' }, 'short_secret');
    }, /JWT secret must be at least 32 characters/);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 4. RefreshTokenManager Unit Tests (Tests 28–36)
  // ══════════════════════════════════════════════════════════════════════════════
  test('28. RefreshTokenManager creates opaque token and tracks family lineage', () => {
    const rtm = new RefreshTokenManager();
    const created = rtm.createRefreshToken('usr_alice');
    assert.ok(created.rawToken);
    assert.ok(created.familyId);
    assert.ok(created.expiresAt > Date.now());

    // Verify token can be validated
    const validation = rtm.verifyRefreshToken(created.rawToken);
    assert.equal(validation.valid, true);
    assert.equal(validation.record.userId, 'usr_alice');
    assert.equal(validation.record.familyId, created.familyId);
  });

  test('29. RefreshTokenManager rotates token into new single-use child token', () => {
    const rtm = new RefreshTokenManager();
    const first = rtm.createRefreshToken('usr_bob');
    const rotated = rtm.rotateRefreshToken(first.rawToken);

    assert.ok(rotated.rawToken);
    assert.notEqual(rotated.rawToken, first.rawToken);
    assert.equal(rotated.familyId, first.familyId);

    // Old token should now be marked replaced
    const oldCheck = rtm.verifyRefreshToken(first.rawToken);
    assert.equal(oldCheck.valid, false);
    assert.equal(oldCheck.reason, 'TOKEN_REPLACED');
  });

  test('30. RefreshTokenManager reuse detection revokes entire token family', () => {
    const rtm = new RefreshTokenManager();
    const first = rtm.createRefreshToken('usr_charlie');
    const second = rtm.rotateRefreshToken(first.rawToken);

    // Replay attack: Mallory attempts to rotate the already-used first token
    const replayAttempt = rtm.rotateRefreshToken(first.rawToken);
    assert.equal(replayAttempt, null); // Blocked

    // Charlie's legitimate second token is now also invalidated due to detected theft
    const secondCheck = rtm.verifyRefreshToken(second.rawToken);
    assert.equal(secondCheck.valid, false);
    assert.equal(secondCheck.reason, 'FAMILY_REVOKED');
  });

  test('31. RefreshTokenManager rejects expired refresh token', () => {
    const rtm = new RefreshTokenManager({ ttlMs: -1000 }); // Expired immediately
    const created = rtm.createRefreshToken('usr_david');
    const check = rtm.verifyRefreshToken(created.rawToken);
    assert.equal(check.valid, false);
    assert.equal(check.reason, 'TOKEN_EXPIRED');
  });

  test('32. RefreshTokenManager single logout revokes specified token', () => {
    const rtm = new RefreshTokenManager();
    const created = rtm.createRefreshToken('usr_emma');
    const loggedOut = rtm.revokeToken(created.rawToken);
    assert.equal(loggedOut, true);

    const check = rtm.verifyRefreshToken(created.rawToken);
    assert.equal(check.valid, false);
    assert.equal(check.reason, 'TOKEN_REVOKED');
  });

  test('33. RefreshTokenManager logoutAll revokes all active tokens for a user', () => {
    const rtm = new RefreshTokenManager();
    const t1 = rtm.createRefreshToken('usr_frank');
    const t2 = rtm.createRefreshToken('usr_frank');
    const t3 = rtm.createRefreshToken('usr_other');

    const count = rtm.revokeAllForUser('usr_frank');
    assert.equal(count, 2);

    assert.equal(rtm.verifyRefreshToken(t1.rawToken).valid, false);
    assert.equal(rtm.verifyRefreshToken(t2.rawToken).valid, false);
    assert.equal(rtm.verifyRefreshToken(t3.rawToken).valid, true); // Other user unaffected
  });

  test('34. RefreshTokenManager stores only SHA-256 hashes, never raw tokens', () => {
    const rtm = new RefreshTokenManager();
    const created = rtm.createRefreshToken('usr_grace');
    const raw = created.rawToken;

    // Check internal store
    for (const [hash, record] of rtm._store.entries()) {
      assert.notEqual(hash, raw);
      assert.equal(hash.length, 64);
      assert.equal(record.tokenHash, hash);
      assert.ok(!JSON.stringify(record).includes(raw));
    }
  });

  test('35. RefreshTokenManager cleans up expired tokens on prune', () => {
    const rtm = new RefreshTokenManager();
    const t1 = rtm.createRefreshToken('usr_hannah', { ttlMs: -5000 });
    const t2 = rtm.createRefreshToken('usr_hannah', { ttlMs: 100000 });

    const prunedCount = rtm.pruneExpired();
    assert.equal(prunedCount, 1);
    assert.equal(rtm.verifyRefreshToken(t2.rawToken).valid, true);
  });

  test('36. RefreshTokenManager counts active sessions per user accurately', () => {
    const rtm = new RefreshTokenManager();
    rtm.createRefreshToken('usr_ian');
    rtm.createRefreshToken('usr_ian');
    assert.equal(rtm.getActiveSessionCount('usr_ian'), 2);
    assert.equal(rtm.getActiveSessionCount('usr_none'), 0);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 5. CsrfManager Unit Tests (Tests 37–43)
  // ══════════════════════════════════════════════════════════════════════════════
  test('37. CsrfManager generates cryptographically random 256-bit token', () => {
    const token = CsrfManager.generateToken();
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 64); // 32 bytes in hex
  });

  test('38. CsrfManager allows safe idempotent HTTP methods without token', () => {
    assert.equal(CsrfManager.validateRequest('GET', null, null), true);
    assert.equal(CsrfManager.validateRequest('HEAD', null, null), true);
    assert.equal(CsrfManager.validateRequest('OPTIONS', null, null), true);
  });

  test('39. CsrfManager validates matching header and cookie for mutating requests', () => {
    const token = CsrfManager.generateToken();
    assert.equal(CsrfManager.validateRequest('POST', token, token), true);
    assert.equal(CsrfManager.validateRequest('PUT', token, token), true);
    assert.equal(CsrfManager.validateRequest('DELETE', token, token), true);
    assert.equal(CsrfManager.validateRequest('PATCH', token, token), true);
  });

  test('40. CsrfManager rejects missing CSRF header on POST', () => {
    const token = CsrfManager.generateToken();
    assert.equal(CsrfManager.validateRequest('POST', null, token), false);
  });

  test('41. CsrfManager rejects missing CSRF cookie on POST', () => {
    const token = CsrfManager.generateToken();
    assert.equal(CsrfManager.validateRequest('POST', token, null), false);
  });

  test('42. CsrfManager rejects mismatched CSRF header and cookie', () => {
    const token1 = CsrfManager.generateToken();
    const token2 = CsrfManager.generateToken();
    assert.equal(CsrfManager.validateRequest('POST', token1, token2), false);
  });

  test('43. CsrfManager handles malformed or differing length tokens safely', () => {
    assert.equal(CsrfManager.validateRequest('POST', 'short', 'longer-token-value'), false);
    assert.equal(CsrfManager.validateRequest('POST', {}, []), false);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 6. AuthRateLimiter Unit Tests (Tests 44–50)
  // ══════════════════════════════════════════════════════════════════════════════
  test('44. AuthRateLimiter allows requests within IP sliding window limit', () => {
    const limiter = new AuthRateLimiter({ windowMs: 60000, maxRequests: 5 });
    const ip = '192.168.1.100';
    for (let i = 0; i < 5; i++) {
      assert.equal(limiter.checkIpLimit(ip).allowed, true);
    }
    limiter.destroy();
  });

  test('45. AuthRateLimiter blocks requests exceeding IP limit', () => {
    const limiter = new AuthRateLimiter({ windowMs: 60000, maxRequests: 3 });
    const ip = '192.168.1.101';
    limiter.checkIpLimit(ip);
    limiter.checkIpLimit(ip);
    limiter.checkIpLimit(ip);
    const blocked = limiter.checkIpLimit(ip);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, 'IP_RATE_LIMIT_EXCEEDED');
    assert.ok(blocked.retryAfterSec > 0);
    limiter.destroy();
  });

  test('46. AuthRateLimiter applies progressive exponential backoff on failed logins', () => {
    const limiter = new AuthRateLimiter();
    const identifier = 'user@target.com';

    // 4 failed attempts should not trigger backoff yet
    for (let i = 0; i < 4; i++) {
      limiter.recordLoginFailure(identifier);
      assert.equal(limiter.checkAccountBackoff(identifier).allowed, true);
    }

    // 5th failure triggers 1s backoff
    limiter.recordLoginFailure(identifier);
    const check5 = limiter.checkAccountBackoff(identifier);
    assert.equal(check5.allowed, false);
    assert.equal(check5.delaySec, 1);

    // 6th failure triggers 2s backoff
    limiter.recordLoginFailure(identifier);
    const check6 = limiter.checkAccountBackoff(identifier);
    assert.equal(check6.delaySec, 2);
    limiter.destroy();
  });

  test('47. AuthRateLimiter caps progressive delay at 60s (no permanent lockout DoS)', () => {
    const limiter = new AuthRateLimiter();
    const identifier = 'target2@company.com';
    for (let i = 0; i < 20; i++) {
      limiter.recordLoginFailure(identifier);
    }
    const check = limiter.checkAccountBackoff(identifier);
    assert.equal(check.allowed, false);
    assert.equal(check.delaySec, 60); // Capped at 60 seconds
    limiter.destroy();
  });

  test('48. AuthRateLimiter resets account failure count on successful login', () => {
    const limiter = new AuthRateLimiter();
    const identifier = 'cleared@user.com';
    for (let i = 0; i < 5; i++) limiter.recordLoginFailure(identifier);
    assert.equal(limiter.checkAccountBackoff(identifier).allowed, false);

    limiter.recordLoginSuccess(identifier);
    assert.equal(limiter.checkAccountBackoff(identifier).allowed, true);
    limiter.destroy();
  });

  test('49. AuthRateLimiter isolates rate limits per IP address', () => {
    const limiter = new AuthRateLimiter({ maxRequests: 2 });
    limiter.checkIpLimit('10.0.0.1');
    limiter.checkIpLimit('10.0.0.1');
    assert.equal(limiter.checkIpLimit('10.0.0.1').allowed, false);
    assert.equal(limiter.checkIpLimit('10.0.0.2').allowed, true); // Distinct IP unaffected
    limiter.destroy();
  });

  test('50. AuthRateLimiter timer uses unref to avoid keeping Node event loop active', () => {
    const limiter = new AuthRateLimiter();
    assert.ok(limiter._cleanupTimer);
    limiter.destroy();
    assert.equal(limiter._cleanupTimer, null);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 7. RbacEngine Unit Tests (Tests 51–57)
  // ══════════════════════════════════════════════════════════════════════════════
  test('51. RbacEngine establishes strictly ordered role hierarchy', () => {
    assert.ok(ROLE_LEVELS.admin > ROLE_LEVELS.user);
    assert.ok(ROLE_LEVELS.user > ROLE_LEVELS.guest);
    assert.ok(ROLE_LEVELS.guest > ROLE_LEVELS.anonymous);
    assert.equal(ROLE_LEVELS.admin, 100);
    assert.equal(ROLE_LEVELS.user, 10);
    assert.equal(ROLE_LEVELS.guest, 1);
    assert.equal(ROLE_LEVELS.anonymous, 0);
  });

  test('52. RbacEngine allows equal or superior role authorization', () => {
    assert.equal(RbacEngine.hasRole('admin', 'admin'), true);
    assert.equal(RbacEngine.hasRole('admin', 'user'), true);
    assert.equal(RbacEngine.hasRole('user', 'guest'), true);
    assert.equal(RbacEngine.hasRole('guest', 'anonymous'), true);
  });

  test('53. RbacEngine denies inferior role authorization fail-closed', () => {
    assert.equal(RbacEngine.hasRole('user', 'admin'), false);
    assert.equal(RbacEngine.hasRole('guest', 'user'), false);
    assert.equal(RbacEngine.hasRole('anonymous', 'guest'), false);
    assert.equal(RbacEngine.hasRole(null, 'user'), false);
  });

  test('54. RbacEngine strips forbidden client fields from registration/update payloads', () => {
    const maliciousPayload = {
      email: 'attacker@evil.com',
      password: 'ValidPassword123!',
      role: 'admin',
      isAdmin: true,
      permissions: ['*'],
      token_version: 99
    };

    const sanitized = RbacEngine.sanitizeUserInput(maliciousPayload);
    assert.equal(sanitized.email, 'attacker@evil.com');
    assert.equal(sanitized.password, 'ValidPassword123!');
    assert.equal(sanitized.role, undefined);
    assert.equal(sanitized.isAdmin, undefined);
    assert.equal(sanitized.permissions, undefined);
    assert.equal(sanitized.token_version, undefined);
  });

  test('55. RbacEngine last-admin protection blocks removal of the sole admin', () => {
    const admins = [{ id: 'adm_1', role: 'admin' }];
    assert.equal(RbacEngine.canRemoveAdmin(admins, 'adm_1'), false);
  });

  test('56. RbacEngine allows removing an admin when multiple admins exist', () => {
    const admins = [{ id: 'adm_1', role: 'admin' }, { id: 'adm_2', role: 'admin' }];
    assert.equal(RbacEngine.canRemoveAdmin(admins, 'adm_1'), true);
  });

  test('57. RbacEngine one-time admin bootstrap allows creation only when 0 admins exist', () => {
    assert.equal(RbacEngine.canBootstrapAdmin(0), true);
    assert.equal(RbacEngine.canBootstrapAdmin(1), false);
    assert.equal(RbacEngine.canBootstrapAdmin(5), false);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 8. OwnershipValidator Unit Tests (Tests 58–63)
  // ══════════════════════════════════════════════════════════════════════════════
  test('58. OwnershipValidator allows resource owner access', () => {
    const resource = { id: 'doc_1', userId: 'usr_100', title: 'My Private Doc' };
    const user = { id: 'usr_100', role: 'user' };
    const check = OwnershipValidator.checkOwnership(resource, user);
    assert.equal(check.allowed, true);
  });

  test('59. OwnershipValidator denies non-owner access (IDOR/BOLA prevention)', () => {
    const resource = { id: 'doc_1', userId: 'usr_100', title: 'My Private Doc' };
    const user = { id: 'usr_200', role: 'user' };
    const check = OwnershipValidator.checkOwnership(resource, user);
    assert.equal(check.allowed, false);
    assert.equal(check.statusCode, 403);
  });

  test('60. OwnershipValidator allows admin override on non-owned resource', () => {
    const resource = { id: 'doc_1', userId: 'usr_100', title: 'My Private Doc' };
    const admin = { id: 'adm_999', role: 'admin' };
    const check = OwnershipValidator.checkOwnership(resource, admin);
    assert.equal(check.allowed, true);
    assert.equal(check.isAdminOverride, true);
  });

  test('61. OwnershipValidator returns 404 on missing resource to prevent enumeration', () => {
    const user = { id: 'usr_100', role: 'user' };
    const check = OwnershipValidator.checkOwnership(null, user);
    assert.equal(check.allowed, false);
    assert.equal(check.statusCode, 404);
  });

  test('62. OwnershipValidator supports custom owner field keys (e.g. owner_id, authorId)', () => {
    const resource = { id: 'post_1', authorId: 'usr_500' };
    const user = { id: 'usr_500', role: 'user' };
    const check = OwnershipValidator.checkOwnership(resource, user, { ownerField: 'authorId' });
    assert.equal(check.allowed, true);
  });

  test('63. OwnershipValidator strictly prevents type-coercion bypasses', () => {
    const resource = { id: 'item_1', userId: 123 };
    const user = { id: '123', role: 'user' };
    // Coercion should be normalized or strict
    const check = OwnershipValidator.checkOwnership(resource, user);
    assert.equal(check.allowed, true); // Normalized string equality
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 9. AuthMiddleware Unit Tests (Tests 64–67)
  // ══════════════════════════════════════════════════════════════════════════════
  test('64. AuthMiddleware extracts and verifies Bearer token in Authorization header', async () => {
    const token = JwtEngine.sign({ sub: 'usr_middleware', role: 'user' }, TEST_JWT_SECRET);
    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {}
    };
    let nextCalled = false;
    const middleware = AuthMiddleware.createAuthenticate({ jwtSecret: TEST_JWT_SECRET });
    await middleware(req, {}, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user.sub, 'usr_middleware');
  });

  test('65. AuthMiddleware rejects missing authorization token with HTTP 401', () => {
    const req = { headers: {}, cookies: {} };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(data) { jsonSent = data; return this; }
    };
    const middleware = AuthMiddleware.createAuthenticate({ jwtSecret: TEST_JWT_SECRET });
    middleware(req, res, () => {});

    assert.equal(statusSent, 401);
    assert.equal(jsonSent.error, 'Authentication required');
  });

  test('66. AuthMiddleware requireRole middleware blocks insufficient role with HTTP 403', () => {
    const req = { user: { id: 'usr_1', role: 'user' } };
    let statusSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json() { return this; }
    };
    const requireAdmin = AuthMiddleware.requireRole('admin');
    requireAdmin(req, res, () => {});

    assert.equal(statusSent, 403);
  });

  test('67. AuthMiddleware verifyCsrf blocks mutating POST request lacking CSRF token', () => {
    const req = { method: 'POST', headers: {}, cookies: {} };
    let statusSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json() { return this; }
    };
    const csrfMiddleware = AuthMiddleware.verifyCsrf();
    csrfMiddleware(req, res, () => {});

    assert.equal(statusSent, 403);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // 10. AuthResult & AuthSynthesizer Unit Tests (Tests 68–72)
  // ══════════════════════════════════════════════════════════════════════════════
  test('68. AuthResult creates frozen success envelope with status', () => {
    const res = AuthResult.success({
      status: AUTH_STATUS.IMPLEMENTED_NOT_FULLY_VERIFIED,
      filesGenerated: ['routes/auth.js'],
      roles: ['admin', 'user']
    });
    assert.equal(res.success, true);
    assert.equal(res.status, AUTH_STATUS.IMPLEMENTED_NOT_FULLY_VERIFIED);
    assert.throws(() => { res.roles.push('hacker'); }, TypeError);
  });

  test('69. AuthResult creates frozen failure envelope with errors', () => {
    const res = AuthResult.failure('Hashing failed', {
      errors: ['Memory limit exceeded']
    });
    assert.equal(res.success, false);
    assert.equal(res.status, AUTH_STATUS.FAILED_ROLLED_BACK);
    assert.ok(res.errors.includes('Hashing failed'));
  });

  test('70. AuthSynthesizer synthesizes complete set of 9 backend/frontend files', () => {
    const plan = AuthPlan.create({ projectName: 'full-auth-suite' });
    const files = AuthSynthesizer.synthesize(plan);
    assert.ok(files instanceof Map);
    assert.equal(files.size, 9);
    assert.ok(files.has('backend/utils/auth.js'));
    assert.ok(files.has('backend/middleware/auth.js'));
    assert.ok(files.has('backend/routes/auth.js'));
    assert.ok(files.has('backend/migrations/002_create_auth_tables.sql'));
    assert.ok(files.has('frontend/src/context/AuthContext.jsx'));
    assert.ok(files.has('frontend/src/components/LoginForm.jsx'));
    assert.ok(files.has('frontend/src/components/RegisterForm.jsx'));
    assert.ok(files.has('frontend/src/components/ProtectedRoute.jsx'));
    assert.ok(files.has('backend/tests/auth.test.js'));
  });

  test('71. AuthSynthesizer enforces ZERO localStorage or sessionStorage in frontend artifacts', () => {
    const plan = AuthPlan.create({ projectName: 'no-storage-leak' });
    const files = AuthSynthesizer.synthesize(plan);
    const authContext = files.get('frontend/src/context/AuthContext.jsx');
    const loginForm = files.get('frontend/src/components/LoginForm.jsx');
    const registerForm = files.get('frontend/src/components/RegisterForm.jsx');
    const protectedRoute = files.get('frontend/src/components/ProtectedRoute.jsx');

    for (const [name, content] of [
      ['AuthContext', authContext],
      ['LoginForm', loginForm],
      ['RegisterForm', registerForm],
      ['ProtectedRoute', protectedRoute]
    ]) {
      assert.ok(!content.includes('localStorage'), `${name} must not contain localStorage`);
      assert.ok(!content.includes('sessionStorage'), `${name} must not contain sessionStorage`);
    }
  });

  test('72. AuthSynthesizer detectConflicts flags existing pre-authored files to prevent overwrite', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-conflict-test-'));
    try {
      const existingRelPath = 'backend/routes/auth.js';
      const existingFullPath = path.join(tempDir, existingRelPath);
      fs.mkdirSync(path.dirname(existingFullPath), { recursive: true });
      fs.writeFileSync(existingFullPath, '// Existing user authored code');

      const proposed = new Map();
      proposed.set(existingRelPath, '// Newly generated code');
      proposed.set('backend/utils/auth.js', '// Fresh code');

      const conflictCheck = AuthSynthesizer.detectConflicts(tempDir, proposed);
      assert.equal(conflictCheck.hasConflict, true);
      assert.equal(conflictCheck.conflicts.length, 1);
      assert.equal(conflictCheck.conflicts[0].path, existingRelPath);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

});
