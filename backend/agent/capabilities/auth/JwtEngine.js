'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: JwtEngine
 * 
 * Cryptographically hardened JWT implementation using native Node.js crypto.
 * Enforces strict HS256 allowlist, rejects algorithm confusion and 'none' alg,
 * validates iss/aud/sub/exp/iat/jti claims, and validates token_version.
 */

const crypto = require('crypto');

const ALLOWED_ALGORITHMS = Object.freeze(['HS256']);

function base64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(input) {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4 !== 0) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

class JwtEngine {
  /**
   * Sign a payload to produce a signed JWT string
   * @param {Object} payload
   * @param {string} secret
   * @param {Object} [options]
   * @returns {string} Encoded JWT
   */
  static sign(payload, secret, options = {}) {
    if (typeof secret !== 'string' || secret.length < 32) {
      throw new Error('JWT_SECRET_INVALID: JWT secret must be at least 32 characters (256 bits)');
    }

    const alg = options.algorithm || 'HS256';
    if (!ALLOWED_ALGORITHMS.includes(alg)) {
      throw new Error(`JWT_ALGORITHM_REJECTED: Algorithm '${alg}' is not in allowlist: [${ALLOWED_ALGORITHMS.join(', ')}]`);
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = options.expiresInSec || 900; // 15m default

    const header = {
      alg,
      typ: 'JWT'
    };

    const claims = {
      ...payload,
      iat: payload.iat || now,
      exp: payload.exp || (now + ttl),
      jti: payload.jti || crypto.randomUUID(),
      iss: options.issuer || payload.iss || 'ai-dost',
      aud: options.audience || payload.aud || 'ai-dost-client'
    };

    if (!claims.sub) {
      throw new Error('JWT_SIGN_FAILED: Claim "sub" (subject identifier) is required');
    }

    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(claims));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto.createHmac('sha256', secret)
      .update(signingInput)
      .digest();

    const encodedSignature = base64urlEncode(signature);
    return `${signingInput}.${encodedSignature}`;
  }

  /**
   * Non-throwing verification returning status envelope
   */
  static verifySafe(token, secret, expectedClaims = {}) {
    if (typeof token !== 'string' || !token.trim()) {
      return { valid: false, error: 'Malformed JWT token: token missing or empty', code: 'TOKEN_MISSING' };
    }
    if (typeof secret !== 'string' || secret.length < 32) {
      return { valid: false, error: 'Verification secret is invalid or weak', code: 'SECRET_INVALID' };
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT token: expected 3 parts', code: 'MALFORMED_TOKEN' };
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // 1. Decode and inspect Header
    let header;
    try {
      header = JSON.parse(base64urlDecode(encodedHeader));
    } catch {
      return { valid: false, error: 'Malformed JWT token: invalid header JSON', code: 'INVALID_HEADER' };
    }

    if (!header || typeof header !== 'object') {
      return { valid: false, error: 'Malformed JWT token: header is not an object', code: 'INVALID_HEADER' };
    }

    // Reject 'none' algorithm and any unapproved algorithms
    if (!header.alg || header.alg.toLowerCase() === 'none' || !ALLOWED_ALGORITHMS.includes(header.alg)) {
      return {
        valid: false,
        error: `Unsupported algorithm '${header.alg}'. Only approved allowlist: [${ALLOWED_ALGORITHMS.join(', ')}]`,
        code: 'ALGORITHM_REJECTED'
      };
    }

    // 2. Decode and inspect Payload
    let payload;
    try {
      payload = JSON.parse(base64urlDecode(encodedPayload));
    } catch {
      return { valid: false, error: 'Malformed JWT token: invalid payload JSON', code: 'INVALID_PAYLOAD' };
    }

    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Malformed JWT token: payload is not an object', code: 'INVALID_PAYLOAD' };
    }

    // 3. Verify Signature in constant time
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(signingInput)
      .digest();

    let providedSignature;
    try {
      let sigStr = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
      while (sigStr.length % 4 !== 0) sigStr += '=';
      providedSignature = Buffer.from(sigStr, 'base64');
    } catch {
      return { valid: false, error: 'Invalid JWT signature encoding', code: 'SIGNATURE_INVALID' };
    }

    if (providedSignature.length !== expectedSignature.length) {
      // Dummy compare to avoid timing leak
      crypto.timingSafeEqual(expectedSignature, expectedSignature);
      return { valid: false, error: 'Invalid JWT signature', code: 'SIGNATURE_MISMATCH' };
    }

    if (!crypto.timingSafeEqual(providedSignature, expectedSignature)) {
      return { valid: false, error: 'Invalid JWT signature', code: 'SIGNATURE_MISMATCH' };
    }

    // 4. Validate Claims
    const now = Math.floor(Date.now() / 1000);

    // Expiration
    if (typeof payload.exp !== 'number' || now >= payload.exp) {
      return { valid: false, error: 'JWT has expired', code: 'TOKEN_EXPIRED' };
    }

    // Issued at (iat) not in future (allow 5s clock skew)
    if (typeof payload.iat === 'number' && payload.iat > now + 5) {
      return { valid: false, error: 'JWT issued in the future', code: 'TOKEN_FUTURE_IAT' };
    }

    // Issuer check
    const expIssuer = expectedClaims.issuer || expectedClaims.expectedIssuer;
    if (expIssuer && payload.iss !== expIssuer) {
      return { valid: false, error: `JWT issuer mismatch: expected '${expIssuer}'`, code: 'ISSUER_MISMATCH' };
    }

    // Audience check
    const expAudience = expectedClaims.audience || expectedClaims.expectedAudience;
    if (expAudience && payload.aud !== expAudience) {
      return { valid: false, error: `JWT audience mismatch: expected '${expAudience}'`, code: 'AUDIENCE_MISMATCH' };
    }

    // Subject check
    if (expectedClaims.subject && payload.sub !== expectedClaims.subject) {
      return { valid: false, error: `JWT subject mismatch: expected '${expectedClaims.subject}'`, code: 'SUBJECT_MISMATCH' };
    }

    // Token version check
    const currentVersion = expectedClaims.currentTokenVersion !== undefined
      ? expectedClaims.currentTokenVersion
      : (expectedClaims.minTokenVersion !== undefined ? expectedClaims.minTokenVersion : expectedClaims.token_version);

    if (currentVersion !== undefined) {
      const payloadVersion = payload.token_version !== undefined ? payload.token_version : payload.tokenVersion;
      if (payloadVersion !== undefined && payloadVersion !== currentVersion) {
        return {
          valid: false,
          error: 'Token version revoked',
          code: 'TOKEN_REVOKED_VERSION'
        };
      }
    }

    return {
      valid: true,
      payload
    };
  }

  /**
   * Verify and decode a JWT string. Throws on error; returns decoded payload on success.
   * @param {string} token
   * @param {string} secret
   * @param {Object} [expectedClaims]
   * @returns {Object} Decoded payload with .valid = true
   */
  static verify(token, secret, expectedClaims = {}) {
    const res = this.verifySafe(token, secret, expectedClaims);
    if (!res.valid) {
      const err = new Error(res.error || 'JWT verification failed');
      err.code = res.code;
      throw err;
    }
    return {
      valid: true,
      payload: res.payload,
      ...res.payload
    };
  }
}

module.exports = {
  JwtEngine,
  ALLOWED_ALGORITHMS
};
