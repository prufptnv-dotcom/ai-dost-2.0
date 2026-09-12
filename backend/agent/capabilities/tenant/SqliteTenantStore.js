'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: SqliteTenantStore
 * 
 * Production SQLite concrete implementation of TenantStore.
 * Enforces atomic transactions, WAL journal mode, busy_timeout=5000,
 * strict unique constraints, and the last-owner protection invariant.
 */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TenantStore = require('./TenantStore');
const TenantResult = require('./TenantResult');
const { TenantValidator, TENANT_ROLES, TENANT_STATUSES } = require('./TenantValidator');

class SqliteTenantStore extends TenantStore {
  /**
   * @param {Object} [options]
   * @param {string} [options.dbPath]
   * @param {DatabaseSync} [options.db]
   * @param {number} [options.busyTimeoutMs=5000]
   */
  constructor(options = {}) {
    super();
    this.dbPath = options.dbPath || null;
    this.db = options.db || null;
    this.busyTimeoutMs = options.busyTimeoutMs || 5000;
    this.initialized = false;
    this._ownsDb = !options.db;
  }

  async init() {
    if (this.initialized) return;

    if (!this.db) {
      if (!this.dbPath) {
        const defaultDir = path.resolve(__dirname, '../../../data');
        if (!fs.existsSync(defaultDir)) {
          fs.mkdirSync(defaultDir, { recursive: true });
        }
        this.dbPath = path.join(defaultDir, 'app.db');
      }
      this.db = new DatabaseSync(this.dbPath);
    }

    // Configure SQLite invariants
    try {
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec('PRAGMA foreign_keys = ON');
      this.db.exec(`PRAGMA busy_timeout = ${this.busyTimeoutMs}`);
    } catch (_) {}

    // Apply migrations if tables don't exist
    this._ensureSchema();
    this.initialized = true;
  }

