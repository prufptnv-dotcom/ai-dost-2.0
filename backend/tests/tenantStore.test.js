'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: TenantStore & Multi-Tenant Persistence Test Suite
 * 
 * 50+ assertions testing SqliteTenantStore, PostgresTenantStore contract,
 * atomic transactions, last-owner invariant, slug validations, and multi-tenant isolation.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  TenantStore,
  SqliteTenantStore,
  PostgresTenantStore,
  TenantValidator,
  TenantPlan,
  TenantResult,
  TENANT_ROLES,
  TENANT_STATUSES,
  RESERVED_SLUGS
} = require('../agent/capabilities/tenant');

describe('Phase 5C: TenantStore & Persistence Unit Suite', () => {
  let tmpDbPath;
  let sqliteStore;

  beforeEach(() => {
    tmpDbPath = path.join(os.tmpdir(), `test-tenant-${crypto.randomUUID()}.sqlite`);
    sqliteStore = new SqliteTenantStore({ dbPath: tmpDbPath });
    sqliteStore.init();
  });

  // Clean up
  test.afterEach(() => {
    try {
      sqliteStore.close();
    } catch (e) {}
    try {
      if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
    } catch (e) {}
  });

  // 1. Abstract class invariants
  test('1. TenantStore abstract class cannot be instantiated directly', () => {
    assert.throws(() => new TenantStore(), /abstract class/i);
  });

  test('2. TenantStore subclass must implement all required abstract methods', async () => {
    class IncompleteStore extends TenantStore {}
    const incomplete = new IncompleteStore();
    await assert.rejects(() => incomplete.init(), /must be implemented/i);
    await assert.rejects(() => incomplete.createTenant({}), /must be implemented/i);
    await assert.rejects(() => incomplete.findTenantById('t1'), /must be implemented/i);
    await assert.rejects(() => incomplete.findTenantBySlug('s1'), /must be implemented/i);
    await assert.rejects(() => incomplete.addMembership('t1', 'u1', 'member'), /must be implemented/i);
    await assert.rejects(() => incomplete.updateMemberRole('t1', 'u1', 'admin'), /must be implemented/i);
    await assert.rejects(() => incomplete.removeMembership('t1', 'u1'), /must be implemented/i);
    await assert.rejects(() => incomplete.getActiveOwnerCount('t1'), /must be implemented/i);
    await assert.rejects(() => incomplete.getUserMemberships('u1'), /must be implemented/i);
  });

  // 2. TenantValidator & Slug rules
  test('3. TenantValidator validates valid slugs correctly', () => {
    const validSlugs = ['acme-corp', 'team-alpha-42', 'org-123', 'simple'];
    for (const slug of validSlugs) {
      const res = TenantValidator.validateSlug(slug);
      assert.equal(res.valid, true, `Slug '${slug}' should be valid`);
      assert.equal(res.slug, slug.toLowerCase());
    }
  });

  test('4. TenantValidator rejects invalid slugs (length, chars, casing, trailing hyphens)', () => {
    assert.equal(TenantValidator.validateSlug('ab').valid, false); // < 3 chars
    assert.equal(TenantValidator.validateSlug('a'.repeat(49)).valid, false); // > 48 chars
    assert.equal(TenantValidator.validateSlug('-invalid-start').valid, false);
    assert.equal(TenantValidator.validateSlug('invalid-end-').valid, false);
    assert.equal(TenantValidator.validateSlug('special@chars').valid, false);
    assert.equal(TenantValidator.validateSlug('spaces not allowed').valid, false);
  });

  test('5. TenantValidator blocks reserved system slugs', () => {
    const reserved = ['admin', 'system', 'api', 'root', 'auth', 'billing', 'login'];
    for (const slug of reserved) {
      const res = TenantValidator.validateSlug(slug);
      assert.equal(res.valid, false, `Slug '${slug}' should be rejected as reserved`);
      assert.match(res.error, /reserved/i);
    }
  });

  test('6. TenantValidator enforces role hierarchy correctly', () => {
    assert.equal(TenantValidator.canPerform('owner', 'admin'), true);
    assert.equal(TenantValidator.canPerform('owner', 'member'), true);
    assert.equal(TenantValidator.canPerform('admin', 'admin'), true);
    assert.equal(TenantValidator.canPerform('admin', 'owner'), false);
    assert.equal(TenantValidator.canPerform('member', 'admin'), false);
    assert.equal(TenantValidator.canPerform('member', 'member'), true);
    assert.equal(TenantValidator.canPerform('guest', 'member'), false);
  });

  // 3. SqliteTenantStore Tenant Creation & Unique Constraints
  test('7. createTenant atomically creates tenant and initial owner membership', async () => {
    const res = await sqliteStore.createTenant({
      name: 'Acme Corporation',
      slug: 'acme-corp',
      ownerUserId: 'user-001'
    });

    assert.equal(res.ok, true);
    assert.ok(res.tenant.id);
    assert.equal(res.tenant.slug, 'acme-corp');
    assert.equal(res.tenant.name, 'Acme Corporation');
    assert.equal(res.tenant.status, 'active');
    assert.equal(res.membership.userId, 'user-001');
    assert.equal(res.membership.role, 'owner');
    assert.equal(res.membership.status, 'active');
  });

  test('8. createTenant rejects duplicate slugs (case-insensitive)', async () => {
    const first = await sqliteStore.createTenant({
      name: 'First Tenant',
      slug: 'unique-team',
      ownerUserId: 'user-001'
    });
    assert.equal(first.ok, true);

    const duplicate = await sqliteStore.createTenant({
      name: 'Second Tenant',
      slug: 'UNIQUE-TEAM',
      ownerUserId: 'user-002'
    });
    assert.equal(duplicate.ok, false);
    assert.equal(duplicate.code, 'TENANT_ALREADY_EXISTS');
  });

  test('9. createTenant enforces valid slug format during creation', async () => {
    const invalid = await sqliteStore.createTenant({
      name: 'Invalid Slug Team',
      slug: 'bad_slug!@#',
      ownerUserId: 'user-001'
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.code, 'SLUG_FORMAT_INVALID');
  });

  test('10. createTenant rejects reserved slug during creation', async () => {
    const reserved = await sqliteStore.createTenant({
      name: 'System Admin Workspace',
      slug: 'admin',
      ownerUserId: 'user-001'
    });
    assert.equal(reserved.ok, false);
    assert.equal(reserved.code, 'SLUG_RESERVED');
  });

  test('11. findTenantById returns full tenant record with limits', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Limit Test',
      slug: 'limit-test',
      ownerUserId: 'user-001',
      maxProjects: 15,
      maxStorageBytes: 104857600
    });

    const tenant = await sqliteStore.findTenantById(created.tenant.id);
    assert.ok(tenant);
    assert.equal(tenant.id, created.tenant.id);
    assert.equal(tenant.slug, 'limit-test');
    assert.equal(tenant.maxProjects, 15);
    assert.equal(tenant.maxStorageBytes, 104857600);
  });

  test('12. findTenantBySlug normalizes lookup casing', async () => {
    await sqliteStore.createTenant({
      name: 'Case Test',
      slug: 'case-test-slug',
      ownerUserId: 'user-001'
    });

    const foundLower = await sqliteStore.findTenantBySlug('case-test-slug');
    const foundUpper = await sqliteStore.findTenantBySlug('CASE-TEST-SLUG');
    assert.ok(foundLower);
    assert.ok(foundUpper);
    assert.equal(foundLower.id, foundUpper.id);
  });

  // 4. Memberships & Roles
  test('13. addMembership adds member and admin to tenant', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Member Org',
      slug: 'member-org',
      ownerUserId: 'user-owner'
    });
    const tenantId = created.tenant.id;

    const addMemberRes = await sqliteStore.addMembership(tenantId, 'user-regular', 'member');
    assert.equal(addMemberRes.ok, true);
    assert.equal(addMemberRes.membership.role, 'member');

    const addAdminRes = await sqliteStore.addMembership(tenantId, 'user-admin', 'admin');
    assert.equal(addAdminRes.ok, true);
    assert.equal(addAdminRes.membership.role, 'admin');

    const members = await sqliteStore.listMembers(tenantId);
    assert.equal(members.length, 3);
  });

  test('14. addMembership enforces unique constraint on (tenant_id, user_id)', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Constraint Org',
      slug: 'constraint-org',
      ownerUserId: 'user-001'
    });
    const tenantId = created.tenant.id;

    const dup = await sqliteStore.addMembership(tenantId, 'user-001', 'member');
    assert.equal(dup.ok, false);
    assert.equal(dup.code, 'MEMBERSHIP_ALREADY_EXISTS');
  });

  test('15. addMembership validates role validity', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Role Validation Org',
      slug: 'role-validation-org',
      ownerUserId: 'user-001'
    });

    const badRole = await sqliteStore.addMembership(created.tenant.id, 'user-002', 'superadmin');
    assert.equal(badRole.ok, false);
    assert.equal(badRole.code, 'ROLE_INVALID');
  });

  // 5. Multi-Tenant User Isolation
  test('16. A single user can belong to multiple tenants with distinct roles', async () => {
    const orgA = await sqliteStore.createTenant({ name: 'Org A', slug: 'org-a', ownerUserId: 'user-shared' });
    const orgB = await sqliteStore.createTenant({ name: 'Org B', slug: 'org-b', ownerUserId: 'user-other' });

    // In Org B, user-shared is added as a member
    await sqliteStore.addMembership(orgB.tenant.id, 'user-shared', 'member');

    const memA = await sqliteStore.getMembership(orgA.tenant.id, 'user-shared');
    const memB = await sqliteStore.getMembership(orgB.tenant.id, 'user-shared');

    assert.equal(memA.role, 'owner');
    assert.equal(memB.role, 'member');

    const allMemberships = await sqliteStore.getUserMemberships('user-shared');
    assert.equal(allMemberships.length, 2);
    const tenantSlugs = allMemberships.map(m => m.tenantSlug).sort();
    assert.deepEqual(tenantSlugs, ['org-a', 'org-b']);
  });

  // 6. Last-Owner Protection Invariant
  test('17. Last-owner protection blocks sole owner from demoting themselves', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Sole Owner Org',
      slug: 'sole-owner-org',
      ownerUserId: 'owner-alone'
    });
    const tenantId = created.tenant.id;

    assert.equal(await sqliteStore.getActiveOwnerCount(tenantId), 1);

    const demoteRes = await sqliteStore.updateMemberRole(tenantId, 'owner-alone', 'admin');
    assert.equal(demoteRes.ok, false);
    assert.equal(demoteRes.code, 'LAST_OWNER_PROTECTION');

    // Verify role did not change
    const checkMem = await sqliteStore.getMembership(tenantId, 'owner-alone');
    assert.equal(checkMem.role, 'owner');
  });

  test('18. Last-owner protection blocks removing the sole active owner', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Removal Guard Org',
      slug: 'removal-guard-org',
      ownerUserId: 'owner-alone'
    });
    const tenantId = created.tenant.id;

    const removeRes = await sqliteStore.removeMembership(tenantId, 'owner-alone');
    assert.equal(removeRes.ok, false);
    assert.equal(removeRes.code, 'LAST_OWNER_PROTECTION');

    const checkMem = await sqliteStore.getMembership(tenantId, 'owner-alone');
    assert.equal(checkMem.status, 'active');
  });

  test('19. Adding a second owner permits demoting or removing the first owner', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Multi Owner Org',
      slug: 'multi-owner-org',
      ownerUserId: 'owner-one'
    });
    const tenantId = created.tenant.id;

    // Add 2nd owner
    const addOwner2 = await sqliteStore.addMembership(tenantId, 'owner-two', 'owner');
    assert.equal(addOwner2.ok, true);
    assert.equal(await sqliteStore.getActiveOwnerCount(tenantId), 2);

    // Now owner-one can be demoted to admin
    const demoteRes = await sqliteStore.updateMemberRole(tenantId, 'owner-one', 'admin');
    assert.equal(demoteRes.ok, true);
    assert.equal(demoteRes.membership.role, 'admin');

    // Owner count is now 1 (owner-two)
    assert.equal(await sqliteStore.getActiveOwnerCount(tenantId), 1);

    // Now owner-two CANNOT be demoted or removed
    const demoteOwner2 = await sqliteStore.updateMemberRole(tenantId, 'owner-two', 'member');
    assert.equal(demoteOwner2.ok, false);
    assert.equal(demoteOwner2.code, 'LAST_OWNER_PROTECTION');

    const removeOwner2 = await sqliteStore.removeMembership(tenantId, 'owner-two');
    assert.equal(removeOwner2.ok, false);
    assert.equal(removeOwner2.code, 'LAST_OWNER_PROTECTION');
  });

  // 7. Tenant Lifecycle Status
  test('20. updateTenantStatus handles active -> suspended -> archived transitions', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Lifecycle Org',
      slug: 'lifecycle-org',
      ownerUserId: 'owner-user'
    });
    const tenantId = created.tenant.id;

    // Suspend tenant
    const suspendRes = await sqliteStore.updateTenantStatus(tenantId, 'suspended');
    assert.equal(suspendRes.ok, true);
    assert.equal(suspendRes.tenant.status, 'suspended');

    let tenant = await sqliteStore.findTenantById(tenantId);
    assert.equal(tenant.status, 'suspended');

    // Reactivate tenant
    const reactivateRes = await sqliteStore.updateTenantStatus(tenantId, 'active');
    assert.equal(reactivateRes.ok, true);
    assert.equal(reactivateRes.tenant.status, 'active');

    // Archive tenant
    const archiveRes = await sqliteStore.updateTenantStatus(tenantId, 'archived');
    assert.equal(archiveRes.ok, true);
    assert.equal(archiveRes.tenant.status, 'archived');

    // Invalid status rejected
    const badStatus = await sqliteStore.updateTenantStatus(tenantId, 'deleted');
    assert.equal(badStatus.ok, false);
    assert.equal(badStatus.code, 'STATUS_INVALID');
  });

  // 8. PostgresTenantStore Contract & Offline Safety
  test('21. PostgresTenantStore handles offline database with graceful error envelope', async () => {
    const pgStore = new PostgresTenantStore({
      connectionString: 'postgresql://postgres:postgres@127.0.0.1:54321/nonexistent_test_db'
    });

    assert.equal(pgStore.isLiveAvailable, false);

    const initRes = await pgStore.init();
    assert.equal(initRes.ok, false);
    assert.match(initRes.error, /PostgreSQL connection unavailable/i);

    const createRes = await pgStore.createTenant({ name: 'PG Org', slug: 'pg-org', ownerUserId: 'u1' });
    assert.equal(createRes.ok, false);
    assert.equal(createRes.code, 'POSTGRES_OFFLINE');

    const findRes = await pgStore.findTenantById('t1');
    assert.equal(findRes, null);

    const ownerCount = await pgStore.getActiveOwnerCount('t1');
    assert.equal(ownerCount, 0);
  });

  test('22. PostgresTenantStore works with mock pool verifying SQL queries and rollback contract', async () => {
    const executedQueries = [];
    let shouldFailQuery = false;

    const mockClient = {
      query: async (sql, params) => {
        executedQueries.push({ sql: sql.trim(), params });
        if (shouldFailQuery) {
          throw new Error('Simulated query failure');
        }
        if (sql.includes('SELECT 1')) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        if (sql.includes('SELECT') && sql.includes('COUNT(*)')) {
          return { rows: [{ count: '2' }] };
        }
        if (sql.includes('SELECT') && sql.includes('FROM tenants WHERE id = $1')) {
          return {
            rows: [{
              id: 't-mock-1',
              name: 'Mock PG Tenant',
              slug: 'mock-pg',
              status: 'active',
              max_projects: 20,
              max_storage_bytes: 524288000,
              max_concurrent_sandboxes: 2,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]
          };
        }
        if (sql.includes('INSERT INTO tenants')) {
          return {
            rows: [{
              id: 't-mock-1',
              name: 'Mock PG Tenant',
              slug: 'mock-pg',
              status: 'active',
              max_projects: 20,
              max_storage_bytes: 524288000,
              max_concurrent_sandboxes: 2,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]
          };
        }
        if (sql.includes('INSERT INTO tenant_memberships')) {
          return {
            rows: [{
              id: 'm-mock-1',
              tenant_id: 't-mock-1',
              user_id: 'u-owner',
              role: 'owner',
              status: 'active',
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]
          };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {}
    };

    const mockPool = {
      connect: async () => mockClient,
      query: async (sql, params) => mockClient.query(sql, params)
    };

    const pgStore = new PostgresTenantStore({ pool: mockPool });
    const initRes = await pgStore.init();
    assert.equal(initRes.ok, true);
    assert.equal(pgStore.isLiveAvailable, true);

    // Verify atomic createTenant transaction
    const createRes = await pgStore.createTenant({
      name: 'Mock PG Tenant',
      slug: 'mock-pg',
      ownerUserId: 'u-owner'
    });
    assert.equal(createRes.ok, true);
    assert.equal(createRes.tenant.slug, 'mock-pg');
    assert.equal(createRes.membership.role, 'owner');

    const queryStrings = executedQueries.map(q => q.sql);
    assert.ok(queryStrings.includes('BEGIN'));
    assert.ok(queryStrings.includes('COMMIT'));

    // Test rollback on error
    shouldFailQuery = true;
    executedQueries.length = 0;
    const failRes = await pgStore.createTenant({
      name: 'Fail Tenant',
      slug: 'fail-slug',
      ownerUserId: 'u-owner'
    });
    assert.equal(failRes.ok, false);
    const rollbackQueries = executedQueries.map(q => q.sql);
    assert.ok(rollbackQueries.includes('ROLLBACK'));
  });

  // 9. Additional Persistence & Invariant Tests
  test('23. updateTenant persists settings JSON and partial name changes', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Original Name',
      slug: 'settings-test',
      ownerUserId: 'u1'
    });
    const tenantId = created.tenant.id;

    const updated = await sqliteStore.updateTenant(tenantId, {
      name: 'Renamed Workspace',
      settings: { theme: 'dark', customDomain: 'team.example.com' }
    });

    assert.equal(updated.ok, true);
    assert.equal(updated.tenant.name, 'Renamed Workspace');
    assert.equal(updated.tenant.settings.theme, 'dark');
    assert.equal(updated.tenant.settings.customDomain, 'team.example.com');

    // Retrieve again to confirm persistence
    const reloaded = await sqliteStore.findTenantById(tenantId);
    assert.equal(reloaded.name, 'Renamed Workspace');
    assert.equal(reloaded.settings.theme, 'dark');
  });

  test('24. getActiveOwnerCount excludes non-active owner memberships', async () => {
    const created = await sqliteStore.createTenant({
      name: 'Status Owner Org',
      slug: 'status-owner-org',
      ownerUserId: 'owner-active'
    });
    const tenantId = created.tenant.id;

    // Add invited owner (status: invited)
    await sqliteStore.addMembership(tenantId, 'owner-invited', 'owner', 'invited');
    assert.equal(await sqliteStore.getActiveOwnerCount(tenantId), 1);

    // Add suspended owner (status: suspended)
    await sqliteStore.addMembership(tenantId, 'owner-suspended', 'owner', 'suspended');
    assert.equal(await sqliteStore.getActiveOwnerCount(tenantId), 1);

    // Add another active owner
    await sqliteStore.addMembership(tenantId, 'owner-active-2', 'owner', 'active');
    assert.equal(await sqliteStore.getActiveOwnerCount(tenantId), 2);
  });

  test('25. TenantPlan creates deeply frozen declarative plans and validates limits', () => {
    const plan = TenantPlan.create({
      name: 'Enterprise Plan Test',
      slug: 'enterprise-test',
      ownerUserId: 'u-enterprise',
      maxProjects: 100,
      maxStorageBytes: 1073741824,
      maxConcurrentSandboxes: 5
    });

    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.limits), true);
    assert.equal(plan.name, 'Enterprise Plan Test');
    assert.equal(plan.slug, 'enterprise-test');
    assert.equal(plan.limits.maxProjects, 100);
    assert.equal(plan.limits.maxStorageBytes, 1073741824);
    assert.equal(plan.limits.maxConcurrentSandboxes, 5);

    // Attempting mutation throws in strict mode
    assert.throws(() => { plan.name = 'Hacked'; }, TypeError);
  });
});
