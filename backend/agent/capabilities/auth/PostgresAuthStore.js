'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: PostgresAuthStore
 * 
 * Production PostgreSQL persistent adapter for identity, sessions, and refresh tokens.
 * Supports connection pooling, row-level locking (FOR UPDATE), parameterized SQL,
 * and graceful auto-detection when PostgreSQL is offline.
 */

const PersistentAuthStore = require('./PersistentAuthStore');
const AuthPersistenceResult = require('./AuthPersistenceResult');

class PostgresAuthStore extends PersistentAuthStore {
  constructor(options = {}) {
    super(options);
    this.connectionString = options.connectionString || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aidost_auth';
    this.pool = options.pool || options.client || null;
    this._ownsPool = !options.pool && !options.client;
    this.initialized = false;
    this.isLiveAvailable = false;
  }

  async init() {
    if (this.initialized) return;

    if (!this.pool) {
      // Check if pg package or custom pool is present
      try {
        const { Pool } = require('pg');
        this.pool = new Pool({ connectionString: this.connectionString, max: 20, idleTimeoutMillis: 30000 });
        const client = await this.pool.connect();
        client.release();
        this.isLiveAvailable = true;
      } catch (err) {
        // PostgreSQL driver or server not available
        this.isLiveAvailable = false;
        if (this.options.requireLive) {
          throw new Error(`POSTGRES_UNAVAILABLE: ${err.message}`);
        }
      }
    } else {
      this.isLiveAvailable = true;
    }

    if (this.isLiveAvailable && this.pool) {
      // Execute migrations
      const fs = require('fs');
      const path = require('path');
      const migrationFile = path.join(__dirname, '../../../migrations/003_persistent_auth_pg.sql');
      if (fs.existsSync(migrationFile)) {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        await this._query(sql);
      }
    }

    this.initialized = true;
  }

