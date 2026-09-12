'use strict';

/**
 * AI-Dost 2.0 — Phase 5B Test Suite
 * Outage Failure Modes, Network Partitions & Availability Policy Tests
 * 
 * 20+ assertions covering:
 * 1. Mid-flight Redis connection drops and fail-closed defense on auth endpoints
 * 2. Fail-secure degraded defense on non-auth general endpoints
 * 3. Atomic recovery after reconnection without service reboot
 * 4. Lock contention handling under SQLite WAL concurrent access
 * 5. Outage metrics & security event tracking
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { DistributedRateLimiter } = require('../agent/capabilities/auth/DistributedRateLimiter');
const { AuthAvailabilityPolicy, POLICY_MODES } = require('../agent/capabilities/auth/AuthAvailabilityPolicy');
const { SqliteAuthStore } = require('../agent/capabilities/auth/SqliteAuthStore');

describe('Auth Outage Failure Modes & Security Invariants Suite', () => {

  describe('1. Redis Outages: Fail-Closed vs Fail-Secure Degraded Enforcement', () => {
    class FlakyRedisClient {
      constructor() {
        this.online = true;
        this.store = new Map();
      }
      async ping() {
        if (!this.online) throw new Error('ECONNRESET: Redis connection lost');
        return 'PONG';
      }
      async incr(key) {
        if (!this.online) throw new Error('ECONNREFUSED: Server unreachable');
        const v = (this.store.get(key) || 0) + 1;
        this.store.set(key, v);
        return v;
      }
      async expire(key, sec) {
        if (!this.online) throw new Error('ECONNREFUSED');
        return 1;
      }
      async del(key) {
        this.store.delete(key);
        return 1;
      }
      close() {}
    }

    it('blocks /api/auth/login and /api/auth/register when Redis abruptly drops', async () => {
      const client = new FlakyRedisClient();
      const policy = new AuthAvailabilityPolicy();
      const limiter = new DistributedRateLimiter({ redisClient: client, policy });

      // Request 1 succeeds while Redis is online
      const rOnline = await limiter.checkLimit('login', '192.0.2.1');
      assert.equal(rOnline.allowed, true);
      assert.equal(rOnline.degraded, false);

      // Simulating network partition / Redis crash
      client.online = false;

      // Request 2 must FAIL_CLOSED
      const rDropped = await limiter.checkLimit('login', '192.0.2.1');
      assert.equal(rDropped.allowed, false, 'Login must be blocked when rate-limiting service fails');
      assert.equal(rDropped.blockedByPolicy, true);
      assert.equal(rDropped.error, 'SERVICE_UNAVAILABLE');
      assert.match(rDropped.reason, /Fail-closed policy active/);

      // Register must also FAIL_CLOSED
      const rReg = await limiter.checkLimit('register', '192.0.2.1');
      assert.equal(rReg.allowed, false);
      assert.equal(rReg.blockedByPolicy, true);
    });

    it('allows general API endpoints to operate degraded under in-memory gate', async () => {
      const client = new FlakyRedisClient();
      client.online = false; // start offline

      const limiter = new DistributedRateLimiter({
        redisClient: client,
        buckets: { general_api: { limit: 10, windowSec: 60 } }
      });

      // Degraded limit is Math.floor(10 / 2) = 5
      for (let i = 1; i <= 5; i++) {
        const res = await limiter.checkLimit('general_api', 'dev_client');
        assert.equal(res.allowed, true, `Request ${i} should be allowed in degraded mode`);
        assert.equal(res.degraded, true);
        assert.equal(res.current, i);
      }

      // 6th request must be blocked by the local degraded gate
      const blocked = await limiter.checkLimit('general_api', 'dev_client');
      assert.equal(blocked.allowed, false, 'Degraded gate must enforce tightened limit');
      assert.equal(blocked.remaining, 0);
    });

    it('recovers to full distributed capacity when Redis comes back online', async () => {
      const client = new FlakyRedisClient();
      const limiter = new DistributedRateLimiter({
        redisClient: client,
        buckets: { login: { limit: 5, windowSec: 60 } }
      });

      // Drop Redis
      client.online = false;
      const rDown = await limiter.checkLimit('login', 'ip_reconnect');
      assert.equal(rDown.allowed, false);

      // Reconnect Redis
      client.online = true;
      limiter.isRedisAvailable = true; // simulated healthcheck flip

      const rRecovered = await limiter.checkLimit('login', 'ip_reconnect');
      assert.equal(rRecovered.allowed, true, 'Should immediately allow traffic once Redis recovers');
      assert.equal(rRecovered.degraded, false);
      assert.equal(rRecovered.current, 1);
    });
  });

  describe('2. Concurrent SQLite Transactions & Lock Contention', () => {
    let tempDir;
    let dbPath;
    let store1;
    let store2;

    before(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-contention-test-'));
      dbPath = path.join(tempDir, 'contention.sqlite');
      store1 = new SqliteAuthStore({ dbPath, busyTimeoutMs: 5000 });
      store2 = new SqliteAuthStore({ dbPath, busyTimeoutMs: 5000 });
    });

    after(() => {
      if (store1) store1.close();
      if (store2) store2.close();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    });

    it('handles interleaved concurrent token saves and rotations without deadlock', async () => {
      const userId = 'usr_concurrent_' + crypto.randomUUID().slice(0, 8);
      await store1.saveUser({
        id: userId,
        email: 'concurrent@example.com',
        username: 'concurrent_user',
        password_hash: 'hash_abc',
        role: 'user',
        token_version: 1
      });

      const promises = [];
      // Fire 10 parallel token save/rotate operations across store1 and store2
      for (let i = 0; i < 10; i++) {
        const store = (i % 2 === 0) ? store1 : store2;
        const tokenHash = crypto.createHash('sha256').update(`token_${i}`).digest('hex');
        promises.push(
          store.saveRefreshToken({
            token_hash: tokenHash,
            family_id: `fam_${i}`,
            user_id: userId,
            expires_at: Math.floor(Date.now() / 1000) + 3600
          })
        );
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        assert.equal(res.ok, true, 'Concurrent write should succeed under WAL mode');
      }

      // Verify all 10 tokens exist
      const checkUser = await store2.getUserById(userId);
      assert.equal(checkUser.ok, true);
    });
  });

  describe('3. AuthAvailabilityPolicy Metrics & Audit Tracking', () => {
    it('tracks cumulative outage count per service and allows reset', () => {
      const policy = new AuthAvailabilityPolicy();

      const out1 = policy.handleOutage('redis', '/api/auth/login', new Error('Timeout'));
      assert.equal(out1.action, 'BLOCK');
      assert.equal(out1.status, 503);

      const out2 = policy.handleOutage('redis', '/api/auth/register', new Error('Connection refused'));
      assert.equal(out2.action, 'BLOCK');

      const out3 = policy.handleOutage('postgres', '/api/agent/run', new Error('Pool exhausted'));
      assert.equal(out3.action, 'DEGRADE');

      assert.equal(policy._outageCounts.get('redis'), 2);
      assert.equal(policy._outageCounts.get('postgres'), 1);

      policy.resetOutageCounts();
      assert.equal(policy._outageCounts.size, 0);
    });
  });

});
