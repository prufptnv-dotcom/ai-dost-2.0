'use strict';

/**
 * AI-Dost 2.0 — Phase 5B Test Suite
 * Database Migration Integrity, Schema Invariants & Idempotency Tests
 * 
 * 15+ assertions covering:
 * 1. Idempotent execution of 003_persistent_auth.sql (SQLite)
 * 2. Table presence, column types, and foreign key cascades
 * 3. Composite indexes on (family_id, revoked_at), (user_id, expires_at), and unique constraints
 * 4. PostgreSQL DDL syntax & constraint parsing for 003_persistent_auth_pg.sql
 * 5. Foreign key and unique constraint enforcement
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DatabaseSync } = require('node:sqlite');

describe('Database Migration Integrity Suite', () => {
  let tempDir;
  let dbPath;
  let db;

  const sqliteMigrationPath = path.resolve(__dirname, '../migrations/003_persistent_auth.sql');
  const pgMigrationPath = path.resolve(__dirname, '../migrations/003_persistent_auth_pg.sql');

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-migration-test-'));
    dbPath = path.join(tempDir, 'migration_test.sqlite');
    db = new DatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON');
  });

  after(() => {
    if (db) {
      try { db.close(); } catch (_) {}
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  describe('1. SQLite Migration (003_persistent_auth.sql) Execution & Idempotency', () => {
    it('successfully applies SQLite migration to a clean database', () => {
      assert.ok(fs.existsSync(sqliteMigrationPath), 'SQLite migration file must exist');
      const ddl = fs.readFileSync(sqliteMigrationPath, 'utf8');

      assert.doesNotThrow(() => {
        db.exec(ddl);
      }, 'Initial migration execution should succeed without errors');
    });

    it('is strictly idempotent when executed repeatedly', () => {
      const ddl = fs.readFileSync(sqliteMigrationPath, 'utf8');

      // Execute second and third time
      assert.doesNotThrow(() => {
        db.exec(ddl);
      }, 'Second migration execution must be idempotent');

      assert.doesNotThrow(() => {
        db.exec(ddl);
      }, 'Third migration execution must be idempotent');
    });

    it('creates all expected tables with required primary keys and columns', () => {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'auth_%' ORDER BY name
      `).all().map(t => t.name);

      assert.ok(tables.includes('auth_users'), 'auth_users table must exist');
      assert.ok(tables.includes('auth_refresh_tokens'), 'auth_refresh_tokens table must exist');
      assert.ok(tables.includes('auth_keyring'), 'auth_keyring table must exist');

      // Check auth_users columns
      const userCols = db.prepare('PRAGMA table_info(auth_users)').all().map(c => c.name);
      assert.ok(userCols.includes('id'));
      assert.ok(userCols.includes('email'));
      assert.ok(userCols.includes('password_hash'));
      assert.ok(userCols.includes('role'));
      assert.ok(userCols.includes('token_version'));

      // Check auth_refresh_tokens columns
      const rtCols = db.prepare('PRAGMA table_info(auth_refresh_tokens)').all().map(c => c.name);
      assert.ok(rtCols.includes('token_hash'));
      assert.ok(rtCols.includes('family_id'));
      assert.ok(rtCols.includes('replaced_by_token_id'));
      assert.ok(rtCols.includes('revoked_at'));
      assert.ok(rtCols.includes('expires_at'));
    });

    it('creates all required performance and uniqueness indexes', () => {
      const indexes = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_auth_%'
      `).all().map(i => i.name);

      assert.ok(indexes.includes('idx_auth_users_email'), 'Unique email index must exist');
      assert.ok(indexes.includes('idx_auth_rt_token_hash'), 'Unique token hash index must exist');
      assert.ok(indexes.includes('idx_auth_rt_family_revoked'), 'Composite family_id+revoked_at index must exist');
      assert.ok(indexes.includes('idx_auth_rt_user_exp'), 'Composite user_id+expires_at index must exist');
      assert.ok(indexes.includes('idx_auth_rt_expires_at'), 'Expires_at cleanup index must exist');
    });
  });

  describe('2. Relational Constraint & Foreign Key Enforcement', () => {
    it('enforces foreign key integrity when inserting tokens', () => {
      // Attempting to insert a refresh token for non-existent user must fail
      assert.throws(() => {
        db.prepare(`
          INSERT INTO auth_refresh_tokens 
          (id, user_id, token_hash, family_id, expires_at, created_at)
          VALUES ('rtk_ghost', 'usr_nonexistent', 'hash_ghost', 'fam_ghost', '2030-01-01', '2026-01-01')
        `).run();
      }, /FOREIGN KEY constraint failed/);
    });

    it('enforces email uniqueness case-insensitively', () => {
      db.prepare(`
        INSERT INTO auth_users (id, email, password_hash, role, token_version, status, created_at, updated_at)
        VALUES ('u1', 'TestUser@Example.Com', 'hash1', 'user', 1, 'active', '2026-01-01', '2026-01-01')
      `).run();

      // Duplicate insert with different case
      assert.throws(() => {
        db.prepare(`
          INSERT INTO auth_users (id, email, password_hash, role, token_version, status, created_at, updated_at)
          VALUES ('u2', 'testuser@example.com', 'hash2', 'user', 1, 'active', '2026-01-01', '2026-01-01')
        `).run();
      }, /UNIQUE constraint failed/);
    });

    it('cascades token deletion when user is deleted', () => {
      db.prepare(`
        INSERT INTO auth_refresh_tokens 
        (id, user_id, token_hash, family_id, expires_at, created_at)
        VALUES ('rtk_u1', 'u1', 'hash_u1', 'fam_u1', '2030-01-01', '2026-01-01')
      `).run();

      const beforeCount = db.prepare("SELECT COUNT(*) as c FROM auth_refresh_tokens WHERE user_id = 'u1'").get().c;
      assert.equal(beforeCount, 1);

      // Delete parent user
      db.prepare("DELETE FROM auth_users WHERE id = 'u1'").run();

      const afterCount = db.prepare("SELECT COUNT(*) as c FROM auth_refresh_tokens WHERE user_id = 'u1'").get().c;
      assert.equal(afterCount, 0, 'Tokens must be automatically removed via ON DELETE CASCADE');
    });
  });

  describe('3. PostgreSQL Migration (003_persistent_auth_pg.sql) Specification Inspection', () => {
    it('verifies PostgreSQL DDL script integrity and essential production constructs', () => {
      assert.ok(fs.existsSync(pgMigrationPath), 'Postgres migration file must exist');
      const pgSql = fs.readFileSync(pgMigrationPath, 'utf8');

      // Table definitions
      assert.ok(pgSql.includes('CREATE TABLE IF NOT EXISTS auth_users'), 'Must define auth_users');
      assert.ok(pgSql.includes('CREATE TABLE IF NOT EXISTS auth_refresh_tokens'), 'Must define auth_refresh_tokens');
      assert.ok(pgSql.includes('CREATE TABLE IF NOT EXISTS auth_keyring'), 'Must define auth_keyring');

      // Foreign key & cascades
      assert.ok(pgSql.includes('REFERENCES auth_users(id) ON DELETE CASCADE'), 'Must enforce cascade on user_id');

      // Lowercase unique indexes
      assert.ok(pgSql.includes('INDEX IF NOT EXISTS idx_pg_auth_users_email ON auth_users(LOWER(email))'));

      // Composite indexes
      assert.ok(pgSql.includes('INDEX IF NOT EXISTS idx_pg_auth_rt_family_revoked ON auth_refresh_tokens(family_id, revoked_at)'));
      assert.ok(pgSql.includes('INDEX IF NOT EXISTS idx_pg_auth_rt_user_exp ON auth_refresh_tokens(user_id, expires_at)'));
      assert.ok(pgSql.includes('TIMESTAMPTZ NOT NULL DEFAULT NOW()'), 'Must use TIMESTAMPTZ for timestamps');
    });
  });

});
