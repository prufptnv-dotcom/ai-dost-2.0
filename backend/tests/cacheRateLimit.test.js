'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const cacheService = require('../services/cacheService');
const rateLimiter = require('../middleware/rateLimiter');

// Standalone runner: the shared Redis client keeps the loop alive after tests
// (same pattern as integration.test.js)
test.after(() => {
  try { cacheService.redis?.disconnect(); } catch {}
});

test('P2 #46: increment starts a window without resetting TTL on later increments', async () => {
  const key = `ratelimit:test:ttl:${Date.now()}`;
  assert.equal(await cacheService.increment(key, 1), 1);
  assert.equal(await cacheService.increment(key, 1), 2);
  assert.equal(await cacheService.increment(key, 1), 3);
  // Increments must NOT extend the 1s window (old code re-set TTL every time)
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal(await cacheService.get(key), null, 'window must expire 1s after it started');
});

test('P2 #46: rate limiter allows maxRequests then blocks with 429', async () => {
  const middleware = rateLimiter({ maxRequests: 3, windowSeconds: 60 });
  const makeRes = () => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { res.statusCode = code; return res; },
      json(payload) { res.body = payload; return res; },
    };
    return res;
  };
  const req = { ip: '203.0.113.9', baseUrl: `/api/test-${Date.now()}`, path: '/api/test' };

  for (let i = 0; i < 3; i++) {
    let passed = false;
    await middleware(req, makeRes(), () => { passed = true; });
    assert.equal(passed, true, `request ${i + 1} must pass`);
  }

  const res = makeRes();
  let passed = false;
  await middleware(req, res, () => { passed = true; });
  assert.equal(passed, false, '4th request must be blocked');
  assert.equal(res.statusCode, 429);
});

test('P2 #46: loopback bypass still applies in dev', async () => {
  const middleware = rateLimiter({ maxRequests: 1, windowSeconds: 60 });
  const req = { ip: '127.0.0.1', baseUrl: '/api/local', path: '/api/local' };
  const res = { status() { return res; }, json() { return res; } };
  for (let i = 0; i < 5; i++) {
    let passed = false;
    await middleware(req, res, () => { passed = true; });
    assert.equal(passed, true, 'loopback is bypassed in dev');
  }
});

test('P2 #47: sweepExpired removes expired entries and enforces the size cap', () => {
  const originalCap = cacheService.maxMemoryEntries;
  try {
    // Populate the memory store directly: deterministic even when Redis is up
    // (set() would route into Redis and leave memoryCache empty)
    for (let i = 0; i < 10; i++) {
      cacheService.memoryCache.set(`sweep:filler:${i}`, { value: { i }, expiry: Date.now() + 3600 * 1000 });
    }
    cacheService.memoryCache.set('sweep:expired', { value: { v: 1 }, expiry: Date.now() - 1 });

    cacheService.maxMemoryEntries = 5;
    cacheService.sweepExpired();

    assert.equal(cacheService.memoryCache.has('sweep:expired'), false, 'expired key swept without a get()');
    assert.ok(cacheService.memoryCache.size <= 5, `size ${cacheService.memoryCache.size} must be capped`);
  } finally {
    cacheService.maxMemoryEntries = originalCap;
    for (const key of [...cacheService.memoryCache.keys()]) {
      if (key.startsWith('sweep:') || key.startsWith('ratelimit:test')) cacheService.memoryCache.delete(key);
    }
  }
});
