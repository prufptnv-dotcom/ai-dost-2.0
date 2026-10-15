'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: RefreshTokenManager
 * 
 * Manages opaque rotating refresh tokens, SHA-256 storage hashing,
 * token family tracking, replay attack detection, and global logout.
 */

const crypto = require('crypto');

class RefreshTokenManager {
  /**
   * In-memory or database-backed store for refresh tokens
   * @param {Object} [options]
   */
  constructor(options = {}) {
    this._tokens = new Map(); // tokenId -> record
    this._tokenHashToId = new Map(); // tokenHash -> tokenId
    this._defaultTtlSec = options.ttlMs !== undefined ? (options.ttlMs / 1000) : (options.ttlSec || 604800);
  }

  /**
   * Issue an initial refresh token upon login
   * @param {string} userId
   * @param {Object} [metadata]
   * @returns {{ rawToken: string, tokenId: string, familyId: string, expiresAt: string }}
   */
  issueToken(userId, metadata = {}) {
    if (!userId || typeof userId !== 'string') {
      throw new Error('REFRESH_TOKEN_FAILED: userId is required');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = `rt_${crypto.randomUUID()}`;
    const familyId = `fam_${crypto.randomUUID()}`;
    const now = new Date();
    const ttl = metadata.ttlMs !== undefined ? (metadata.ttlMs / 1000) : (metadata.ttlSec || this._defaultTtlSec);
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();

    const record = {
      id: tokenId,
      userId,
      tokenHash,
      familyId,
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: now.toISOString(),
      userAgentHash: metadata.userAgent ? crypto.createHash('sha256').update(metadata.userAgent).digest('hex') : null,
      ipSubnet: metadata.ipSubnet || null
    };

    this._tokens.set(tokenId, record);
    this._tokenHashToId.set(tokenHash, tokenId);

    return {
      rawToken,
      tokenId,
      familyId,
      expiresAt
    };
  }

  /**
   * Rotate a refresh token with replay attack detection
   * @param {string} rawToken
   * @param {Object} [metadata]
   * @returns {{ ok: boolean, newRawToken?: string, newTokenId?: string, familyId?: string, error?: string, code?: string, userId?: string }}
   */
  rotateToken(rawToken, metadata = {}) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { ok: false, error: 'Missing refresh token', code: 'TOKEN_MISSING' };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = this._tokenHashToId.get(tokenHash);

    if (!tokenId) {
      return { ok: false, error: 'Unknown refresh token', code: 'INVALID_TOKEN' };
    }

    const record = this._tokens.get(tokenId);
    if (!record) {
      return { ok: false, error: 'Invalid token record', code: 'INVALID_RECORD' };
    }

    // ── REPLAY ATTACK DETECTION ──────────────────────────────────────────────
    // If the token was already revoked, an attacker or concurrent entity is replaying an old token!
    if (record.revokedAt !== null) {
      // Invalidate the ENTIRE family lineage immediately!
      this.revokeFamily(record.familyId);
      return {
        ok: false,
        error: 'Refresh token reuse detected: token family has been revoked',
        code: 'TOKEN_REPLAY_DETECTED',
        familyId: record.familyId,
        userId: record.userId
      };
    }

    // Check expiration
    const now = new Date();
    if (new Date(record.expiresAt) <= now) {
      record.revokedAt = now.toISOString();
      return { ok: false, error: 'Refresh token expired', code: 'TOKEN_EXPIRED', userId: record.userId };
    }

    // Issue successor token in the same family
    const newRawToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
    const newTokenId = `rt_${crypto.randomUUID()}`;
    const expiresAt = new Date(now.getTime() + this._defaultTtlSec * 1000).toISOString();

    const newRecord = {
      id: newTokenId,
      userId: record.userId,
      tokenHash: newTokenHash,
      familyId: record.familyId,
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: now.toISOString(),
      userAgentHash: metadata.userAgent ? crypto.createHash('sha256').update(metadata.userAgent).digest('hex') : record.userAgentHash,
      ipSubnet: metadata.ipSubnet || record.ipSubnet
    };

    // Mark current token revoked and link to successor
    record.revokedAt = now.toISOString();
    record.replacedByTokenId = newTokenId;

    this._tokens.set(newTokenId, newRecord);
    this._tokenHashToId.set(newTokenHash, newTokenId);

    return {
      ok: true,
      newRawToken,
      newTokenId,
      familyId: record.familyId,
      userId: record.userId
    };
  }

