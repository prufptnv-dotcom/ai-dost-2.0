'use strict';

/**
 * AI-Dost 2.0 — Phase 5B Test Suite
 * Multi-Instance Distributed Authentication & Session E2E Tests
 * 
 * 25+ assertions verifying dual-node architecture:
 * - Instance_A and Instance_B share identical persistent SQLite store and Redis
 * - User created on A is immediately accessible and authenticatable on B
 * - Token issued on A can be rotated on B
 * - Replay attack on B revokes the family and blocks subsequent refresh on A
 * - Global session revocation (token_version bump) on A invalidates sessions on B
 * - Distributed rate limiting shared across instances A and B
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { SqliteAuthStore } = require('../agent/capabilities/auth/SqliteAuthStore');
const { DistributedRateLimiter } = require('../agent/capabilities/auth/DistributedRateLimiter');

describe('Multi-Instance Distributed Authentication & Session E2E Suite', () => {
  let tempDir;
  let sharedDbPath;
  let instanceA_store;
  let instanceB_store;
  let instanceA_limiter;
  let instanceB_limiter;

  // Shared in-memory or Redis mock client for dual instances to guarantee deterministic rate limit sync
  class SharedClusterRedisMock {
    constructor() {
      this.store = new Map();
      this.ttls = new Map();
    }
    async ping() { return 'PONG'; }
    async incr(key) {
      const val = (this.store.get(key) || 0) + 1;
      this.store.set(key, val);
      return val;
    }
    async expire(key, sec) {
      this.ttls.set(key, sec);
      return 1;
    }
    async del(key) {
      this.store.delete(key);
      this.ttls.delete(key);
      return 1;
    }
    close() {}
  }

  const sharedRedis = new SharedClusterRedisMock();

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-multi-instance-'));
    sharedDbPath = path.join(tempDir, 'shared_auth.sqlite');

    // Instance A
    instanceA_store = new SqliteAuthStore({ dbPath: sharedDbPath });
    instanceA_limiter = new DistributedRateLimiter({ redisClient: sharedRedis });

    // Instance B (separate process simulation pointing to identical shared SQLite db and Redis)
    instanceB_store = new SqliteAuthStore({ dbPath: sharedDbPath });
    instanceB_limiter = new DistributedRateLimiter({ redisClient: sharedRedis });
  });

  after(() => {
    if (instanceA_store) instanceA_store.close();
    if (instanceB_store) instanceB_store.close();
    if (instanceA_limiter) instanceA_limiter.close();
    if (instanceB_limiter) instanceB_limiter.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  describe('1. Cross-Instance User Identity & Credential Synchronization', () => {
    const testUser = {
      id: 'usr_dual_' + crypto.randomUUID().slice(0, 8),
      email: 'multi_node@example.com',
      username: 'multinode_user',
      password_hash: 'scrypt:32768:8:1:salt:hashabc123',
      role: 'DEVELOPER',
      token_version: 1
    };

    it('registers user on Instance_A and retrieves immediately on Instance_B', async () => {
      const saveRes = await instanceA_store.saveUser(testUser);
      assert.equal(saveRes.ok, true, 'User should be saved successfully on Node A');

      // Immediate retrieval from Node B
      const fetchById = await instanceB_store.getUserById(testUser.id);
      assert.equal(fetchById.ok, true, 'Node B should find user by ID');
      assert.equal(fetchById.record.email, testUser.email);
      assert.equal(fetchById.record.username, testUser.username);
      assert.equal(fetchById.record.role, 'DEVELOPER');

      const fetchByEmail = await instanceB_store.getUserByEmail(testUser.email);
      assert.equal(fetchByEmail.ok, true, 'Node B should find user by email');
      assert.equal(fetchByEmail.record.id, testUser.id);
    });

    it('prevents duplicate registration on Instance_B when user already exists from Instance_A', async () => {
      const dupRes = await instanceB_store.saveUser({
        id: 'usr_dup_' + crypto.randomUUID().slice(0, 8),
        email: testUser.email, // duplicate email
        username: 'different_name',
        password_hash: 'hash_xyz'
      });

      assert.equal(dupRes.ok, false);
      assert.equal(dupRes.code, 'DUPLICATE_KEY');
    });

    it('synchronizes credential updates made on Instance_B to Instance_A', async () => {
      const updatedUser = {
        ...testUser,
        password_hash: 'scrypt:32768:8:1:newsalt:newhash456'
      };

      const updateRes = await instanceB_store.saveUser(updatedUser);
      assert.equal(updateRes.ok, true);

      // Verify on Node A
      const checkOnA = await instanceA_store.getUserById(testUser.id);
      assert.equal(checkOnA.ok, true);
      assert.equal(checkOnA.record.password_hash, 'scrypt:32768:8:1:newsalt:newhash456');
    });
  });

  describe('2. Cross-Instance Token Rotation & Replay Attack Defense', () => {
    const userId = 'usr_token_sync_' + crypto.randomUUID().slice(0, 8);
    const familyId = 'fam_' + crypto.randomUUID();
    const tokenHash1 = crypto.createHash('sha256').update('refresh_token_v1').digest('hex');
    const tokenHash2 = crypto.createHash('sha256').update('refresh_token_v2').digest('hex');
    const tokenHash3 = crypto.createHash('sha256').update('refresh_token_v3').digest('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;

    before(async () => {
      // Create user
      await instanceA_store.saveUser({
        id: userId,
        email: 'token_sync@example.com',
        username: 'token_sync_user',
        password_hash: 'hash_token',
        role: 'USER',
        token_version: 1
      });
    });

    it('issues initial refresh token on Instance_A and verifies visibility on Instance_B', async () => {
      const saveTokenRes = await instanceA_store.saveRefreshToken({
        token_hash: tokenHash1,
        family_id: familyId,
        user_id: userId,
        expires_at: expiresAt
      });
      assert.equal(saveTokenRes.ok, true, 'Token 1 must save on Node A');

      // Read from Node B
      const checkOnB = await instanceB_store.getRefreshToken(tokenHash1);
      assert.equal(checkOnB.ok, true, 'Node B must find Token 1');
      assert.equal(checkOnB.record.family_id, familyId);
      assert.equal(checkOnB.record.is_revoked, 0);
    });

    it('rotates token on Instance_B: revokes Token 1, issues Token 2, visible on Instance_A', async () => {
      const rotateRes = await instanceB_store.rotateRefreshToken(tokenHash1, {
        token_hash: tokenHash2,
        family_id: familyId,
        user_id: userId,
        expires_at: expiresAt
      });

      assert.equal(rotateRes.ok, true, 'Rotation on Node B must succeed');
      assert.equal(rotateRes.familyRevoked, false);
      assert.equal(rotateRes.replayed, false);

      // Verify on Node A that Token 1 is revoked and replaced_by_token_id links to Token 2
      const oldOnA = await instanceA_store.getRefreshToken(tokenHash1);
      assert.equal(oldOnA.ok, true);
      assert.equal(oldOnA.record.is_revoked, 1, 'Token 1 must be marked revoked on Node A');
      assert.equal(oldOnA.record.replaced_by_token_id, rotateRes.newRecord.id, 'Node A must see replacement link to new token ID');

      // Verify on Node A that Token 2 is active
      const newOnA = await instanceA_store.getRefreshToken(tokenHash2);
      assert.equal(newOnA.ok, true);
      assert.equal(newOnA.record.is_revoked, 0);
    });

    it('REPLAY ATTACK ACROSS NODES: Replaying Token 1 on Node_B triggers family revocation visible on Node_A', async () => {
      // Attacker attempts to replay Token 1 on Node B
      const replayAttempt = await instanceB_store.rotateRefreshToken(tokenHash1, {
        token_hash: tokenHash3,
        family_id: familyId,
        user_id: userId,
        expires_at: expiresAt
      });

      assert.equal(replayAttempt.ok, false, 'Replay rotation must fail');
      assert.equal(replayAttempt.code, 'TOKEN_REPLAY_DETECTED', 'Must detect replay attack');
      assert.equal(replayAttempt.replayed, true);
      assert.equal(replayAttempt.familyRevoked, true, 'Family must be revoked');

      // Verify on Node A that Token 2 (legitimate active token) has also been revoked by family
      const legitTokenOnA = await instanceA_store.getRefreshToken(tokenHash2);
      assert.equal(legitTokenOnA.ok, true);
      assert.equal(legitTokenOnA.record.is_revoked, 1, 'Node A must observe Token 2 is now revoked due to family replay');

      // Verify subsequent rotation attempt on Node A with Token 2 also fails
      const rotateLegitOnA = await instanceA_store.rotateRefreshToken(tokenHash2, {
        token_hash: crypto.createHash('sha256').update('refresh_v4').digest('hex'),
        family_id: familyId,
        user_id: userId,
        expires_at: expiresAt
      });
      assert.equal(rotateLegitOnA.ok, false);
      assert.equal(rotateLegitOnA.code, 'TOKEN_REPLAY_DETECTED');
    });
  });

  describe('3. Cross-Instance Global Logout & Session Invalidation', () => {
    const userId = 'usr_logout_' + crypto.randomUUID().slice(0, 8);

    before(async () => {
      await instanceA_store.saveUser({
        id: userId,
        email: 'logout_all@example.com',
        username: 'logout_user',
        password_hash: 'hash_logout',
        role: 'USER',
        token_version: 1
      });

      // Issue 2 tokens in different families
      await instanceA_store.saveRefreshToken({
        token_hash: crypto.createHash('sha256').update('token_dev1').digest('hex'),
        family_id: 'fam_dev1',
        user_id: userId,
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });
      await instanceB_store.saveRefreshToken({
        token_hash: crypto.createHash('sha256').update('token_dev2').digest('hex'),
        family_id: 'fam_dev2',
        user_id: userId,
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });
    });

    it('increments token_version on Node_A and immediately invalidates on Node_B', async () => {
      // User clicks "Logout from all devices" on Node A
      const incRes = await instanceA_store.incrementTokenVersion(userId);
      assert.equal(incRes.ok, true);
      assert.equal(incRes.tokenVersion, 2, 'Token version should bump to 2');

      // Node B reads user
      const userOnB = await instanceB_store.getUserById(userId);
      assert.equal(userOnB.ok, true);
      assert.equal(userOnB.record.token_version, 2, 'Node B must immediately see bumped token_version');

      // Invalidate all tokens for user on Node A
      const count = await instanceA_store.revokeAllForUser(userId);
      assert.equal(count, 2, 'Should revoke 2 tokens for user across instances');

      // Verify on Node B that dev1 and dev2 are revoked
      const dev1OnB = await instanceB_store.getRefreshToken(
        crypto.createHash('sha256').update('token_dev1').digest('hex')
      );
      assert.equal(dev1OnB.record.is_revoked, 1);

      const dev2OnB = await instanceB_store.getRefreshToken(
        crypto.createHash('sha256').update('token_dev2').digest('hex')
      );
      assert.equal(dev2OnB.record.is_revoked, 1);
    });
  });

  describe('4. Cross-Instance Distributed Rate Limiting Synchronization', () => {
    const testIp = '198.51.100.42';

    it('enforces shared quota across Instance_A and Instance_B', async () => {
      // Bucket login limit is 5
      // 1st and 2nd requests arrive on Node A
      const a1 = await instanceA_limiter.checkLimit('login', testIp);
      assert.equal(a1.allowed, true);
      assert.equal(a1.current, 1);

      const a2 = await instanceA_limiter.checkLimit('login', testIp);
      assert.equal(a2.allowed, true);
      assert.equal(a2.current, 2);

      // 3rd and 4th requests arrive on Node B
      const b1 = await instanceB_limiter.checkLimit('login', testIp);
      assert.equal(b1.allowed, true);
      assert.equal(b1.current, 3, 'Node B must see cluster counter at 3');

      const b2 = await instanceB_limiter.checkLimit('login', testIp);
      assert.equal(b2.allowed, true);
      assert.equal(b2.current, 4);

      // 5th request on Node A reaches limit
      const a3 = await instanceA_limiter.checkLimit('login', testIp);
      assert.equal(a3.allowed, true);
      assert.equal(a3.current, 5);
      assert.equal(a3.remaining, 0);

      // 6th request on Node B MUST be rejected based on shared Redis state
      const bBlocked = await instanceB_limiter.checkLimit('login', testIp);
      assert.equal(bBlocked.allowed, false, 'Node B must block when cluster limit is reached');
      assert.equal(bBlocked.remaining, 0);

      // 7th request on Node A MUST also be rejected
      const aBlocked = await instanceA_limiter.checkLimit('login', testIp);
      assert.equal(aBlocked.allowed, false, 'Node A must block as well');

      // Admin resets bucket on Node B
      await instanceB_limiter.reset('login', testIp);

      // Next request on Node A is allowed again
      const aFresh = await instanceA_limiter.checkLimit('login', testIp);
      assert.equal(aFresh.allowed, true, 'Node A must allow request after Node B reset');
      assert.equal(aFresh.current, 1);
    });
  });

});
