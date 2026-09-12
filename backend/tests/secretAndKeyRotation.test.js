'use strict';

/**
 * AI-Dost 2.0 — Phase 5B Test Suite
 * Secret Hygiene, Cryptographic Entropy & JWT Key Rotation Tests
 * 
 * 15+ assertions covering:
 * 1. SecretConfigValidator: Shannon entropy, dictionary blacklist, length constraints
 * 2. Fail-closed production environment validation
 * 3. Safe secret masking for logging
 * 4. JwtKeyManager: signing with kid, HS256-only enforcement
 * 5. Zero-downtime key rotation: overlapping grace period allows existing tokens to verify
 * 6. Revocation and expired key pruning
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const SecretConfigValidator = require('../agent/capabilities/auth/SecretConfigValidator');
const JwtKeyManager = require('../agent/capabilities/auth/JwtKeyManager');

describe('Secret Hygiene, Entropy & JWT Key Rotation Suite', () => {

  describe('1. SecretConfigValidator Entropy & Pattern Blacklist', () => {
    it('calculates Shannon entropy in bits for various string densities', () => {
      // Monotonous single character has 0 entropy
      const zeroEntropy = SecretConfigValidator.calculateEntropyBits('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      assert.equal(zeroEntropy, 0);

      // High entropy random hex string (64 chars hex has ~256 bits of entropy)
      const randomHex = crypto.randomBytes(32).toString('hex');
      const highEntropy = SecretConfigValidator.calculateEntropyBits(randomHex);
      assert.ok(highEntropy >= 200, `Expected entropy >= 200, got ${highEntropy}`);
    });

    it('rejects weak, dictionary, and predictable secret patterns', () => {
      assert.equal(SecretConfigValidator.isWeakSecret('password'), true);
      assert.equal(SecretConfigValidator.isWeakSecret('jwt_secret'), true);
      assert.equal(SecretConfigValidator.isWeakSecret('12345678'), true);
      assert.equal(SecretConfigValidator.isWeakSecret('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), true);
      assert.equal(SecretConfigValidator.isWeakSecret('0123456789abcdef0123456789abcdef'), true);

      // Strong random secret is not weak
      const strong = crypto.randomBytes(32).toString('base64');
      assert.equal(SecretConfigValidator.isWeakSecret(strong), false);
    });

    it('validates secret length (>= 32 chars) and rejects short secrets', () => {
      const short = SecretConfigValidator.validateJwtSecret('short_secret');
      assert.equal(short.valid, false);
      assert.equal(short.code, 'SECRET_TOO_SHORT');

      const validStrong = SecretConfigValidator.validateJwtSecret(
        'vEry_StR0ng_s3cr3t_w1th_32_ch4rs_min_length!'
      );
      assert.equal(validStrong.valid, true);
      assert.ok(validStrong.digest.startsWith('sha256:'));
    });

    it('enforces fail-closed validation on production startup with weak secrets', () => {
      const weakProdEnv = {
        NODE_ENV: 'production',
        JWT_SECRET: 'password'
      };

      assert.throws(
        () => SecretConfigValidator.validateEnvironment(weakProdEnv),
        /PRODUCTION_SECURITY_CHECK_FAILED/,
        'Must throw in production when secrets are weak'
      );

      const strongProdEnv = {
        NODE_ENV: 'production',
        JWT_SECRET: crypto.randomBytes(32).toString('hex'),
        ALLOW_HTTP: 'false'
      };

      const validRes = SecretConfigValidator.validateEnvironment(strongProdEnv);
      assert.equal(validRes.valid, true);
      assert.equal(validRes.isProduction, true);
      assert.equal(validRes.errors.length, 0);
    });

    it('masks secrets safely without leaking content', () => {
      const maskedShort = SecretConfigValidator.maskSecret('12345');
      assert.equal(maskedShort, '********');

      const maskedLong = SecretConfigValidator.maskSecret('super_secret_master_key_9999');
      assert.equal(maskedLong, 'supe...9999 (28 chars)');
      assert.ok(!maskedLong.includes('secret'));
    });
  });

  describe('2. JwtKeyManager & Zero-Downtime Key Rotation', () => {
    const key1 = 'first_generation_jwt_secret_key_32_chars_ok!';
    const key2 = 'second_generation_jwt_secret_key_32_chars_ok!';

    it('signs tokens with active kid in header and verifies valid signature', () => {
      const km = new JwtKeyManager({ initialSecret: key1, initialKid: 'kid_v1' });

      const token = km.sign({ sub: 'user_123', role: 'DEVELOPER' });
      assert.ok(typeof token === 'string');

      // Verify token
      const verifyRes = km.verify(token);
      assert.equal(verifyRes.valid, true);
      assert.equal(verifyRes.payload.sub, 'user_123');
      assert.equal(verifyRes.payload.role, 'DEVELOPER');
      assert.equal(verifyRes.kid, 'kid_v1');
      assert.equal(verifyRes.keyStatus, 'active');
    });

    it('rejects tokens with forged signatures or altered payloads', () => {
      const km = new JwtKeyManager({ initialSecret: key1 });
      const token = km.sign({ sub: 'user_tamper', role: 'USER' });

      const parts = token.split('.');
      // Tamper with payload to elevate role to ADMIN
      const forgedPayload = Buffer.from(JSON.stringify({ sub: 'user_tamper', role: 'ADMIN' }))
        .toString('base64url');
      const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

      const res = km.verify(forgedToken);
      assert.equal(res.valid, false);
      assert.equal(res.code, 'SIGNATURE_MISMATCH');
    });

    it('rejects algorithm confusion attacks (e.g. none or RS256)', () => {
      const km = new JwtKeyManager({ initialSecret: key1 });

      // Build header with alg: "none"
      const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url');
      const noneToken = `${noneHeader}.${payload}.`;

      const res = km.verify(noneToken);
      assert.equal(res.valid, false);
      assert.equal(res.code, 'ALG_NOT_ALLOWED');
    });

    it('supports seamless zero-downtime key rotation with overlap grace period', () => {
      const km = new JwtKeyManager({ initialSecret: key1, initialKid: 'kid_v1' });

      // 1. Issue Token A under old key
      const tokenOld = km.sign({ sub: 'session_old' });
      assert.equal(km.verify(tokenOld).valid, true);

      // 2. Rotate to Key 2 with 3600s grace period
      const rotation = km.rotateKey(key2, { newKid: 'kid_v2', gracePeriodSec: 3600 });
      assert.equal(rotation.oldKid, 'kid_v1');
      assert.equal(rotation.newKid, 'kid_v2');

      // 3. New tokens are signed with Key 2
      const tokenNew = km.sign({ sub: 'session_new' });
      const verifyNew = km.verify(tokenNew);
      assert.equal(verifyNew.valid, true);
      assert.equal(verifyNew.kid, 'kid_v2');
      assert.equal(verifyNew.keyStatus, 'active');

      // 4. Old token still verifies successfully during grace period!
      const verifyOldDuringGrace = km.verify(tokenOld);
      assert.equal(verifyOldDuringGrace.valid, true, 'Old token must verify during grace period');
      assert.equal(verifyOldDuringGrace.kid, 'kid_v1');
      assert.equal(verifyOldDuringGrace.keyStatus, 'grace_period');
    });

    it('rejects tokens signed with revoked keys immediately', () => {
      const km = new JwtKeyManager({ initialSecret: key1, initialKid: 'kid_v1' });
      const token = km.sign({ sub: 'user_revoked' });

      // Revoke kid_v1
      km.revokeKey('kid_v1');

      const res = km.verify(token);
      assert.equal(res.valid, false);
      assert.equal(res.code, 'KEY_NOT_FOUND');
    });

    it('rejects expired tokens and reports TOKEN_EXPIRED', () => {
      const km = new JwtKeyManager({ initialSecret: key1 });
      // Create token that expired 10 seconds ago
      const expiredToken = km.sign({ sub: 'user_exp' }, { expiresInSec: -10 });

      const res = km.verify(expiredToken);
      assert.equal(res.valid, false);
      assert.equal(res.code, 'TOKEN_EXPIRED');
    });

    it('prunes expired keys from the keyring', () => {
      const km = new JwtKeyManager({ initialSecret: key1, initialKid: 'k_active' });
      // Add expired key
      km.keyring.set('k_old_expired', {
        kid: 'k_old_expired',
        secret: key2,
        status: 'grace_period',
        expiresAt: new Date(Date.now() - 5000).toISOString()
      });

      assert.equal(km.keyring.has('k_old_expired'), true);
      const purged = km.pruneExpiredKeys();
      assert.equal(purged, 1);
      assert.equal(km.keyring.has('k_old_expired'), false);
      assert.equal(km.keyring.has('k_active'), true);
    });
  });

});
