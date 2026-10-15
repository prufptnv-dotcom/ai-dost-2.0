'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: Multi-Tenant Migration & Data Integrity Suite
 * 
 * 20+ assertions testing 004_multi_tenant.sql schema idempotency,
 * zero data-loss legacy unscoped data migration, personal tenant auto-provisioning,
 * foreign key cascade safety, and PostgreSQL DDL / RLS inspection.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const {
  SqliteTenantStore,
  TenantMigrationManager
} = require('../agent/capabilities/tenant');

describe('Phase 5C: Multi-Tenant Migration & Data Integrity Suite', () => {
  let tmpDbPath;
  let db;
  let store;
  let migrationManager;

  beforeEach(() => {
    tmpDbPath = path.join(os.tmpdir(), `test-mig-${crypto.randomUUID()}.sqlite`);
    store = new SqliteTenantStore({ dbPath: tmpDbPath });
    store.init();
    db = store.db;
    migrationManager = new TenantMigrationManager(db, store);
  });

  test.afterEach(() => {
    try { store.close(); } catch (_) {}
    try { if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath); } catch (_) {}
  });

  // 1. DDL Schema Idempotency
  test('1. 004_multi_tenant.sql applies idempotently without errors', () => {
    // Re-apply schema twice
    const run1 = migrationManager.applySchema();
    assert.equal(run1.applied, true);

    const run2 = migrationManager.applySchema();
    assert.equal(run2.applied, true);

    // Verify all required tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'tenant%'
    `).all().map(t => t.name);

    assert.ok(tables.includes('tenants'));
    assert.ok(tables.includes('tenant_memberships'));
    assert.ok(tables.includes('tenant_audit_logs'));
    assert.ok(tables.includes('tenant_projects'));
    assert.ok(tables.includes('tenant_files'));
    assert.ok(tables.includes('tenant_chat_sessions'));
  });

  test('2. Composite unique constraints and indexes are established', () => {
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_tenant%'
    `).all().map(i => i.name);

    assert.ok(indexes.includes('idx_tenants_slug'));
    assert.ok(indexes.includes('idx_tenants_owner'));
    assert.ok(indexes.includes('idx_tenants_status'));
    assert.ok(indexes.includes('idx_tenant_audit_tenant_time'));
    assert.ok(indexes.includes('idx_tenant_projects_lookup'));
    assert.ok(indexes.includes('idx_tenant_files_lookup'));
    assert.ok(indexes.includes('idx_tenant_chats_lookup'));
  });

  // 2. Legacy Unscoped Data Migration
  test('3. migrateLegacyData auto-provisions personal tenant for legacy users', async () => {
    // Seed 2 legacy users in auth_users who have NO tenant membership
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO auth_users (id, email, password_hash, role, token_version, status, created_at, updated_at)
      VALUES (?, ?, 'hash', 'user', 1, 'active', ?, ?)
    `).run('legacy-user-1', 'legacy1@example.com', now, now);

    db.prepare(`
      INSERT INTO auth_users (id, email, password_hash, role, token_version, status, created_at, updated_at)
      VALUES (?, ?, 'hash', 'user', 1, 'active', ?, ?)
    `).run('legacy-user-2', 'legacy2@example.com', now, now);

    // Seed unscoped projects (tenant_id is NULL)
    db.prepare(`
      INSERT INTO tenant_projects (id, tenant_id, user_id, name, description, created_at, updated_at)
      VALUES (?, NULL, 'legacy-user-1', 'Legacy App 1', 'Unscoped project', ?, ?)
    `).run('proj-leg-1', now, now);

    db.prepare(`
      INSERT INTO tenant_files (id, tenant_id, project_id, user_id, file_path, size_bytes, created_at, updated_at)
      VALUES (?, NULL, 'proj-leg-1', 'legacy-user-1', 'main.js', 500, ?, ?)
    `).run('file-leg-1', now, now);

    db.prepare(`
      INSERT INTO tenant_chat_sessions (id, tenant_id, user_id, title, created_at, updated_at)
      VALUES (?, NULL, 'legacy-user-2', 'Old Chat', ?, ?)
    `).run('chat-leg-1', now, now);

    // Run migration
    const stats = await migrationManager.migrateLegacyData();

    assert.equal(stats.success, true);
    assert.equal(stats.tenantsCreated, 2);
    assert.equal(stats.membershipsCreated, 2);
    assert.equal(stats.projectsMigrated, 1);
    assert.equal(stats.filesMigrated, 1);
    assert.equal(stats.chatSessionsMigrated, 1);

    // Verify projects now have tenant_id populated
    const proj = db.prepare('SELECT * FROM tenant_projects WHERE id = ?').get('proj-leg-1');
    assert.ok(proj.tenant_id);
    assert.notEqual(proj.tenant_id, '');

    const file = db.prepare('SELECT * FROM tenant_files WHERE id = ?').get('file-leg-1');
    assert.equal(file.tenant_id, proj.tenant_id);

    const chat = db.prepare('SELECT * FROM tenant_chat_sessions WHERE id = ?').get('chat-leg-1');
    assert.ok(chat.tenant_id);
    assert.notEqual(chat.tenant_id, '');
  });

  test('4. migrateLegacyData is idempotent (re-running produces 0 creations)', async () => {
    // 1st run
    await migrationManager.migrateLegacyData();

    // 2nd run
    const secondStats = await migrationManager.migrateLegacyData();
    assert.equal(secondStats.tenantsCreated, 0);
    assert.equal(secondStats.membershipsCreated, 0);
    assert.equal(secondStats.projectsMigrated, 0);
    assert.equal(secondStats.filesMigrated, 0);
    assert.equal(secondStats.chatSessionsMigrated, 0);
  });

  // 3. Foreign Key Cascades & Deletion Safety
  test('5. Tenant deletion cascades and purges memberships, projects, files, and audit logs', async () => {
    const created = await store.createTenant({
      name: 'Purgeable Org',
      slug: 'purgeable-org',
      ownerUserId: 'u-purge'
    });
    const tenantId = created.tenant.id;

    // Add extra member, project, file, chat, audit log
    await store.addMembership(tenantId, 'u-member', 'member');

    const now = new Date().toISOString();
    db.prepare('INSERT INTO tenant_projects (id, tenant_id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('p-purge', tenantId, 'u-purge', 'Project', now, now);

    db.prepare('INSERT INTO tenant_files (id, tenant_id, project_id, user_id, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run('f-purge', tenantId, 'p-purge', 'u-purge', 'test.txt', now, now);

    db.prepare('INSERT INTO tenant_chat_sessions (id, tenant_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('c-purge', tenantId, 'u-purge', 'Chat', now, now);

    // Delete tenant
    db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);

    // Verify cascade
    const mems = db.prepare('SELECT * FROM tenant_memberships WHERE tenant_id = ?').all(tenantId);
    assert.equal(mems.length, 0);

    const projs = db.prepare('SELECT * FROM tenant_projects WHERE tenant_id = ?').all(tenantId);
    assert.equal(projs.length, 0);

    const files = db.prepare('SELECT * FROM tenant_files WHERE tenant_id = ?').all(tenantId);
    assert.equal(files.length, 0);

    const chats = db.prepare('SELECT * FROM tenant_chat_sessions WHERE tenant_id = ?').all(tenantId);
    assert.equal(chats.length, 0);

    const logs = db.prepare('SELECT * FROM tenant_audit_logs WHERE tenant_id = ?').all(tenantId);
    assert.equal(logs.length, 0);

    // Invariant: The user in auth_users remains safe (zero data loss on identity)
    const userStillExists = db.prepare('SELECT * FROM auth_users WHERE id = ?').get('u-purge');
    assert.ok(userStillExists);
  });

  // 4. PostgreSQL DDL & RLS Verification
  test('6. 004_multi_tenant_pg.sql contains valid PostgreSQL DDL and RLS statements', () => {
    const pgSqlPath = path.resolve(__dirname, '../migrations/004_multi_tenant_pg.sql');
    assert.equal(fs.existsSync(pgSqlPath), true);

    const pgSql = fs.readFileSync(pgSqlPath, 'utf8');

    // Verify tables
    assert.match(pgSql, /CREATE TABLE IF NOT EXISTS tenants/i);
    assert.match(pgSql, /CREATE TABLE IF NOT EXISTS tenant_memberships/i);
    assert.match(pgSql, /CREATE TABLE IF NOT EXISTS tenant_audit_logs/i);
    assert.match(pgSql, /CREATE TABLE IF NOT EXISTS tenant_projects/i);
    assert.match(pgSql, /CREATE TABLE IF NOT EXISTS tenant_files/i);
    assert.match(pgSql, /CREATE TABLE IF NOT EXISTS tenant_chat_sessions/i);

    // Verify Row-Level Security enablement
    assert.match(pgSql, /ALTER TABLE tenants ENABLE ROW LEVEL SECURITY/i);
    assert.match(pgSql, /ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY/i);
    assert.match(pgSql, /ALTER TABLE tenant_projects ENABLE ROW LEVEL SECURITY/i);
    assert.match(pgSql, /ALTER TABLE tenant_files ENABLE ROW LEVEL SECURITY/i);
    assert.match(pgSql, /ALTER TABLE tenant_chat_sessions ENABLE ROW LEVEL SECURITY/i);
    assert.match(pgSql, /ALTER TABLE tenant_audit_logs ENABLE ROW LEVEL SECURITY/i);

    // Verify TIMESTAMPTZ and JSONB types
    assert.match(pgSql, /TIMESTAMPTZ/i);
    assert.match(pgSql, /JSONB/i);
  });
});
