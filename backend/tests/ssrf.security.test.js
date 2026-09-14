'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateUrlForSsrf, isPrivateOrReservedIp } = require('../services/urlFetcherService');

describe('SSRF guard — deterministic policy', () => {
  test('blocks IPv4 loopback, private and metadata ranges', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.10', '169.254.169.254']) {
      assert.equal(isPrivateOrReservedIp(ip), true, `expected ${ip} to be blocked`);
    }
  });

  test('blocks IPv6 loopback, ULA and link-local ranges', () => {
    for (const ip of ['::1', 'fc00::1', 'fe80::1']) {
      assert.equal(isPrivateOrReservedIp(ip), true, `expected ${ip} to be blocked`);
    }
  });

  test('allows representative public IP addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      assert.equal(isPrivateOrReservedIp(ip), false, `expected ${ip} to be allowed`);
    }
  });

  test('blocks non-http protocols and embedded credentials', async () => {
    const protocols = await Promise.all([
      validateUrlForSsrf('file:///etc/passwd'),
      validateUrlForSsrf('ftp://example.com/file'),
      validateUrlForSsrf('gopher://example.com/'),
      validateUrlForSsrf('http://admin:secret@example.com/private')
    ]);
    protocols.forEach((result) => assert.equal(result.valid, false));
  });

  test('blocks known metadata/internal hostnames', async () => {
    for (const url of [
      'http://localhost:5000/health',
      'http://metadata.google.internal/computeMetadata/v1',
      'http://kubernetes.default.svc/api',
      'http://instance-data/latest/meta-data'
    ]) {
      const result = await validateUrlForSsrf(url);
      assert.equal(result.valid, false, `expected ${url} to be blocked`);
    }
  });

  test('blocks IPv4-mapped IPv6 loopback', async () => {
    const result = await validateUrlForSsrf('http://[::ffff:127.0.0.1]/secret');
    assert.equal(result.valid, false);
  });
});
