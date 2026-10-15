'use strict';

/**
 * AI-Dost 2.0 — Phase 5B Test Suite
 * DistributedRateLimiter & RESP Protocol & Outage Policy Tests
 * 
 * 25+ assertions covering:
 * 1. NativeRespClient RESP serialization, deserialization & parser frames
 * 2. Atomic counter increments, window expiry, and multi-tier buckets
 * 3. AuthAvailabilityPolicy FAIL_CLOSED vs FAIL_SECURE_DEGRADED behaviors
 * 4. In-memory degraded security gate fallback
 * 5. Live Redis integration over 127.0.0.1:6379 (when container running)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  DistributedRateLimiter,
  NativeRespClient,
  DEFAULT_BUCKETS
} = require('../agent/capabilities/auth/DistributedRateLimiter');

const {
  AuthAvailabilityPolicy,
  POLICY_MODES
} = require('../agent/capabilities/auth/AuthAvailabilityPolicy');

describe('DistributedRateLimiter & RESP Protocol Suite', () => {

  describe('1. NativeRespClient RESP Protocol Parser (In-Memory Mock Socket)', () => {
    it('serializes Redis commands into RESP specification format', () => {
      // Test formatCommand static method
      const cmd = NativeRespClient.formatCommand(['SET', 'mykey', 'myvalue']);
      const expected = '*3\r\n$3\r\nSET\r\n$5\r\nmykey\r\n$7\r\nmyvalue\r\n';
      assert.equal(cmd, expected, 'Command must be formatted as RESP array of bulk strings');

      const pingCmd = NativeRespClient.formatCommand(['PING']);
      assert.equal(pingCmd, '*1\r\n$4\r\nPING\r\n');
    });

    it('parses RESP simple string responses (+OK)', async () => {
      const client = new NativeRespClient();
      client.connected = true;
      client.socket = {
        write: (d, cb) => {
          if (cb) cb();
          setImmediate(() => {
            client._buffer += '+OK\r\n';
            client._processBuffer();
          });
        },
        destroyed: false
      };

      const res = await client.sendCommand(['SET', 'k', 'v']);
      assert.equal(res, 'OK', 'Parser should parse simple string +OK');
    });

    it('parses RESP integer responses correctly', async () => {
      const client = new NativeRespClient();
      client.connected = true;
      client.socket = {
        write: (d, cb) => {
          if (cb) cb();
          setImmediate(() => {
            client._buffer += ':42\r\n';
            client._processBuffer();
          });
        },
        destroyed: false
      };

      const result = await client.sendCommand(['INCR', 'counter']);
      assert.equal(result, 42, 'Parser should parse integer :42 as number 42');
    });

    it('parses RESP bulk string and null bulk string correctly', async () => {
      const client = new NativeRespClient();
      client.connected = true;
      let nextResponse = '';
      client.socket = {
        write: (d, cb) => {
          if (cb) cb();
          setImmediate(() => {
            client._buffer += nextResponse;
            client._processBuffer();
          });
        },
        destroyed: false
      };

      // Normal bulk string
      nextResponse = '$5\r\nhello\r\n';
      const r1 = await client.sendCommand(['GET', 'k1']);
      assert.equal(r1, 'hello');

      // Null bulk string ($-1\r\n)
      nextResponse = '$-1\r\n';
      const r2 = await client.sendCommand(['GET', 'nonexistent']);
      assert.equal(r2, null);
    });

    it('parses RESP error responses and rejects promise', async () => {
      const client = new NativeRespClient();
      client.connected = true;
      client.socket = {
        write: (d, cb) => {
          if (cb) cb();
          setImmediate(() => {
            client._buffer += '-ERR unknown command\r\n';
            client._processBuffer();
          });
        },
        destroyed: false
      };

      await assert.rejects(
        client.sendCommand(['UNKNOWN_CMD']),
        /ERR unknown command/,
        'Parser should reject on RESP error string'
      );
    });

    it('cleans up queue and rejects pending commands on close', async () => {
      const client = new NativeRespClient();
      client.connected = true;
      client.socket = {
        write: (d, cb) => {
          // don't resolve, simulate hanging socket
          if (cb) cb();
        },
        destroy: () => {},
        destroyed: false
      };

      const promise = client.sendCommand(['PING']);
      // Give sendCommand time to push to _queue
      await new Promise(r => setImmediate(r));
      client.close();

      await assert.rejects(
        promise,
        /Client closed/,
        'Closing client must reject pending command promises'
      );
      assert.equal(client.connected, false);
    });
  });

  describe('2. DistributedRateLimiter Functional & Multi-Bucket Operations (Mock Client)', () => {
    class MockRedisClient {
      constructor() {
        this.store = new Map();
        this.ttls = new Map();
        this.connected = true;
      }
      async ping() {
        if (!this.connected) throw new Error('ECONNREFUSED');
        return 'PONG';
      }
      async incr(key) {
        if (!this.connected) throw new Error('ECONNREFUSED');
        const cur = (this.store.get(key) || 0) + 1;
        this.store.set(key, cur);
        return cur;
      }
      async expire(key, seconds) {
        if (!this.connected) throw new Error('ECONNREFUSED');
        this.ttls.set(key, seconds);
        return 1;
      }
      async del(key) {
        this.store.delete(key);
        this.ttls.delete(key);
        return 1;
      }
      close() {}
    }

    it('allows requests within bucket limits and decrements remaining', async () => {
      const mock = new MockRedisClient();
      const limiter = new DistributedRateLimiter({ redisClient: mock });

      const res1 = await limiter.checkLimit('login', '192.168.1.10');
      assert.equal(res1.allowed, true);
      assert.equal(res1.current, 1);
      assert.equal(res1.remaining, 4); // 5 - 1
      assert.equal(res1.degraded, false);

      const res2 = await limiter.checkLimit('login', '192.168.1.10');
      assert.equal(res2.allowed, true);
      assert.equal(res2.current, 2);
      assert.equal(res2.remaining, 3);
    });

    it('blocks requests when bucket limit is exhausted', async () => {
      const mock = new MockRedisClient();
      const limiter = new DistributedRateLimiter({ redisClient: mock });

      // Exhaust login bucket (limit 5)
      for (let i = 0; i < 5; i++) {
        const res = await limiter.checkLimit('login', '10.0.0.1');
        assert.equal(res.allowed, true);
      }

      // 6th request must be blocked
      const blockedRes = await limiter.checkLimit('login', '10.0.0.1');
      assert.equal(blockedRes.allowed, false);
      assert.equal(blockedRes.remaining, 0);
      assert.equal(blockedRes.current, 6);
    });

    it('isolates different bucket tiers and identifiers independently', async () => {
      const mock = new MockRedisClient();
      const limiter = new DistributedRateLimiter({ redisClient: mock });

      // User 1 exhausts register limit (limit 3)
      await limiter.checkLimit('register', 'user_1');
      await limiter.checkLimit('register', 'user_1');
      await limiter.checkLimit('register', 'user_1');
      const regUser1 = await limiter.checkLimit('register', 'user_1');
      assert.equal(regUser1.allowed, false, 'User 1 register should be exhausted');

      // User 2 register must still be allowed
      const regUser2 = await limiter.checkLimit('register', 'user_2');
      assert.equal(regUser2.allowed, true, 'User 2 register should be independent');

      // User 1 login bucket must still be allowed (independent bucket)
      const loginUser1 = await limiter.checkLimit('login', 'user_1');
      assert.equal(loginUser1.allowed, true, 'Login bucket should be isolated from register');
    });

    it('supports bucket reset', async () => {
      const mock = new MockRedisClient();
      const limiter = new DistributedRateLimiter({ redisClient: mock });

      await limiter.checkLimit('csrf_failure', 'attacker_ip');
      await limiter.checkLimit('csrf_failure', 'attacker_ip');
      assert.equal(mock.store.get('ratelimit:csrf_failure:attacker_ip'), 2);

      await limiter.reset('csrf_failure', 'attacker_ip');
      assert.equal(mock.store.has('ratelimit:csrf_failure:attacker_ip'), false);

      const fresh = await limiter.checkLimit('csrf_failure', 'attacker_ip');
      assert.equal(fresh.current, 1);
    });
  });

  describe('3. AuthAvailabilityPolicy & Outage Failure Modes', () => {
    it('enforces FAIL_CLOSED for critical endpoints during Redis outage', async () => {
      const failingMock = {
        ping: async () => { throw new Error('Connection refused'); },
        incr: async () => { throw new Error('Connection refused'); },
        close: () => {}
      };

      const limiter = new DistributedRateLimiter({ redisClient: failingMock });

      // Critical endpoints: login, register
      const loginRes = await limiter.checkLimit('login', 'ip_outage_1');
      assert.equal(loginRes.allowed, false, 'Login must FAIL_CLOSED during Redis outage');
      assert.equal(loginRes.blockedByPolicy, true);
      assert.equal(loginRes.error, 'SERVICE_UNAVAILABLE');
      assert.match(loginRes.reason, /Fail-closed policy active/);

      const regRes = await limiter.checkLimit('register', 'ip_outage_1');
      assert.equal(regRes.allowed, false, 'Register must FAIL_CLOSED during Redis outage');
      assert.equal(regRes.blockedByPolicy, true);
    });

    it('enforces FAIL_SECURE_DEGRADED with in-memory gate for general API endpoints', async () => {
      const failingMock = {
        ping: async () => { throw new Error('Connection refused'); },
        incr: async () => { throw new Error('Connection refused'); },
        close: () => {}
      };

      const limiter = new DistributedRateLimiter({ redisClient: failingMock });

      // general_api has limit 60. Degraded limit is Math.floor(60 / 2) = 30.
      const apiRes = await limiter.checkLimit('general_api', 'user_api_key');
      assert.equal(apiRes.allowed, true, 'General API should degrade gracefully');
      assert.equal(apiRes.degraded, true);
      assert.equal(apiRes.total, 30, 'Degraded limit should be tightened to half');
      assert.equal(apiRes.remaining, 29);
      assert.match(apiRes.reason, /Degraded to local in-memory/);
    });

    it('in-memory degraded gate enforces limit and blocks excessive traffic', async () => {
      const failingMock = {
        ping: async () => { throw new Error('Connection refused'); },
        incr: async () => { throw new Error('Connection refused'); },
        close: () => {}
      };

      // Set small limit for general_api: limit 4 -> degraded limit 2
      const limiter = new DistributedRateLimiter({
        redisClient: failingMock,
        buckets: { general_api: { limit: 4, windowSec: 10 } }
      });

      const r1 = await limiter.checkLimit('general_api', 'client_1');
      assert.equal(r1.allowed, true);
      assert.equal(r1.remaining, 1);

      const r2 = await limiter.checkLimit('general_api', 'client_1');
      assert.equal(r2.allowed, true);
      assert.equal(r2.remaining, 0);

      const r3 = await limiter.checkLimit('general_api', 'client_1');
      assert.equal(r3.allowed, false, 'Degraded in-memory gate must block once threshold exceeded');
      assert.equal(r3.degraded, true);
    });
  });

  describe('4. Live Redis Integration (Conditional on Local Redis Container)', () => {
    let isRedisLive = false;
    let liveClient = null;

    before(async () => {
      try {
        liveClient = new NativeRespClient({ host: '127.0.0.1', port: 6379, timeoutMs: 1500 });
        const res = await liveClient.ping();
        if (res === 'PONG') {
          isRedisLive = true;
        }
      } catch {
        isRedisLive = false;
      }
    });

    after(() => {
      if (liveClient) liveClient.close();
    });

    it('connects to real Redis container and exchanges atomic RESP frames', async () => {
      if (!isRedisLive) {
        // Explicitly report skip without failing
        assert.ok(true, 'Skipping live Redis test: no local Redis on 6379');
        return;
      }

      const limiter = new DistributedRateLimiter({
        redisHost: '127.0.0.1',
        redisPort: 6379,
        buckets: {
          test_live: { limit: 3, windowSec: 30 }
        }
      });

      const testId = `test_${Date.now()}`;
      try {
        const r1 = await limiter.checkLimit('test_live', testId);
        assert.equal(r1.allowed, true);
        assert.equal(r1.current, 1);
        assert.equal(r1.remaining, 2);
        assert.equal(r1.degraded, false);

        const r2 = await limiter.checkLimit('test_live', testId);
        assert.equal(r2.allowed, true);
        assert.equal(r2.current, 2);

        const r3 = await limiter.checkLimit('test_live', testId);
        assert.equal(r3.allowed, true);
        assert.equal(r3.current, 3);
        assert.equal(r3.remaining, 0);

        // 4th request must be rejected
        const r4 = await limiter.checkLimit('test_live', testId);
        assert.equal(r4.allowed, false);
        assert.equal(r4.remaining, 0);

        // Reset cleans key up
        await limiter.reset('test_live', testId);
        const rFresh = await limiter.checkLimit('test_live', testId);
        assert.equal(rFresh.current, 1);
      } finally {
        await limiter.reset('test_live', testId);
        await limiter.close();
      }
    });
  });

});