  async _query(text, params = []) {
    if (!this.pool) {
      throw new Error('POSTGRES_CONNECTION_NOT_INITIALIZED: Pool is offline or unavailable');
    }
    if (typeof this.pool.query === 'function') {
      return this.pool.query(text, params);
    }
    throw new Error('POSTGRES_INVALID_CLIENT: client does not implement query()');
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
      const sql = `
        INSERT INTO auth_users (id, email, username, password_hash, role, token_version, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          token_version = EXCLUDED.token_version,
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      const res = await this._query(sql, [id, email, username, passwordHash, role, tokenVersion, status, createdAt, updatedAt]);
      const row = res.rows ? res.rows[0] : { id, email, username, role, tokenVersion, status };
      return AuthPersistenceResult.success({ record: row });
    } catch (err) {
      if (err.code === '23505' || /unique/i.test(err.message)) {
        return AuthPersistenceResult.failure(err, 'DUPLICATE_KEY', { field: /email/i.test(err.message) ? 'email' : 'username' });
      }
      return AuthPersistenceResult.failure(err, 'SAVE_USER_FAILED');
    }
  }

  async getUserById(userId) {
    await this.init();
    const res = await this._query('SELECT * FROM auth_users WHERE id = $1', [userId]);
    const row = res.rows && res.rows[0];
    if (!row) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash || row.passwordHash,
        role: row.role,
        tokenVersion: row.token_version || row.tokenVersion,
        status: row.status,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt
      }
    });
  }

  async getUserByEmail(email) {
    await this.init();
    const res = await this._query('SELECT * FROM auth_users WHERE LOWER(email) = LOWER($1)', [email]);
    const row = res.rows && res.rows[0];
    if (!row) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash || row.passwordHash,
        role: row.role,
        tokenVersion: row.token_version || row.tokenVersion,
        status: row.status,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt
      }
    });
  }

  async getUserByUsername(username) {
    await this.init();
    if (!username) return AuthPersistenceResult.notFound('Username required');
    const res = await this._query('SELECT * FROM auth_users WHERE LOWER(username) = LOWER($1)', [username]);
    const row = res.rows && res.rows[0];
    if (!row) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        email: row.email,
        username: row.username,
        passwordHash: row.password_hash || row.passwordHash,
        role: row.role,
        tokenVersion: row.token_version || row.tokenVersion,
        status: row.status,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt
      }
    });
  }

  async incrementUserTokenVersion(userId) {
    await this.init();
    const now = new Date().toISOString();
    const res = await this._query(`
      UPDATE auth_users 
      SET token_version = token_version + 1, updated_at = $1 
      WHERE id = $2 
      RETURNING *
    `, [now, userId]);

    if (!res.rows || res.rows.length === 0) return AuthPersistenceResult.notFound('User not found');
    return AuthPersistenceResult.success({ record: res.rows[0] });
  }

  async saveRefreshToken(tokenRecord) {
    await this.init();
    const now = new Date().toISOString();
    const id = tokenRecord.id;
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
      const sql = `
        INSERT INTO auth_refresh_tokens 
        (id, user_id, token_hash, family_id, replaced_by_token_id, revoked_at, expires_at, created_at, user_agent_hash, ip_subnet)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const res = await this._query(sql, [id, userId, tokenHash, familyId, replacedBy, revokedAt, expiresAt, createdAt, userAgentHash, ipSubnet]);
      return AuthPersistenceResult.success({ record: res.rows ? res.rows[0] : { id, userId, tokenHash, familyId } });
    } catch (err) {
      if (err.code === '23505' || /unique/i.test(err.message)) {
        return AuthPersistenceResult.failure(err, 'DUPLICATE_TOKEN_HASH');
      }
      return AuthPersistenceResult.failure(err, 'SAVE_TOKEN_FAILED');
    }
  }

  async getRefreshTokenByHash(tokenHash) {
    await this.init();
    const res = await this._query('SELECT * FROM auth_refresh_tokens WHERE token_hash = $1', [tokenHash]);
    const row = res.rows && res.rows[0];
    if (!row) return AuthPersistenceResult.notFound('Refresh token not found');
    return AuthPersistenceResult.success({
      record: {
        id: row.id,
        userId: row.user_id || row.userId,
        tokenHash: row.token_hash || row.tokenHash,
        familyId: row.family_id || row.familyId,
        replacedByTokenId: row.replaced_by_token_id || row.replacedByTokenId,
        revokedAt: row.revoked_at || row.revokedAt,
        expiresAt: row.expires_at || row.expiresAt,
        createdAt: row.created_at || row.createdAt,
        userAgentHash: row.user_agent_hash || row.userAgentHash,
        ipSubnet: row.ip_subnet || row.ipSubnet
      }
    });
  }

  /**
   * PostgreSQL transactional token rotation using row locking (FOR UPDATE)
   */
  async rotateRefreshToken(oldTokenHash, newTokenRecord) {
    await this.init();
    const nowIso = new Date().toISOString();

    if (!this.pool) {
      return AuthPersistenceResult.failure('PostgreSQL client offline', 'POSTGRES_OFFLINE');
    }

    // Acquire dedicated client from pool for transaction
    let client = null;
    const isMock = typeof this.pool.connect !== 'function';
    if (isMock) {
      client = this.pool;
    } else {
      client = await this.pool.connect();
    }

    try {
      await client.query('BEGIN');

      const selectSql = 'SELECT * FROM auth_refresh_tokens WHERE token_hash = $1 FOR UPDATE';
      const selectRes = await client.query(selectSql, [oldTokenHash]);
      const existing = selectRes.rows && selectRes.rows[0];

      if (!existing) {
        await client.query('ROLLBACK');
        return AuthPersistenceResult.notFound('Unknown refresh token');
      }

      const existingRevoked = existing.revoked_at || existing.revokedAt;
      const existingFamilyId = existing.family_id || existing.familyId;
      const existingUserId = existing.user_id || existing.userId;
      const existingExpiresAt = existing.expires_at || existing.expiresAt;

      // ── REPLAY ATTACK DETECTION ──────────────────────────────────────────
      if (existingRevoked !== null && existingRevoked !== undefined) {
        // Token was already revoked! Invalidate entire family!
        await client.query(`
          UPDATE auth_refresh_tokens 
          SET revoked_at = $1, replaced_by_token_id = 'FAMILY_REVOKED' 
          WHERE family_id = $2
        `, [nowIso, existingFamilyId]);

        await client.query('COMMIT');
        return AuthPersistenceResult.replayDetected(existingFamilyId, existingUserId);
      }

      // Check expiry
      if (new Date(existingExpiresAt) <= new Date(nowIso)) {
        await client.query('UPDATE auth_refresh_tokens SET revoked_at = $1 WHERE id = $2', [nowIso, existing.id]);
        await client.query('COMMIT');
        return AuthPersistenceResult.expired(existingUserId, existingFamilyId);
      }

      // Mark old token revoked and link to new token
      await client.query(`
        UPDATE auth_refresh_tokens 
        SET revoked_at = $1, replaced_by_token_id = $2 
        WHERE id = $3
      `, [nowIso, newTokenRecord.id, existing.id]);

      // Insert new token
      const newTokenHash = newTokenRecord.tokenHash || newTokenRecord.token_hash;
      const newExpiresAt = newTokenRecord.expiresAt || newTokenRecord.expires_at;
      const userAgentHash = newTokenRecord.userAgentHash || newTokenRecord.user_agent_hash || existing.user_agent_hash;
      const ipSubnet = newTokenRecord.ipSubnet || newTokenRecord.ip_subnet || existing.ip_subnet;

      await client.query(`
        INSERT INTO auth_refresh_tokens 
        (id, user_id, token_hash, family_id, replaced_by_token_id, revoked_at, expires_at, created_at, user_agent_hash, ip_subnet)
        VALUES ($1, $2, $3, $4, NULL, NULL, $5, $6, $7, $8)
      `, [newTokenRecord.id, existingUserId, newTokenHash, existingFamilyId, newExpiresAt, nowIso, userAgentHash, ipSubnet]);

      await client.query('COMMIT');

      return AuthPersistenceResult.success({
        record: {
          id: existing.id,
          userId: existingUserId,
          familyId: existingFamilyId,
          revokedAt: nowIso
        },
        newRecord: {
          id: newTokenRecord.id,
          userId: existingUserId,
          familyId: existingFamilyId,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt
        }
      });
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      return AuthPersistenceResult.failure(err, 'PG_ROTATION_TRANSACTION_FAILED');
    } finally {
      if (!isMock && client && typeof client.release === 'function') {
        client.release();
      }
    }
  }

  async revokeFamily(familyId) {
    await this.init();
    const nowIso = new Date().toISOString();
    const res = await this._query(`
      UPDATE auth_refresh_tokens 
      SET revoked_at = $1, replaced_by_token_id = 'FAMILY_REVOKED' 
      WHERE family_id = $2 AND revoked_at IS NULL
    `, [nowIso, familyId]);
    return res.rowCount || (res.rows ? res.rows.length : 0);
  }

  async revokeAllForUser(userId) {
    await this.init();
    const nowIso = new Date().toISOString();
    const res = await this._query(`
      UPDATE auth_refresh_tokens 
      SET revoked_at = $1 
      WHERE user_id = $2 AND revoked_at IS NULL
    `, [nowIso, userId]);
    return res.rowCount || (res.rows ? res.rows.length : 0);
  }

  async pruneExpiredTokens() {
    await this.init();
    const nowIso = new Date().toISOString();
    const res = await this._query('DELETE FROM auth_refresh_tokens WHERE expires_at < $1', [nowIso]);
    return res.rowCount || 0;
  }

  async close() {
    if (this.pool && this._ownsPool && typeof this.pool.end === 'function') {
      try {
        await this.pool.end();
      } catch (_) {}
      this.pool = null;
    }
    this.initialized = false;
    this.isLiveAvailable = false;
  }
}

PostgresAuthStore.PostgresAuthStore = PostgresAuthStore;
module.exports = PostgresAuthStore;
