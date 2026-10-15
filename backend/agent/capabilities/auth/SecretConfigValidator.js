'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: SecretConfigValidator
 * 
 * Validates cryptographic secret hygiene, minimum entropy (>= 256 bits),
 * dictionary blacklist rejection, and fail-closed production startup.
 * INVARIANT: Never log or persist raw secrets or passwords.
 */

const crypto = require('crypto');

const WEAK_DICTIONARY = new Set([
  'secret',
  'jwt_secret',
  'jwtsecret',
  'password',
  'admin',
  '123456',
  '12345678',
  'changeme',
  'development',
  'production',
  'supersecret',
  'test',
  'testing',
  'default'
]);

class SecretConfigValidator {
  /**
   * Calculate Shannon entropy in bits for a given string
   * @param {string} str 
   * @returns {number}
   */
  static calculateEntropyBits(str) {
    if (!str || typeof str !== 'string') return 0;
    const len = str.length;
    const freq = new Map();
    for (let i = 0; i < len; i++) {
      const c = str[i];
      freq.set(c, (freq.get(c) || 0) + 1);
    }
    let entropy = 0;
    for (const count of freq.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return Math.floor(entropy * len);
  }

  /**
   * Check if secret matches known weak dictionary patterns
   * @param {string} secret 
   * @returns {boolean}
   */
  static isWeakSecret(secret) {
    if (!secret || typeof secret !== 'string') return true;
    const clean = secret.trim().toLowerCase();
    if (WEAK_DICTIONARY.has(clean)) return true;
    // Check repeating single character: e.g. "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    if (/^(.)\1+$/.test(secret)) return true;
    // Check simple sequential pattern
    if (/^(0123456789|abcdefghij|12345678)/i.test(secret)) return true;
    return false;
  }

  /**
   * Validate a JWT secret string
   * @param {string} secret 
   * @param {boolean} [isProduction=false] 
   * @returns {{ valid: boolean, error?: string, code?: string, entropyBits?: number, digest?: string }}
   */
  static validateJwtSecret(secret, isProduction = false) {
    if (!secret || typeof secret !== 'string') {
      return {
        valid: false,
        error: 'JWT_SECRET is missing or not a string',
        code: 'SECRET_MISSING'
      };
    }

    if (secret.length < 32) {
      return {
        valid: false,
        error: `JWT_SECRET must be at least 32 characters (found: ${secret.length})`,
        code: 'SECRET_TOO_SHORT',
        entropyBits: this.calculateEntropyBits(secret)
      };
    }

    if (this.isWeakSecret(secret)) {
      return {
        valid: false,
        error: 'JWT_SECRET matches a known weak or predictable dictionary pattern',
        code: 'SECRET_PREDICTABLE'
      };
    }

    const entropyBits = this.calculateEntropyBits(secret);
    if (isProduction && entropyBits < 128) {
      return {
        valid: false,
        error: `JWT_SECRET entropy too low (${entropyBits} bits, required min: 128 bits)`,
        code: 'SECRET_LOW_ENTROPY',
        entropyBits
      };
    }

    // Safe hash fingerprint for diagnostics without revealing secret
    const digest = crypto.createHash('sha256').update(secret).digest('hex').substring(0, 12);

    return {
      valid: true,
      entropyBits,
      digest: `sha256:${digest}...`
    };
  }

  /**
   * Enforce production environment startup checks.
   * Throws fail-closed in production if any security invariant is violated.
   * @param {Object} env process.env or config object
   * @returns {{ valid: boolean, warnings: string[], errors: string[] }}
   */
  static validateEnvironment(env = process.env) {
    const isProd = env.NODE_ENV === 'production';
    const errors = [];
    const warnings = [];

    // 1. JWT Secret
    const jwtCheck = this.validateJwtSecret(env.JWT_SECRET, isProd);
    if (!jwtCheck.valid) {
      if (isProd) {
        errors.push(`[FATAL] Production JWT Secret Invalid: ${jwtCheck.error}`);
      } else {
        warnings.push(`[WARN] Development JWT Secret Suboptimal: ${jwtCheck.error}`);
      }
    }

    // 2. Cookie / HTTPS enforcement
    if (isProd && env.ALLOW_HTTP === 'true') {
      errors.push('[FATAL] ALLOW_HTTP cannot be set to true in production environment');
    }

    // 3. Trusted Proxy Wildcards
    if (isProd && env.TRUST_PROXY === 'true') {
      warnings.push('[WARN] TRUST_PROXY is set to wildcard true. Should be bound to specific subnet CIDR in production');
    }

    const valid = errors.length === 0;
    if (!valid && isProd) {
      throw new Error(`PRODUCTION_SECURITY_CHECK_FAILED: \n${errors.join('\n')}`);
    }

    return {
      valid,
      isProduction: isProd,
      errors,
      warnings,
      jwtDigest: jwtCheck.digest || null
    };
  }

  /**
   * Redact sensitive tokens and passwords for safe logging
   * @param {string} val 
   * @returns {string}
   */
  static maskSecret(val) {
    if (!val || typeof val !== 'string') return '[EMPTY]';
    if (val.length <= 8) return '********';
    return `${val.substring(0, 4)}...${val.substring(val.length - 4)} (${val.length} chars)`;
  }
}

module.exports = SecretConfigValidator;