  /**
   * Revoke a single token by raw token value (e.g. standard logout)
   * @param {string} rawToken
   * @returns {boolean}
   */
  revokeToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return false;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = this._tokenHashToId.get(tokenHash);
    if (tokenId) {
      const record = this._tokens.get(tokenId);
      if (record) {
        record.revokedAt = new Date().toISOString();
        return true;
      }
    }
    return false;
  }

  /**
   * Revoke an entire family of tokens upon suspected compromise
   * @param {string} familyId
   * @returns {number} Count of tokens revoked
   */
  revokeFamily(familyId) {
    if (!familyId) return 0;
    let count = 0;
    const nowIso = new Date().toISOString();
    for (const record of this._tokens.values()) {
      if (record.familyId === familyId) {
        record.revokedAt = nowIso;
        record.replacedByTokenId = 'FAMILY_REVOKED';
        count++;
      }
    }
    return count;
  }

  /**
   * Revoke all refresh tokens for a user (e.g. global logout / password change)
   * @param {string} userId
   * @returns {number} Count of tokens revoked
   */
  revokeAllForUser(userId) {
    if (!userId) return 0;
    let count = 0;
    const nowIso = new Date().toISOString();
    for (const record of this._tokens.values()) {
      if (record.userId === userId && record.revokedAt === null) {
        record.revokedAt = nowIso;
        count++;
      }
    }
    return count;
  }

  /**
   * Look up token status by raw token
   * @param {string} rawToken
   * @returns {Object|null}
   */
  getTokenRecord(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenId = this._tokenHashToId.get(tokenHash);
    if (!tokenId) return null;
    const rec = this._tokens.get(tokenId);
    return rec ? { ...rec } : null;
  }

  createRefreshToken(userId, options = {}) {
    const ttlSec = options.ttlMs ? Math.floor(options.ttlMs / 1000) : (options.ttlSec || this._defaultTtlSec);
    const oldTtl = this._defaultTtlSec;
    this._defaultTtlSec = ttlSec;
    const res = this.issueToken(userId, options);
    this._defaultTtlSec = oldTtl;
    return {
      rawToken: res.rawToken,
      familyId: res.familyId,
      expiresAt: new Date(res.expiresAt).getTime()
    };
  }

  verifyRefreshToken(rawToken) {
    const rec = this.getTokenRecord(rawToken);
    if (!rec) {
      return { valid: false, reason: 'TOKEN_NOT_FOUND' };
    }
    if (rec.revokedAt) {
      // Check if family was wiped
      let familyWiped = false;
      for (const r of this._tokens.values()) {
        if (r.familyId === rec.familyId && r.revokedAt && r.replacedByTokenId === 'FAMILY_REVOKED') {
          familyWiped = true;
          break;
        }
      }
      if (familyWiped || rec.replacedByTokenId === 'FAMILY_REVOKED') {
        return { valid: false, reason: 'FAMILY_REVOKED', record: rec };
      }
      if (rec.replacedByTokenId) {
        return { valid: false, reason: 'TOKEN_REPLACED', record: rec };
      }
      return { valid: false, reason: 'TOKEN_REVOKED', record: rec };
    }
    if (new Date(rec.expiresAt) <= new Date()) {
      return { valid: false, reason: 'TOKEN_EXPIRED', record: rec };
    }
    return { valid: true, record: rec };
  }

  rotateRefreshToken(rawToken, metadata = {}) {
    const res = this.rotateToken(rawToken, metadata);
    if (!res.ok) return null;
    return {
      rawToken: res.newRawToken,
      familyId: res.familyId,
      userId: res.userId
    };
  }

  getActiveSessionCount(userId) {
    let count = 0;
    const now = new Date();
    for (const r of this._tokens.values()) {
      if (r.userId === userId && r.revokedAt === null && new Date(r.expiresAt) > now) {
        count++;
      }
    }
    return count;
  }

  pruneExpired() {
    let count = 0;
    const now = new Date();
    for (const [id, r] of this._tokens.entries()) {
      if (new Date(r.expiresAt) <= now) {
        this._tokens.delete(id);
        this._tokenHashToId.delete(r.tokenHash);
        count++;
      }
    }
    return count;
  }

  get _store() {
    const map = new Map();
    for (const [hash, id] of this._tokenHashToId.entries()) {
      const rec = this._tokens.get(id);
      if (rec) map.set(hash, rec);
    }
    return map;
  }
}

module.exports = {
  RefreshTokenManager
};
