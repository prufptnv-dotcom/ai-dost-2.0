'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: SqliteAuthStore
 * 
 * Production SQLite persistent adapter for identity, sessions, and refresh tokens.
 * Uses native node:sqlite (DatabaseSync) with WAL mode, busy timeout, and
 * transactional rotation inside BEGIN IMMEDIATE.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PersistentAuthStore = require('./PersistentAuthStore');
const AuthPersistenceResult = require('./AuthPersistenceResult');

// Detect native node:sqlite DatabaseSync
let DatabaseSync = null;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch {
  // Graceful fallback for older runtimes if needed
  DatabaseSync = null;
}

class SqliteAuthStore extends PersistentAuthStore {
  constructor(options = {}) {
    super(options);
    this.dbPath = options.dbPath || path.join(__dirname, '../../../data/auth.sqlite');
    this.db = options.db || null;
    this._ownsDb = !options.db;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (!this.db) {
      if (!DatabaseSync) {
        throw new Error('SQLITE_UNAVAILABLE: node:sqlite DatabaseSync is not available in this Node runtime');
      }
      const dir = path.dirname(this.dbPath);
      if (this.dbPath !== ':memory:' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new DatabaseSync(this.dbPath);
    }

    // Configure concurrency pragmas
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec('PRAGMA foreign_keys = ON;');

    // Run migrations
    const migrationFile = path.join(__dirname, '../../../migrations/003_persistent_auth.sql');
    if (fs.existsSync(migrationFile)) {
      const sql = fs.readFileSync(migrationFile, 'utf8');
      this.db.exec(sql);
    } else {
      // Inlined fallback if migration file path altered
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL COLLATE NOCASE,
          username TEXT COLLATE NOCASE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          token_version INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username) WHERE username IS NOT NULL;

        CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          family_id TEXT NOT NULL,
          replaced_by_token_id TEXT,
          revoked_at TEXT,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          user_agent_hash TEXT,
          ip_subnet TEXT,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_rt_token_hash ON auth_refresh_tokens(token_hash);
        CREATE INDEX IF NOT EXISTS idx_auth_rt_family_revoked ON auth_refresh_tokens(family_id, revoked_at);
        CREATE INDEX IF NOT EXISTS idx_auth_rt_user_exp ON auth_refresh_tokens(user_id, expires_at);
        CREATE INDEX IF NOT EXISTS idx_auth_rt_expires_at ON auth_refresh_tokens(expires_at);

        CREATE TABLE IF NOT EXISTS auth_keyring (
          kid TEXT PRIMARY KEY,
          algorithm TEXT NOT NULL DEFAULT 'HS256',
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );
      `);
    }

    this.initialized = true;
  }

  async saveUser(userRecord) {
    await this.init();
    const now = new Date().toISOString();
    const id = userRecord.id;
    const email = userRecord.email;
    const username = userRecord.username || null;
    const passwordHash = userRecord.passwordHash || userRecord.password_hash;
    const role = userRecord.role || 'user';
    const tokenVersion = userRecord.tokenVersion || userRecord.token_version || 1;
    const status = userRecord.status || 'active';
    const createdAt = userRecord.createdAt || userRecord.created_at || now;
    const updatedAt = now;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO auth_users (id, email, username, password_hash, role, token_version, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          username = excluded.username,
          password_hash = excluded.password_hash,
          role = excluded.role,
          token_version = excluded.token_version,
          status = excluded.status,
          updated_at = excluded.updated_at
      `);
      stmt.run(id, email, username, passwordHash, role, tokenVersion, status, createdAt, updatedAt);
      return AuthPersistenceResult.success({ record: { id, email, username, role, tokenVersion, status } });
    } catch (err) {
      if (err.message && /UNIQUE constraint failed/i.test(err.message)) {
        return AuthPersistenceResult.failure(err, 'DUPLICATE_KEY', { field: err.message.includes('email') ? 'email' : 'username' });
      }
      return AuthPersistenceResult.failure(err, 'SAVE_USER_FAILED');
    }
  }

  async getUserById(userId) {
    await this.init();
    const row = this.db.prepare('SELECT * FROM auth_users WHERE id = ?').get(userId);
    if (!row) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash,
        password_hash: row.password_hash,
        role: row.role,
        tokenVersion: row.token_version,
        token_version: row.token_version,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  }

  async getUserByEmail(email) {
    await this.init();
    const row = this.db.prepare('SELECT * FROM auth_users WHERE email = ? COLLATE NOCASE').get(email);
    if (!row) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash,
        password_hash: row.password_hash,
        role: row.role,
        tokenVersion: row.token_version,
        token_version: row.token_version,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  }

  async getUserByUsername(username) {
    await this.init();
    if (!username) return AuthPersistenceResult.notFound('Username required');
    const row = this.db.prepare('SELECT * FROM auth_users WHERE username = ? COLLATE NOCASE').get(username);
    if (!row) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash,
        password_hash: row.password_hash,
        role: row.role,
        tokenVersion: row.token_version,
        token_version: row.token_version,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  }

  async incrementTokenVersion(userId) {
    return this.incrementUserTokenVersion(userId);
  }

  async incrementUserTokenVersion(userId) {
    await this.init();
    const now = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE auth_users 
      SET token_version = token_version + 1, updated_at = ? 
      WHERE id = ?
    `).run(now, userId);

    if (info.changes === 0) return AuthPersistenceResult.notFound('User not found');
    const updated = await this.getUserById(userId);
    return AuthPersistenceResult.success({
      record: updated.record,
      tokenVersion: updated.record.tokenVersion,
      token_version: updated.record.tokenVersion
    });
  }

  async saveRefreshToken(tokenRecord) {
    await this.init();
    const now = new Date().toISOString();
    const id = tokenRecord.id || ('rtk_' + crypto.randomUUID());
    const userId = tokenRecord.userId || tokenRecord.user_id;
    const tokenHash = tokenRecord.tokenHash || tokenRecord.token_hash;
    const familyId = tokenRecord.familyId || tokenRecord.family_id;
    const replacedBy = tokenRecord.replacedByTokenId || tokenRecord.replaced_by_token_id || null;
    const revokedAt = tokenRecord.revokedAt || tokenRecord.revoked_at || null;
    const expiresAt = tokenRecord.expiresAt || tokenRecord.expires_at;
    const createdAt = tokenRecord.createdAt || tokenRecord.created_at || now;
    const userAgentHash = tokenRecord.userAgentHash || tokenRecord.user_agent_hash || null;
    const ipSubnet = tokenRecord.ipSubnet || tokenRecord.ip_subnet || null;

    try {
      this.db.prepare(`
        INSERT INTO auth_refresh_tokens 
        (id, user_id, token_hash, family_id, replaced_by_token_id, revoked_at, expires_at, created_at, user_agent_hash, ip_subnet)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, tokenHash, familyId, replacedBy, revokedAt, expiresAt, createdAt, userAgentHash, ipSubnet);

      return AuthPersistenceResult.success({
        record: {
          id,
          userId,
          user_id: userId,
          tokenHash,
          token_hash: tokenHash,
          familyId,
          family_id: familyId,
          expiresAt,
          expires_at: expiresAt,
          revokedAt,
          isRevoked: !!revokedAt,
          is_revoked: revokedAt ? 1 : 0
        }
      });
    } catch (err) {
      if (err.message && /UNIQUE constraint failed/i.test(err.message)) {
        return AuthPersistenceResult.failure(err, 'DUPLICATE_TOKEN_HASH');
      }
      return AuthPersistenceResult.failure(err, 'SAVE_TOKEN_FAILED');
    }
  }

  async getRefreshToken(tokenHash) {
    return this.getRefreshTokenByHash(tokenHash);
  }

  async getRefreshTokenByHash(tokenHash) {
    await this.init();
    const row = this.db.prepare('SELECT * FROM auth_refresh_tokens WHERE token_hash = ?').get(tokenHash);
    if (!row) return AuthPersistenceResult.notFound('Refresh token not found');
    const isRevoked = !!row.revoked_at;
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        userId: row.user_id,
        user_id: row.user_id,
        tokenHash: row.token_hash,
        token_hash: row.token_hash,
        familyId: row.family_id,
        family_id: row.family_id,
        replacedByTokenId: row.replaced_by_token_id,
        replaced_by_token_id: row.replaced_by_token_id,
        replaced_by_hash: row.replaced_by_token_id,
        revokedAt: row.revoked_at,
        isRevoked,
        is_revoked: isRevoked ? 1 : 0,
        expiresAt: row.expires_at,
        expires_at: row.expires_at,
        createdAt: row.created_at,
        created_at: row.created_at,
        userAgentHash: row.user_agent_hash,
        ipSubnet: row.ip_subnet
      }
    });
  }

  /**
   * Atomic token rotation inside BEGIN IMMEDIATE transaction.
   */
  async rotateRefreshToken(oldTokenHash, newTokenRecord) {
    await this.init();
    const nowIso = new Date().toISOString();

    try {
      this.db.exec('BEGIN IMMEDIATE');

      const existing = this.db.prepare('SELECT * FROM auth_refresh_tokens WHERE token_hash = ?').get(oldTokenHash);
      if (!existing) {
        this.db.exec('ROLLBACK');
        return AuthPersistenceResult.notFound('Unknown refresh token');
      }

      // ── REPLAY ATTACK DETECTION ──────────────────────────────────────────
      if (existing.revoked_at !== null) {
        // Token was already revoked! Invalidate ENTIRE family lineage!
        this.db.prepare(`
          UPDATE auth_refresh_tokens 
          SET revoked_at = ?, replaced_by_token_id = 'FAMILY_REVOKED' 
          WHERE family_id = ?
        `).run(nowIso, existing.family_id);

        this.db.exec('COMMIT');
        return AuthPersistenceResult.replayDetected(existing.family_id, existing.user_id);
      }

      // Check expiry
      if (new Date(existing.expires_at) <= new Date(nowIso)) {
        this.db.prepare('UPDATE auth_refresh_tokens SET revoked_at = ? WHERE id = ?').run(nowIso, existing.id);
        this.db.exec('COMMIT');
        return AuthPersistenceResult.expired(existing.user_id, existing.family_id);
      }

      // Mark old token revoked and link to new token
      const newId = newTokenRecord.id || ('rtk_' + crypto.randomUUID());
      const newUserId = newTokenRecord.userId || newTokenRecord.user_id || existing.user_id;
      const newFamilyId = newTokenRecord.familyId || newTokenRecord.family_id || existing.family_id;
      const newTokenHash = newTokenRecord.tokenHash || newTokenRecord.token_hash;
      const newExpiresAt = newTokenRecord.expiresAt || newTokenRecord.expires_at || existing.expires_at;
      const userAgentHash = newTokenRecord.userAgentHash || newTokenRecord.user_agent_hash || existing.user_agent_hash || null;
      const ipSubnet = newTokenRecord.ipSubnet || newTokenRecord.ip_subnet || existing.ip_subnet || null;

      // Mark old token revoked and link to new token
      this.db.prepare(`
        UPDATE auth_refresh_tokens 
        SET revoked_at = ?, replaced_by_token_id = ? 
        WHERE id = ?
      `).run(nowIso, newId, existing.id);

      this.db.prepare(`
        INSERT INTO auth_refresh_tokens 
        (id, user_id, token_hash, family_id, replaced_by_token_id, revoked_at, expires_at, created_at, user_agent_hash, ip_subnet)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?)
      `).run(newId, newUserId, newTokenHash, newFamilyId, newExpiresAt, nowIso, userAgentHash, ipSubnet);

      this.db.exec('COMMIT');

      return AuthPersistenceResult.success({
        record: {
          id: existing.id,
          userId: existing.user_id,
          user_id: existing.user_id,
          familyId: existing.family_id,
          family_id: existing.family_id,
          revokedAt: nowIso,
          replaced_by_hash: newTokenHash
        },
        newRecord: {
          id: newId,
          userId: newUserId,
          user_id: newUserId,
          familyId: newFamilyId,
          family_id: newFamilyId,
          tokenHash: newTokenHash,
          token_hash: newTokenHash,
          expiresAt: newExpiresAt,
          expires_at: newExpiresAt
        }
      });
    } catch (err) {
      try { this.db.exec('ROLLBACK'); } catch (_) {}
      return AuthPersistenceResult.failure(err, 'ROTATION_TRANSACTION_FAILED');
    }
  }

  async revokeFamily(familyId) {
    await this.init();
    const nowIso = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE auth_refresh_tokens 
      SET revoked_at = ?, replaced_by_token_id = 'FAMILY_REVOKED' 
      WHERE family_id = ? AND revoked_at IS NULL
    `).run(nowIso, familyId);
    return info.changes;
  }

  async revokeAllForUser(userId) {
    await this.init();
    const nowIso = new Date().toISOString();
    const info = this.db.prepare(`
      UPDATE auth_refresh_tokens 
      SET revoked_at = ? 
      WHERE user_id = ? AND revoked_at IS NULL
    `).run(nowIso, userId);
    return info.changes;
  }

  async pruneExpiredTokens() {
    await this.init();
    const nowIso = new Date().toISOString();
    const info = this.db.prepare('DELETE FROM auth_refresh_tokens WHERE expires_at < ?').run(nowIso);
    return info.changes;
  }

  async close() {
    if (this.db && this._ownsDb) {
      try {
        this.db.close();
      } catch (_) {}
      this.db = null;
    }
    this.initialized = false;
  }
}

SqliteAuthStore.SqliteAuthStore = SqliteAuthStore;
module.exports = SqliteAuthStore;
