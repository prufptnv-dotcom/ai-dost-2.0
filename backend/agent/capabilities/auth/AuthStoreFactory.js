'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: AuthStoreFactory
 * 
 * Factory that instantiates and initializes the configured PersistentAuthStore.
 * Supports 'sqlite' (default for local/single-node), 'postgres' (for multi-node/distributed),
 * and 'memory' (for isolated testing).
 */

const SqliteAuthStore = require('./SqliteAuthStore');
const PostgresAuthStore = require('./PostgresAuthStore');
const PersistentAuthStore = require('./PersistentAuthStore');
const AuthPersistenceResult = require('./AuthPersistenceResult');

class MemoryAuthStore extends PersistentAuthStore {
  constructor(options = {}) {
    super(options);
    this.users = new Map();
    this.tokens = new Map(); // tokenHash -> record
    this.initialized = false;
  }

  async init() {
    this.initialized = true;
  }

  async saveUser(userRecord) {
    const emailLower = userRecord.email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.id !== userRecord.id && u.email.toLowerCase() === emailLower) {
        return AuthPersistenceResult.failure('Email already registered', 'DUPLICATE_KEY', { field: 'email' });
      }
    }
    this.users.set(userRecord.id, {
      ...userRecord,
      tokenVersion: userRecord.tokenVersion || 1,
      status: userRecord.status || 'active'
    });
    return AuthPersistenceResult.success({ record: this.users.get(userRecord.id) });
  }

  async getUserById(userId) {
    const user = this.users.get(userId);
    if (!user) return AuthPersistenceResult.notFound();
    return AuthPersistenceResult.success({ record: { ...user } });
  }

  async getUserByEmail(email) {
    const emailLower = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === emailLower) {
        return AuthPersistenceResult.success({ record: { ...u } });
      }
    }
    return AuthPersistenceResult.notFound();
  }

  async getUserByUsername(username) {
    if (!username) return AuthPersistenceResult.notFound();
    const unLower = username.toLowerCase();
    for (const u of this.users.values()) {
      if (u.username && u.username.toLowerCase() === unLower) {
        return AuthPersistenceResult.success({ record: { ...u } });
      }
    }
    return AuthPersistenceResult.notFound();
  }

  async incrementUserTokenVersion(userId) {
    const u = this.users.get(userId);
    if (!u) return AuthPersistenceResult.notFound();
    u.tokenVersion = (u.tokenVersion || 1) + 1;
    return AuthPersistenceResult.success({ record: { ...u } });
  }

  async saveRefreshToken(tokenRecord) {
    const hash = tokenRecord.tokenHash;
    if (this.tokens.has(hash)) {
      return AuthPersistenceResult.failure('Duplicate token hash', 'DUPLICATE_TOKEN_HASH');
    }
    this.tokens.set(hash, { ...tokenRecord });
    return AuthPersistenceResult.success({ record: { ...tokenRecord } });
  }

  async getRefreshTokenByHash(tokenHash) {
    const rec = this.tokens.get(tokenHash);
    if (!rec) return AuthPersistenceResult.notFound();
    return AuthPersistenceResult.success({ record: { ...rec } });
  }

  async rotateRefreshToken(oldTokenHash, newTokenRecord) {
    const existing = this.tokens.get(oldTokenHash);
    if (!existing) return AuthPersistenceResult.notFound('Unknown refresh token');

    const nowIso = new Date().toISOString();
    if (existing.revokedAt) {
      // Replay attack!
      await this.revokeFamily(existing.familyId);
      return AuthPersistenceResult.replayDetected(existing.familyId, existing.userId);
    }

    if (new Date(existing.expiresAt) <= new Date(nowIso)) {
      existing.revokedAt = nowIso;
      return AuthPersistenceResult.expired(existing.userId, existing.familyId);
    }

    existing.revokedAt = nowIso;
    existing.replacedByTokenId = newTokenRecord.id;

    const newRec = {
      ...newTokenRecord,
      userId: existing.userId,
      familyId: existing.familyId,
      createdAt: nowIso
    };
    this.tokens.set(newTokenRecord.tokenHash, newRec);

    return AuthPersistenceResult.success({
      record: { ...existing },
      newRecord: { ...newRec }
    });
  }

  async revokeFamily(familyId) {
    let count = 0;
    const nowIso = new Date().toISOString();
    for (const r of this.tokens.values()) {
      if (r.familyId === familyId && !r.revokedAt) {
        r.revokedAt = nowIso;
        r.replacedByTokenId = 'FAMILY_REVOKED';
        count++;
      }
    }
    return count;
  }

  async revokeAllForUser(userId) {
    let count = 0;
    const nowIso = new Date().toISOString();
    for (const r of this.tokens.values()) {
      if (r.userId === userId && !r.revokedAt) {
        r.revokedAt = nowIso;
        count++;
      }
    }
    return count;
  }

  async pruneExpiredTokens() {
    let count = 0;
    const now = new Date();
    for (const [hash, r] of this.tokens.entries()) {
      if (new Date(r.expiresAt) < now) {
        this.tokens.delete(hash);
        count++;
      }
    }
    return count;
  }

  async close() {
    this.users.clear();
    this.tokens.clear();
    this.initialized = false;
  }
}

class AuthStoreFactory {
  /**
   * Create an auth store instance based on type or environment.
   * @param {string} [type] 'sqlite' | 'postgres' | 'memory'
   * @param {Object} [options]
   * @returns {PersistentAuthStore}
   */
  static create(type, options = {}) {
    const resolvedType = (type || process.env.AUTH_STORE_TYPE || 'sqlite').toLowerCase();

    switch (resolvedType) {
      case 'sqlite':
        return new SqliteAuthStore(options);
      case 'postgres':
      case 'postgresql':
        return new PostgresAuthStore(options);
      case 'memory':
      case 'in-memory':
        return new MemoryAuthStore(options);
      default:
        throw new Error(`AUTH_STORE_TYPE_INVALID: Unsupported store type "${resolvedType}". Must be sqlite, postgres, or memory`);
    }
  }
}

module.exports = {
  AuthStoreFactory,
  MemoryAuthStore,
  SqliteAuthStore,
  PostgresAuthStore
};
