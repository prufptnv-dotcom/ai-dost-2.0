'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ensureLocalUrl, checkBackendHealth } = require('../scripts/preflight-phase-1-benchmark');

describe('Phase 1 benchmark readiness preflight', () => {
  test('only accepts loopback backend URLs', () => {
    assert.equal(ensureLocalUrl('http://127.0.0.1:5000/'), 'http://127.0.0.1:5000');
    assert.throws(() => ensureLocalUrl('https://example.com'), /loopback/);
    assert.throws(() => ensureLocalUrl('file:///tmp/backend'), /HTTP or HTTPS/);
  });

  test('reports backend health and recognized key count without exposing secrets', async () => {
    const result = await checkBackendHealth({
      baseUrl: 'http://127.0.0.1:5000',
      fetchImpl: async (url, options) => {
        assert.equal(url, 'http://127.0.0.1:5000/health');
        assert.equal(options.method, 'GET');
        return new Response(JSON.stringify({ status: 'OK', keysConfigured: 2 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    assert.equal(result.healthStatus, 'OK');
    assert.equal(result.keysConfigured, 2);
    assert.equal(result.providerConfiguration, 'AT_LEAST_ONE_API_KEY_CONFIGURED');
    assert.equal(result.warning, null);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  });

  test('warns, rather than falsely failing, when no recognized provider keys are reported', async () => {
    const result = await checkBackendHealth({
      baseUrl: 'http://localhost:5000',
      fetchImpl: async () => new Response(JSON.stringify({ status: 'OK', keysConfigured: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });
    assert.equal(result.providerConfiguration, 'NO_RECOGNIZED_API_KEYS_REPORTED');
    assert.match(result.warning, /OAuth or other auth paths may still work/);
  });

  test('fails closed when health is unavailable or unhealthy', async () => {
    await assert.rejects(
      checkBackendHealth({
        baseUrl: 'http://127.0.0.1:5000',
        fetchImpl: async () => new Response('offline', { status: 503 }),
      }),
      /HTTP 503/,
    );
    await assert.rejects(
      checkBackendHealth({
        baseUrl: 'http://127.0.0.1:5000',
        fetchImpl: async () => new Response(JSON.stringify({ status: 'DEGRADED' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      }),
      /status is not OK/,
    );
  });
});
