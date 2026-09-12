'use strict';

/**
 * AI-Dost 2.0 — Phase 5B Test Suite
 * Reverse-Proxy & Transport Security Validation Tests
 * 
 * 20+ assertions covering:
 * 1. Trust-proxy wildcard rejection in production
 * 2. Secure, HttpOnly, and SameSite cookie attribute compliance
 * 3. CORS origin allowlist matching and untrusted/null origin rejection
 * 4. Host header poisoning prevention
 * 5. Client IP extraction & anti-spoofing behavior
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const ProxySecurityValidator = require('../agent/capabilities/auth/ProxySecurityValidator');

describe('Proxy & Transport Security Validation Suite', () => {

  describe('1. Trust-Proxy Configuration & Spoofing Guard', () => {
    it('rejects wildcard "trust proxy: true" in production', () => {
      const prodValidator = new ProxySecurityValidator({ isProduction: true, trustProxy: true });
      const check = prodValidator.validateTrustProxy(true);
      assert.equal(check.valid, false);
      assert.equal(check.code, 'TRUST_PROXY_WILDCARD');
      assert.match(check.error, /client IP spoofing/);
    });

    it('allows trust-proxy in development mode', () => {
      const devValidator = new ProxySecurityValidator({ isProduction: false, trustProxy: true });
      const check = devValidator.validateTrustProxy(true);
      assert.equal(check.valid, true);
    });

    it('accepts specific CIDR or numeric hop count configurations', () => {
      const prodValidator = new ProxySecurityValidator({ isProduction: true });
      assert.equal(prodValidator.validateTrustProxy('loopback').valid, true);
      assert.equal(prodValidator.validateTrustProxy(1).valid, true);
      assert.equal(prodValidator.validateTrustProxy('10.0.0.0/8').valid, true);
    });
  });

  describe('2. Cookie Security Attributes', () => {
    it('enforces httpOnly: true to prevent XSS script access', () => {
      const validator = new ProxySecurityValidator({ isProduction: false });

      const missingHttpOnly = validator.validateCookieOptions({
        sameSite: 'Strict'
      });
      assert.equal(missingHttpOnly.valid, false);
      assert.ok(missingHttpOnly.errors.some(e => e.includes('httpOnly')));

      const withHttpOnly = validator.validateCookieOptions({
        httpOnly: true,
        sameSite: 'Strict'
      });
      assert.equal(withHttpOnly.valid, true);
    });

    it('enforces secure: true in production environment', () => {
      const prodValidator = new ProxySecurityValidator({ isProduction: true });

      const insecureProd = prodValidator.validateCookieOptions({
        httpOnly: true,
        secure: false,
        sameSite: 'Lax'
      });
      assert.equal(insecureProd.valid, false);
      assert.ok(insecureProd.errors.some(e => e.includes('secure: true in production')));

      const secureProd = prodValidator.validateCookieOptions({
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      });
      assert.equal(secureProd.valid, true);
    });

    it('enforces sameSite: Strict or Lax and rejects None or missing', () => {
      const validator = new ProxySecurityValidator({ isProduction: false });

      const missingSameSite = validator.validateCookieOptions({
        httpOnly: true
      });
      assert.equal(missingSameSite.valid, false);
      assert.ok(missingSameSite.errors.some(e => e.includes('sameSite')));

      const noneSameSite = validator.validateCookieOptions({
        httpOnly: true,
        sameSite: 'None'
      });
      assert.equal(noneSameSite.valid, false);

      const strictSameSite = validator.validateCookieOptions({
        httpOnly: true,
        sameSite: 'Strict'
      });
      assert.equal(strictSameSite.valid, true);
    });
  });

  describe('3. CORS Origin Allowlist Validation', () => {
    const validator = new ProxySecurityValidator({
      allowedOrigins: ['http://localhost:3000', 'https://app.ai-dost.com']
    });

    it('allows requests from exact allowlisted origins', () => {
      const r1 = validator.validateOrigin('http://localhost:3000');
      assert.equal(r1.allowed, true);
      assert.equal(r1.origin, 'http://localhost:3000');

      const r2 = validator.validateOrigin('https://app.ai-dost.com');
      assert.equal(r2.allowed, true);
    });

    it('allows non-browser requests with no Origin header (curl/internal)', () => {
      const res = validator.validateOrigin(undefined);
      assert.equal(res.allowed, true);
      assert.equal(res.origin, null);
    });

    it('rejects "null" origin to block sandboxed iframe/data-URI exploits', () => {
      const res = validator.validateOrigin('null');
      assert.equal(res.allowed, false);
      assert.match(res.reason, /Null origin is disallowed/);
    });

    it('rejects unlisted and attacker origins', () => {
      const res1 = validator.validateOrigin('https://evil-hacker.com');
      assert.equal(res1.allowed, false);
      assert.match(res1.reason, /not in the CORS allowlist/);

      const res2 = validator.validateOrigin('http://localhost:3000.evil.com');
      assert.equal(res2.allowed, false);
    });
  });

  describe('4. Host Header Poisoning Defense', () => {
    const validator = new ProxySecurityValidator({
      allowedHosts: ['localhost:5000', 'api.ai-dost.com']
    });

    it('accepts legitimate host headers with or without port', () => {
      assert.equal(validator.validateHostHeader('localhost:5000').valid, true);
      assert.equal(validator.validateHostHeader('api.ai-dost.com').valid, true);
      assert.equal(validator.validateHostHeader('api.ai-dost.com:443').valid, true);
    });

    it('rejects forged, poisoned, or missing host headers', () => {
      const missing = validator.validateHostHeader('');
      assert.equal(missing.valid, false);

      const poisoned = validator.validateHostHeader('evil-phishing-host.com');
      assert.equal(poisoned.valid, false);
      assert.match(poisoned.error, /Host header "evil-phishing-host.com" is not recognized/);
    });
  });

  describe('5. Client IP Extraction & Anti-Spoofing', () => {
    it('uses raw socket IP when trust-proxy is disabled', () => {
      const validator = new ProxySecurityValidator({ trustProxy: false });
      const req = {
        socket: { remoteAddress: '203.0.113.195' },
        headers: { 'x-forwarded-for': '198.51.100.1' } // spoof attempt
      };

      const ip = validator.getClientIp(req);
      assert.equal(ip, '203.0.113.195', 'Must ignore spoofed X-Forwarded-For when trust proxy is false');
    });

    it('extracts client IP from X-Forwarded-For when trust-proxy is configured', () => {
      const validator = new ProxySecurityValidator({ trustProxy: true, isProduction: false });
      const req = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }
      };

      const ip = validator.getClientIp(req);
      assert.equal(ip, '198.51.100.1', 'Should extract client IP from leftmost entry in X-Forwarded-For');
    });
  });

});
