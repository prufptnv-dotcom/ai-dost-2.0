'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: JwtKeyManager
 * 
 * Versioned JWT signing-key management with Key ID (kid) headers,
 * seamless zero-downtime key rotation, and overlap grace periods.
 * INVARIANT: HS256-only; rejects algorithm confusion and untrusted keys.
 */

const crypto = require('crypto');
const SecretConfigValidator = require('./SecretConfigValidator');

class JwtKeyManager {
  /**
   * @param {Object} [options]
   * @param {string} [options.initialSecret]
   * @param {string} [options.initialKid]
   * @param {number} [options.defaultGracePeriodSec=86400] 24 hours default overlap
   */
  constructor(options = {}) {
    this.defaultGracePeriodSec = options.defaultGracePeriodSec || 86400;
    this.keyring = new Map(); // kid -> { kid, secret, status: 'active'|'grace_period'|'revoked', createdAt, expiresAt }
    this.currentKid = null;

    const initialSecret = options.initialSecret || process.env.JWT_SECRET || 'aidost-default-secure-jwt-key-min-32-chars-entropy-ok!';
    const initialKid = options.initialKid || `key_${crypto.randomUUID().substring(0, 8)}`;
    this.addKey(initialKid, initialSecret, { status: 'active' });
    this.currentKid = initialKid;
  }

  /**
   * Add a key to the keyring
   * @param {string} kid 
   * @param {string} secret 
   * @param {Object} [metadata]
   */
  addKey(kid, secret, metadata = {}) {
    const val = SecretConfigValidator.validateJwtSecret(secret, false);
    if (!val.valid) {
      throw new Error(`JWT_KEY_INVALID: ${val.error}`);
    }

    const now = new Date();
    const ttlSec = metadata.ttlSec || (365 * 86400); // 1 year default
    const expiresAt = new Date(now.getTime() + ttlSec * 1000).toISOString();

    const record = {
      kid,
      secret,
      status: metadata.status || 'active',
      createdAt: now.toISOString(),
      expiresAt
    };

    this.keyring.set(kid, record);
    return record;
  }

  /**
   * Rotate active signing key with an overlap grace period for previous keys.
   * @param {string} newSecret 
   * @param {Object} [options]
   * @returns {{ oldKid: string, newKid: string, gracePeriodExpiresAt: string }}
   */
  rotateKey(newSecret, options = {}) {
    const oldKid = this.currentKid;
    const oldRecord = this.keyring.get(oldKid);
    const graceSec = options.gracePeriodSec || this.defaultGracePeriodSec;
    const now = new Date();
    const graceExpiresAt = new Date(now.getTime() + graceSec * 1000).toISOString();

    if (oldRecord) {
      oldRecord.status = 'grace_period';
      oldRecord.expiresAt = graceExpiresAt;
    }

    const newKid = options.newKid || `key_${crypto.randomUUID().substring(0, 8)}`;
    this.addKey(newKid, newSecret, { status: 'active', ttlSec: options.ttlSec });
    this.currentKid = newKid;

    return {
      oldKid,
      newKid,
      gracePeriodExpiresAt: graceExpiresAt
    };
  }

  /**
   * Revoke a key immediately (e.g. if compromised)
   * @param {string} kid 
   * @returns {boolean}
   */
  revokeKey(kid) {
    const rec = this.keyring.get(kid);
    if (!rec) return false;
    rec.status = 'revoked';
    if (this.currentKid === kid) {
      // Must promote another active key or warn
      const nextActive = Array.from(this.keyring.values()).find(k => k.status === 'active' && k.kid !== kid);
      this.currentKid = nextActive ? nextActive.kid : null;
    }
    return true;
  }

  /**
   * Get active signing key
   * @returns {{ kid: string, secret: string }}
   */
  getActiveKey() {
    if (!this.currentKid) {
      throw new Error('JWT_KEY_ERROR: No active signing key configured');
    }
    const rec = this.keyring.get(this.currentKid);
    if (!rec || rec.status !== 'active') {
      throw new Error('JWT_KEY_ERROR: Active signing key is invalid or revoked');
    }
    return { kid: rec.kid, secret: rec.secret };
  }

  /**
   * Look up verification key by kid
   * @param {string} [kid] 
   * @returns {{ kid: string, secret: string, status: string }|null}
   */
  getKeyForVerification(kid) {
    if (!kid) {
      // Fall back to current active key if kid omitted
      return this.currentKid ? this.keyring.get(this.currentKid) : null;
    }
    const rec = this.keyring.get(kid);
    if (!rec) return null;
    if (rec.status === 'revoked') return null;

    // Check expiration
    if (new Date(rec.expiresAt) <= new Date()) {
      return null;
    }

    return rec;
  }

  /**
   * Clean up expired grace-period keys
   * @returns {number} count of purged keys
   */
  pruneExpiredKeys() {
    let purged = 0;
    const now = new Date();
    for (const [kid, rec] of this.keyring.entries()) {
      if (kid !== this.currentKid && (rec.status === 'revoked' || new Date(rec.expiresAt) <= now)) {
        this.keyring.delete(kid);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Base64URL encoding helper
   */
  static base64UrlEncode(str) {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  static base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  /**
   * Sign a JWT with the current active key and kid header
   * @param {Object} payload 
   * @param {Object} [options]
   * @returns {string} Signed JWT
   */
  sign(payload, options = {}) {
    const activeKey = this.getActiveKey();
    const header = {
      alg: 'HS256',
      typ: 'JWT',
      kid: activeKey.kid
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + (options.expiresInSec || 900); // 15 min default

    const claims = {
      ...payload,
      iat: options.iat || nowSec,
      exp: options.exp || expSec,
      jti: options.jti || crypto.randomUUID()
    };

    const encodedHeader = JwtKeyManager.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = JwtKeyManager.base64UrlEncode(JSON.stringify(claims));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', activeKey.secret)
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${dataToSign}.${signature}`;
  }

  /**
   * Verify a JWT against the keyring matching the token's kid
   * @param {string} token 
   * @returns {{ valid: boolean, payload?: Object, error?: string, code?: string, kid?: string }}
   */
  verify(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token missing or invalid type', code: 'TOKEN_INVALID' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure', code: 'TOKEN_MALFORMED' };
    }

    const [headerB64, payloadB64, sigB64] = parts;

    let header = null;
    let payload = null;
    try {
      header = JSON.parse(JwtKeyManager.base64UrlDecode(headerB64));
      payload = JSON.parse(JwtKeyManager.base64UrlDecode(payloadB64));
    } catch {
      return { valid: false, error: 'Failed to decode token JSON', code: 'DECODE_ERROR' };
    }

    // Algorithm check
    if (header.alg !== 'HS256') {
      return { valid: false, error: `Unsupported algorithm "${header.alg}"`, code: 'ALG_NOT_ALLOWED' };
    }

    // Key lookup
    const keyRec = this.getKeyForVerification(header.kid);
    if (!keyRec) {
      return {
        valid: false,
        error: `Signing key "${header.kid || 'none'}" not found or expired`,
        code: 'KEY_NOT_FOUND',
        kid: header.kid
      };
    }

    // Verify signature with constant-time check
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', keyRec.secret)
      .update(dataToVerify)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(sigB64);

    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      return { valid: false, error: 'Signature mismatch', code: 'SIGNATURE_MISMATCH' };
    }

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, error: 'Token has expired', code: 'TOKEN_EXPIRED', payload };
    }

    return {
      valid: true,
      payload,
      kid: keyRec.kid,
      keyStatus: keyRec.status
    };
  }
}

module.exports = JwtKeyManager;
