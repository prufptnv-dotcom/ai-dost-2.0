'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: AuthCryptoEngine
 * 
 * Cryptographic engine for server-side password hashing, constant-time verification,
 * and timing-safe comparison without external runtime dependencies.
 */

const crypto = require('crypto');

const DEFAULT_SCRYPT_PARAMS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
  keylen: 64
});

// Pre-computed dummy hash to run on non-existent users for constant-time evaluation
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_KEY = crypto.scryptSync('__dummy_user_entropy_protection__', DUMMY_SALT, 64, {
  cost: DEFAULT_SCRYPT_PARAMS.N,
  blockSize: DEFAULT_SCRYPT_PARAMS.r,
  parallelization: DEFAULT_SCRYPT_PARAMS.p,
  maxmem: DEFAULT_SCRYPT_PARAMS.maxmem
}).toString('hex');
const DUMMY_HASH = `$scrypt$v=1$N=16384,r=8,p=1$${DUMMY_SALT}$${DUMMY_KEY}`;

class AuthCryptoEngine {
  /**
   * Validate password complexity and length bounds
   * @param {string} password
   * @returns {{ valid: boolean, error?: string }}
   */
  static validatePasswordComplexity(password) {
    if (typeof password !== 'string') {
      return { valid: false, error: 'Password must be a valid string' };
    }

    const byteLength = Buffer.byteLength(password, 'utf8');
    if (byteLength > 72) {
      return { valid: false, error: 'Password exceeds maximum allowed length of 72 bytes' };
    }
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'Password must contain at least one number' };
    }

    return { valid: true };
  }

  /**
   * Hash a password using versioned scrypt
   * @param {string} password
   * @param {Object} [options]
   * @returns {string} Formatted Modular Crypt string
   */
  static hashPassword(password, options = {}) {
    const val = this.validatePasswordComplexity(password);
    if (!val.valid) {
      throw new Error(`PASSWORD_VALIDATION_FAILED: ${val.error}`);
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const N = options.N || DEFAULT_SCRYPT_PARAMS.N;
    const r = options.r || DEFAULT_SCRYPT_PARAMS.r;
    const p = options.p || DEFAULT_SCRYPT_PARAMS.p;
    const keylen = options.keylen || DEFAULT_SCRYPT_PARAMS.keylen;

    const derivedKey = crypto.scryptSync(password, salt, keylen, {
      cost: N,
      blockSize: r,
      parallelization: p,
      maxmem: DEFAULT_SCRYPT_PARAMS.maxmem
    });

    return `$scrypt$v=1$N=${N},r=${r},p=${p}$${salt}$${derivedKey.toString('hex')}`;
  }

  /**
   * Verify password against modular crypt hash in constant time
   * @param {string} password
   * @param {string} storedHash
   * @returns {boolean}
   */
  static verifyPassword(password, storedHash) {
    if (typeof password !== 'string' || typeof storedHash !== 'string') {
      return false;
    }

    // Enforce 72-byte max length check
    if (Buffer.byteLength(password, 'utf8') > 72) {
      return false;
    }

    const parts = storedHash.split('$');
    // Expected format: $scrypt$v=1$N=16384,r=8,p=1$<salt>$<hash> -> ['', 'scrypt', 'v=1', 'N=...,r=...,p=...', salt, keyHex]
    if (parts.length === 6 && parts[1] === 'scrypt') {
      const paramsPart = parts[3]; // N=16384,r=8,p=1
      const salt = parts[4];
      const expectedKeyHex = parts[5];

      const params = {};
      for (const pair of paramsPart.split(',')) {
        const [k, v] = pair.split('=');
        params[k] = parseInt(v, 10);
      }

      const expectedBuffer = Buffer.from(expectedKeyHex, 'hex');
      const derivedKey = crypto.scryptSync(password, salt, expectedBuffer.length, {
        cost: params.N || DEFAULT_SCRYPT_PARAMS.N,
        blockSize: params.r || DEFAULT_SCRYPT_PARAMS.r,
        parallelization: params.p || DEFAULT_SCRYPT_PARAMS.p,
        maxmem: DEFAULT_SCRYPT_PARAMS.maxmem
      });

      if (derivedKey.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(derivedKey, expectedBuffer);
    }

    // Generic fallback comparison
    return false;
  }

  /**
   * Execute dummy password verification for non-existent users
   * Ensures constant-time execution preventing username/email enumeration.
   */
  static dummyVerify(password) {
    const pwd = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72
      ? password
      : 'dummy_fallback_for_timing_safety';
    this.verifyPassword(pwd, DUMMY_HASH);
    return false;
  }

  /**
   * Compare two strings in constant time to prevent timing attacks
   * @param {string} a
   * @param {string} b
   * @returns {boolean}
   */
  static constantTimeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') {
      return false;
    }
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) {
      // Run dummy timingSafeEqual against self to normalize execution time
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Generate high-entropy cryptographically secure random token
   * @param {number} bytes
   * @returns {string} Hex string
   */
  static generateRandomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Compute SHA-256 hash of a string/token
   * @param {string} input
   * @returns {string} Hex string
   */
  static sha256(input) {
    return crypto.createHash('sha256').update(String(input)).digest('hex');
  }

  static hashToken(input) {
    return this.sha256(input);
  }

  static maskSensitive() {
    return '[REDACTED]';
  }
}

module.exports = {
  AuthCryptoEngine,
  DEFAULT_SCRYPT_PARAMS,
  DUMMY_HASH
};