  _ensureSchema() {
    // 1. Ensure auth_users exists first for foreign key integrity
    const authMigrationFile = path.resolve(__dirname, '../../../migrations/003_persistent_auth.sql');
    if (fs.existsSync(authMigrationFile)) {
      try {
        const authSql = fs.readFileSync(authMigrationFile, 'utf8');
        this.db.exec(authSql);
      } catch (_) {}
    } else {
      try {
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
        `);
      } catch (_) {}
    }

    // 2. Apply multi-tenant schema
    const migrationFile = path.resolve(__dirname, '../../../migrations/004_multi_tenant.sql');
    if (fs.existsSync(migrationFile)) {
      const sql = fs.readFileSync(migrationFile, 'utf8');
      this.db.exec(sql);
    }
  }

  _ensureUser(userId) {
    if (!userId) return;
    try {
      const now = new Date().toISOString();
      this.db.prepare(`
        INSERT OR IGNORE INTO auth_users (id, email, password_hash, role, token_version, status, created_at, updated_at)
        VALUES (?, ?, 'placeholder_scrypt_hash', 'user', 1, 'active', ?, ?)
      `).run(userId, `${userId}@example.local`, now, now);
    } catch (_) {}
  }

  /**
   * Atomically create a tenant and assign the creator as the first owner.
   */
  async createTenant(tenantData, ownerUserId) {
    await this.init();
    const effectiveOwnerId = ownerUserId || tenantData.ownerUserId || tenantData.ownerId;

    const nameValidation = TenantValidator.validateName(tenantData.name);
    if (!nameValidation.valid) {
      return TenantResult.failure(nameValidation.error, nameValidation.code);
    }

    const slugValidation = TenantValidator.validateSlug(tenantData.slug || tenantData.name);
    if (!slugValidation.valid) {
      return TenantResult.failure(slugValidation.error, slugValidation.code);
    }

    if (!effectiveOwnerId) {
      return TenantResult.failure('Owner user ID is required', 'OWNER_ID_REQUIRED');
    }

    this._ensureUser(effectiveOwnerId);

    const now = new Date().toISOString();
    const tenantId = tenantData.id || `ten_${crypto.randomUUID().slice(0, 12)}`;
    const membershipId = `mem_${crypto.randomUUID().slice(0, 12)}`;
    const settingsStr = JSON.stringify(tenantData.settings || {});
    const maxUsers = tenantData.maxUsers || 10;
    const maxProjects = tenantData.maxProjects || 50;
    const maxConcurrentJobs = tenantData.maxConcurrentJobs || 5;
    const maxStorageBytes = tenantData.maxStorageBytes || 524288000;
    const maxConcurrentSandboxes = tenantData.maxConcurrentSandboxes || 2;

    try {
      this.db.exec('BEGIN IMMEDIATE');

      // 1. Insert Tenant
      this.db.prepare(`
        INSERT INTO tenants 
        (id, name, slug, status, owner_id, max_users, max_projects, max_concurrent_jobs, max_storage_bytes, max_concurrent_sandboxes, settings, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenantId,
        nameValidation.name,
        slugValidation.slug,
        effectiveOwnerId,
        maxUsers,
        maxProjects,
        maxConcurrentJobs,
        maxStorageBytes,
        maxConcurrentSandboxes,
        settingsStr,
        now,
        now
      );

      // 2. Insert Initial Owner Membership
      this.db.prepare(`
        INSERT INTO tenant_memberships 
        (id, tenant_id, user_id, role, status, joined_at, updated_at)
        VALUES (?, ?, ?, 'owner', 'active', ?, ?)
      `).run(membershipId, tenantId, effectiveOwnerId, now, now);

      // 3. Log Audit Record
      const auditId = `aud_${crypto.randomUUID().slice(0, 12)}`;
      this.db.prepare(`
        INSERT INTO tenant_audit_logs 
        (id, tenant_id, user_id, action, resource_type, resource_id, status, details, created_at)
        VALUES (?, ?, ?, 'TENANT_CREATED', 'tenant', ?, 'SUCCESS', ?, ?)
      `).run(auditId, tenantId, effectiveOwnerId, tenantId, JSON.stringify({ slug: slugValidation.slug }), now);

      this.db.exec('COMMIT');

      return TenantResult.success({
        tenant: {
          id: tenantId,
          name: nameValidation.name,
          slug: slugValidation.slug,
          status: 'active',
          ownerId: effectiveOwnerId,
          maxUsers,
          maxProjects,
          maxConcurrentJobs,
          maxStorageBytes,
          maxConcurrentSandboxes,
          settings: tenantData.settings || {},
          createdAt: now,
          updatedAt: now
        },
        membership: {
          id: membershipId,
          tenantId,
          userId: effectiveOwnerId,
          role: 'owner',
          status: 'active',
          joinedAt: now
        }
      });
    } catch (err) {
      try { this.db.exec('ROLLBACK'); } catch (_) {}

      if (err.message && /UNIQUE constraint failed.*(?:tenants\.slug|idx_tenants_slug)/i.test(err.message)) {
        return TenantResult.failure(`Slug "${slugValidation.slug}" is already in use by another tenant`, 'TENANT_ALREADY_EXISTS');
      }
      return TenantResult.failure(err.message, 'TENANT_CREATION_FAILED');
    }
  }

  async getTenantById(tenantId) {
    await this.init();
    if (!tenantId) return TenantResult.notFound('Tenant ID required');

    const row = this.db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (!row) return TenantResult.notFound(`Tenant "${tenantId}" not found`);

    let settings = {};
    try { settings = JSON.parse(row.settings || '{}'); } catch (_) {}

    return TenantResult.success({
      tenant: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        ownerId: row.owner_id,
        maxUsers: row.max_users,
        maxProjects: row.max_projects,
        maxStorageBytes: row.max_storage_bytes !== undefined ? row.max_storage_bytes : 524288000,
        maxConcurrentSandboxes: row.max_concurrent_sandboxes !== undefined ? row.max_concurrent_sandboxes : 2,
        maxConcurrentJobs: row.max_concurrent_jobs,
        settings,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  }

  async findTenantById(tenantId) {
    const res = await this.getTenantById(tenantId);
    return res.ok ? res.tenant : null;
  }

  async getTenantBySlug(slug) {
    await this.init();
    if (!slug) return TenantResult.notFound('Slug required');

    const cleanSlug = TenantValidator.normalizeSlug(slug);
    const row = this.db.prepare('SELECT * FROM tenants WHERE slug = ? COLLATE NOCASE').get(cleanSlug);
    if (!row) return TenantResult.notFound(`Tenant with slug "${slug}" not found`);

    let settings = {};
    try { settings = JSON.parse(row.settings || '{}'); } catch (_) {}

    return TenantResult.success({
      tenant: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        ownerId: row.owner_id,
        maxUsers: row.max_users,
        maxProjects: row.max_projects,
        maxStorageBytes: row.max_storage_bytes !== undefined ? row.max_storage_bytes : 524288000,
        maxConcurrentSandboxes: row.max_concurrent_sandboxes !== undefined ? row.max_concurrent_sandboxes : 2,
        maxConcurrentJobs: row.max_concurrent_jobs,
        settings,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  }

  async findTenantBySlug(slug) {
    const res = await this.getTenantBySlug(slug);
    return res.ok ? res.tenant : null;
  }

  async updateTenant(tenantId, updates = {}) {
    await this.init();
    const existing = await this.getTenantById(tenantId);
    if (!existing.ok) return existing;

    const now = new Date().toISOString();
    const fields = [];
    const values = [];

    if (updates.name) {
      const v = TenantValidator.validateName(updates.name);
      if (!v.valid) return TenantResult.failure(v.error, v.code);
      fields.push('name = ?');
      values.push(v.name);
    }

    if (updates.status) {
      const v = TenantValidator.validateStatus(updates.status);
      if (!v.valid) return TenantResult.failure(v.error, v.code);
      fields.push('status = ?');
      values.push(v.status);
    }

    if (updates.settings) {
      fields.push('settings = ?');
      values.push(JSON.stringify(updates.settings));
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(tenantId);

    try {
      this.db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      return this.getTenantById(tenantId);
    } catch (err) {
      return TenantResult.failure(err.message, 'UPDATE_TENANT_FAILED');
    }
  }

  async updateTenantStatus(tenantId, status) {
    return this.updateTenant(tenantId, { status });
  }

  async addMembership(tenantId, userId, role = 'member', status = 'active') {
    await this.init();

    const roleValidation = TenantValidator.validateRole(role);
    if (!roleValidation.valid) return TenantResult.failure(roleValidation.error, roleValidation.code);

    this._ensureUser(userId);

    const membershipId = `mem_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();

    try {
      this.db.prepare(`
        INSERT INTO tenant_memberships 
        (id, tenant_id, user_id, role, status, joined_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(membershipId, tenantId, userId, roleValidation.role, status, now, now);

      return TenantResult.success({
        membership: {
          id: membershipId,
          tenantId,
          userId,
          role: roleValidation.role,
          status,
          joinedAt: now
        }
      });
    } catch (err) {
      if (err.message && /UNIQUE constraint failed/i.test(err.message)) {
        return TenantResult.failure('User is already a member of this tenant', 'MEMBERSHIP_ALREADY_EXISTS');
      }
      return TenantResult.failure(err.message, 'ADD_MEMBERSHIP_FAILED');
    }
  }

  async getActiveOwnerCount(tenantId) {
    await this.init();
    const row = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM tenant_memberships 
      WHERE tenant_id = ? AND role = 'owner' AND status = 'active'
    `).get(tenantId);
    return row ? Number(row.count) : 0;
  }

  async updateMembershipRole(tenantId, userId, newRole, requestingUserId = null) {
    await this.init();

    const roleValidation = TenantValidator.validateRole(newRole);
    if (!roleValidation.valid) return TenantResult.failure(roleValidation.error, roleValidation.code);

    const mem = await this.getMembership(tenantId, userId);
    if (!mem) return TenantResult.notFound('Membership not found');

    const currentRole = mem.role;

    // ── LAST-OWNER PROTECTION ──────────────────────────────────────────────
    if (currentRole === 'owner' && roleValidation.role !== 'owner') {
      const activeOwners = await this.getActiveOwnerCount(tenantId);
      if (activeOwners <= 1) {
        return TenantResult.lastOwnerViolation();
      }
    }

    const now = new Date().toISOString();

    try {
      this.db.prepare(`
        UPDATE tenant_memberships 
        SET role = ?, updated_at = ? 
        WHERE tenant_id = ? AND user_id = ?
      `).run(roleValidation.role, now, tenantId, userId);

      return TenantResult.success({
        membership: {
          ...mem,
          role: roleValidation.role,
          updatedAt: now
        }
      });
    } catch (err) {
      return TenantResult.failure(err.message, 'UPDATE_MEMBERSHIP_FAILED');
    }
  }

  async updateMemberRole(tenantId, userId, newRole, requestingUserId = null) {
    return this.updateMembershipRole(tenantId, userId, newRole, requestingUserId);
  }

  async removeMembership(tenantId, userId, requestingUserId = null) {
    await this.init();

    const mem = await this.getMembership(tenantId, userId);
    if (!mem) return TenantResult.notFound('Membership not found');

    // ── LAST-OWNER PROTECTION ──────────────────────────────────────────────
    if (mem.role === 'owner' && mem.status === 'active') {
      const activeOwners = await this.getActiveOwnerCount(tenantId);
      if (activeOwners <= 1) {
        return TenantResult.lastOwnerViolation();
      }
    }

    try {
      const info = this.db.prepare(`
        DELETE FROM tenant_memberships 
        WHERE tenant_id = ? AND user_id = ?
      `).run(tenantId, userId);

      return TenantResult.success({ removed: info.changes > 0, userId, tenantId });
    } catch (err) {
      return TenantResult.failure(err.message, 'REMOVE_MEMBERSHIP_FAILED');
    }
  }

  async getMembership(tenantId, userId) {
    await this.init();
    if (!tenantId || !userId) return null;

    const row = this.db.prepare(`
      SELECT m.*, t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status
      FROM tenant_memberships m
      JOIN tenants t ON t.id = m.tenant_id
      WHERE m.tenant_id = ? AND m.user_id = ?
    `).get(tenantId, userId);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      tenantStatus: row.tenant_status,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      joinedAt: row.joined_at,
      updatedAt: row.updated_at
    };
  }

  async listUserTenants(userId) {
    await this.init();
    if (!userId) return TenantResult.success({ tenants: [] });

    const rows = this.db.prepare(`
      SELECT t.*, m.role, m.status as membership_status, m.joined_at
      FROM tenant_memberships m
      JOIN tenants t ON t.id = m.tenant_id
      WHERE m.user_id = ? AND m.status = 'active'
      ORDER BY t.name ASC
    `).all(userId);

    const tenants = rows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      role: r.role,
      membershipStatus: r.membership_status,
      joinedAt: r.joined_at
    }));

    return TenantResult.success({ tenants });
  }

  async getUserMemberships(userId) {
    await this.init();
    if (!userId) return [];

    const rows = this.db.prepare(`
      SELECT m.*, t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status
      FROM tenant_memberships m
      JOIN tenants t ON t.id = m.tenant_id
      WHERE m.user_id = ?
      ORDER BY m.joined_at ASC
    `).all(userId);

    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      tenantName: r.tenant_name,
      tenantSlug: r.tenant_slug,
      tenantStatus: r.tenant_status,
      userId: r.user_id,
      role: r.role,
      status: r.status,
      joinedAt: r.joined_at,
      updatedAt: r.updated_at
    }));
  }

  async listTenantMembers(tenantId) {
    await this.init();
    if (!tenantId) return TenantResult.success({ members: [] });

    const rows = this.db.prepare(`
      SELECT m.*, u.email, u.username
      FROM tenant_memberships m
      LEFT JOIN auth_users u ON u.id = m.user_id
      WHERE m.tenant_id = ?
      ORDER BY m.role = 'owner' DESC, m.role = 'admin' DESC, m.joined_at ASC
    `).all(tenantId);

    const members = rows.map(r => ({
      id: r.id,
      tenantId: r.tenant_id,
      userId: r.user_id,
      email: r.email,
      username: r.username,
      role: r.role,
      status: r.status,
      joinedAt: r.joined_at
    }));

    return TenantResult.success({ members });
  }

  async listMembers(tenantId) {
    const res = await this.listTenantMembers(tenantId);
    return res.ok ? res.members : [];
  }

  async suspendTenant(tenantId) {
    return this.updateTenant(tenantId, { status: 'suspended' });
  }

  async archiveTenant(tenantId) {
    return this.updateTenant(tenantId, { status: 'archived' });
  }

  async close() {
    if (this.db && this._ownsDb) {
      try { this.db.close(); } catch (_) {}
      this.db = null;
    }
    this.initialized = false;
  }
}

module.exports = SqliteTenantStore;
