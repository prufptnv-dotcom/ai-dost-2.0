'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: Tenant Authorization & Context Resolution Suite
 * 
 * 35+ assertions testing TenantContextResolver, TenantAuthorizationMiddleware,
 * TenantOwnershipValidator, anti-enumeration (404), role hierarchy, and IDOR defense.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  SqliteTenantStore,
  TenantContextResolver,
  createTenantMiddleware,
  TenantOwnershipValidator,
  TenantAuditLogger
} = require('../agent/capabilities/tenant');

describe('Phase 5C: Tenant Authorization & Context Resolution Suite', () => {
  let tmpDbPath;
  let store;
  let resolver;
  let auditLogger;
  let ownershipValidator;
  let middleware;

  let tenantAlpha;
  let tenantBeta;
  let tenantSuspended;
  let tenantArchived;

  beforeEach(async () => {
    tmpDbPath = path.join(os.tmpdir(), `test-authz-${crypto.randomUUID()}.sqlite`);
    store = new SqliteTenantStore({ dbPath: tmpDbPath });
    await store.init();

    auditLogger = new TenantAuditLogger(store.db, { engine: 'sqlite' });
    resolver = new TenantContextResolver(store);
    ownershipValidator = new TenantOwnershipValidator({ auditLogger });
    middleware = createTenantMiddleware(resolver);

    // Seed test tenants
    const alphaRes = await store.createTenant({
      name: 'Tenant Alpha',
      slug: 'tenant-alpha',
      ownerUserId: 'user-alice'
    });
    tenantAlpha = alphaRes.tenant;

    const betaRes = await store.createTenant({
      name: 'Tenant Beta',
      slug: 'tenant-beta',
      ownerUserId: 'user-bob'
    });
    tenantBeta = betaRes.tenant;

    // Add alice to beta as a regular member
    await store.addMembership(tenantBeta.id, 'user-alice', 'member');

    // Add charlie to alpha as an admin
    await store.addMembership(tenantAlpha.id, 'user-charlie', 'admin');

    // Suspended tenant
    const suspRes = await store.createTenant({
      name: 'Suspended Org',
      slug: 'suspended-org',
      ownerUserId: 'user-alice'
    });
    tenantSuspended = suspRes.tenant;
    await store.updateTenantStatus(tenantSuspended.id, 'suspended');

    // Archived tenant
    const archRes = await store.createTenant({
      name: 'Archived Org',
      slug: 'archived-org',
      ownerUserId: 'user-alice'
    });
    tenantArchived = archRes.tenant;
    await store.updateTenantStatus(tenantArchived.id, 'archived');
  });

  test.afterEach(() => {
    try { store.close(); } catch (_) {}
    try { if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath); } catch (_) {}
  });

  // 1. TenantContextResolver Core Invariants
  test('1. Resolver requires authenticated user ID', async () => {
    const req = { headers: { 'x-tenant-id': tenantAlpha.id } };
    const res = await resolver.resolve(req, null);
    assert.equal(res.ok, false);
    assert.equal(res.status, 401);
    assert.equal(res.code, 'UNAUTHENTICATED');
  });

  test('2. Resolver requires tenant identifier when allowDefault is false', async () => {
    const req = { headers: {} };
    const res = await resolver.resolve(req, 'user-alice', { allowDefault: false });
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.equal(res.code, 'MISSING_TENANT_IDENTIFIER');
  });

  test('3. Resolver resolves tenant by x-tenant-id header', async () => {
    const req = { headers: { 'x-tenant-id': tenantAlpha.id } };
    const res = await resolver.resolve(req, 'user-alice');
    assert.equal(res.ok, true);
    assert.equal(res.context.tenantId, tenantAlpha.id);
    assert.equal(res.context.tenantSlug, 'tenant-alpha');
    assert.equal(res.context.role, 'owner');
    assert.equal(res.context.userId, 'user-alice');
    assert.equal(Object.isFrozen(res.context), true);
  });

  test('4. Resolver resolves tenant by x-tenant-slug header', async () => {
    const req = { headers: { 'x-tenant-slug': 'tenant-alpha' } };
    const res = await resolver.resolve(req, 'user-charlie');
    assert.equal(res.ok, true);
    assert.equal(res.context.tenantId, tenantAlpha.id);
    assert.equal(res.context.role, 'admin');
  });

  test('5. Resolver resolves tenant by route params (tenantId / tenantSlug)', async () => {
    const reqWithId = { params: { tenantId: tenantBeta.id } };
    const res1 = await resolver.resolve(reqWithId, 'user-bob');
    assert.equal(res1.ok, true);
    assert.equal(res1.context.tenantSlug, 'tenant-beta');
    assert.equal(res1.context.role, 'owner');

    const reqWithSlug = { params: { tenantSlug: 'tenant-beta' } };
    const res2 = await resolver.resolve(reqWithSlug, 'user-alice');
    assert.equal(res2.ok, true);
    assert.equal(res2.context.role, 'member');
  });

  test('6. Resolver resolves fallback default tenant when allowDefault is true', async () => {
    const req = { headers: {} };
    const res = await resolver.resolve(req, 'user-alice', { allowDefault: true });
    assert.equal(res.ok, true);
    assert.ok(res.context.tenantId);
    assert.equal(res.context.userId, 'user-alice');
  });

  test('7. Resolver returns 404 if tenant does not exist', async () => {
    const req = { headers: { 'x-tenant-id': 'nonexistent-tenant-999' } };
    const res = await resolver.resolve(req, 'user-alice');
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.code, 'TENANT_NOT_FOUND');
  });

  test('8. Resolver returns 404 (anti-probing) when user is not a member of the tenant', async () => {
    // Charlie is in Alpha, NOT Beta
    const req = { headers: { 'x-tenant-id': tenantBeta.id } };
    const res = await resolver.resolve(req, 'user-charlie');
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.code, 'TENANT_MEMBERSHIP_NOT_FOUND');
  });

  test('9. Resolver returns 403 when tenant is suspended', async () => {
    const req = { headers: { 'x-tenant-id': tenantSuspended.id } };
    const res = await resolver.resolve(req, 'user-alice');
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'TENANT_SUSPENDED');
  });

  test('10. Resolver returns 404 when tenant is archived', async () => {
    const req = { headers: { 'x-tenant-id': tenantArchived.id } };
    const res = await resolver.resolve(req, 'user-alice');
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.code, 'TENANT_ARCHIVED');
  });

  test('11. Resolver returns 403 when member membership status is not active', async () => {
    // Add dave as suspended member
    await store.addMembership(tenantAlpha.id, 'user-dave', 'member', 'suspended');

    const req = { headers: { 'x-tenant-id': tenantAlpha.id } };
    const res = await resolver.resolve(req, 'user-dave');
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.code, 'MEMBERSHIP_INACTIVE');
  });

  // 2. Express Middleware Integration
  test('12. resolveTenantContext middleware populates req.tenantContext', async () => {
    const req = {
      user: { id: 'user-alice' },
      headers: { 'x-tenant-slug': 'tenant-alpha' }
    };
    let nextCalled = false;
    const res = {
      status: (code) => ({ json: (data) => ({ code, data }) })
    };

    await middleware.resolveTenantContext(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.ok(req.tenantContext);
    assert.equal(req.tenantContext.tenantSlug, 'tenant-alpha');
    assert.equal(req.tenantContext.role, 'owner');
  });

  test('13. resolveTenantContext blocks unauthenticated user with 401', async () => {
    const req = { user: null, headers: { 'x-tenant-id': tenantAlpha.id } };
    let responseSent = null;
    const res = {
      status: (code) => ({
        json: (data) => { responseSent = { code, data }; }
      })
    };

    await middleware.resolveTenantContext(req, res, () => {});
    assert.ok(responseSent);
    assert.equal(responseSent.code, 401);
    assert.equal(responseSent.data.code, 'UNAUTHENTICATED');
  });

  test('14. requireTenantMember allows member, admin, and owner', () => {
    let nextCalled = false;
    const reqOwner = { tenantContext: { role: 'owner' } };
    middleware.requireTenantMember(reqOwner, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    nextCalled = false;
    const reqAdmin = { tenantContext: { role: 'admin' } };
    middleware.requireTenantMember(reqAdmin, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    nextCalled = false;
    const reqMember = { tenantContext: { role: 'member' } };
    middleware.requireTenantMember(reqMember, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  test('15. requireTenantMember blocks request if tenantContext is missing', () => {
    const req = {};
    let responseSent = null;
    const res = {
      status: (code) => ({
        json: (data) => { responseSent = { code, data }; }
      })
    };

    middleware.requireTenantMember(req, res, () => {});
    assert.ok(responseSent);
    assert.equal(responseSent.code, 400);
    assert.equal(responseSent.data.code, 'MISSING_TENANT_CONTEXT');
  });

  test('16. requireTenantAdmin allows admin and owner, but blocks regular member', () => {
    let nextCalled = false;
    const reqOwner = { tenantContext: { role: 'owner', tenantSlug: 'alpha' } };
    middleware.requireTenantAdmin(reqOwner, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    nextCalled = false;
    const reqAdmin = { tenantContext: { role: 'admin', tenantSlug: 'alpha' } };
    middleware.requireTenantAdmin(reqAdmin, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    let responseSent = null;
    const reqMember = { tenantContext: { role: 'member', tenantSlug: 'alpha' } };
    const res = {
      status: (code) => ({
        json: (data) => { responseSent = { code, data }; }
      })
    };
    middleware.requireTenantAdmin(reqMember, res, () => {});
    assert.ok(responseSent);
    assert.equal(responseSent.code, 403);
    assert.equal(responseSent.data.code, 'INSUFFICIENT_TENANT_PERMISSIONS');
  });

  test('17. requireTenantOwner allows only owner, blocking admin and member', () => {
    let nextCalled = false;
    const reqOwner = { tenantContext: { role: 'owner', tenantSlug: 'alpha' } };
    middleware.requireTenantOwner(reqOwner, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    let responseAdmin = null;
    const reqAdmin = { tenantContext: { role: 'admin', tenantSlug: 'alpha' } };
    const resAdmin = {
      status: (code) => ({ json: (data) => { responseAdmin = { code, data }; } })
    };
    middleware.requireTenantOwner(reqAdmin, resAdmin, () => {});
    assert.ok(responseAdmin);
    assert.equal(responseAdmin.code, 403);

    let responseMember = null;
    const reqMember = { tenantContext: { role: 'member', tenantSlug: 'alpha' } };
    const resMember = {
      status: (code) => ({ json: (data) => { responseMember = { code, data }; } })
    };
    middleware.requireTenantOwner(reqMember, resMember, () => {});
    assert.ok(responseMember);
    assert.equal(responseMember.code, 403);
  });

  // 3. TenantOwnershipValidator & IDOR / BOLA Prevention
  test('18. OwnershipValidator accepts matching tenant resources', async () => {
    const project = { id: 'proj-1', tenant_id: tenantAlpha.id, name: 'Alpha Project' };
    const res = await ownershipValidator.validateOwnership(project, tenantAlpha.id, 'project');
    assert.equal(res.ok, true);
  });

  test('19. OwnershipValidator accepts resource with camelCase tenantId property', async () => {
    const file = { id: 'file-1', tenantId: tenantAlpha.id, path: '/src/index.js' };
    const res = await ownershipValidator.validateOwnership(file, tenantAlpha.id, 'file');
    assert.equal(res.ok, true);
  });

  test('20. OwnershipValidator returns 404 NOT_FOUND on cross-tenant IDOR attempt', async () => {
    // Resource belongs to Beta, but request context is Alpha
    const betaProject = { id: 'proj-beta-1', tenant_id: tenantBeta.id, name: 'Secret Beta Plan' };

    const res = await ownershipValidator.validateOwnership(betaProject, tenantAlpha.id, 'project', {
      userId: 'user-alice',
      ipAddress: '192.168.1.50'
    });

    // Invariant: returns 404 to prevent resource existence enumeration across tenants
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.code, 'PROJECT_NOT_FOUND');

    // Verify audit record was logged
    const logs = await auditLogger.getAuditLogs(tenantAlpha.id, { action: 'security.idor_attempt_blocked' });
    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, 'security.idor_attempt_blocked');
    assert.equal(logs[0].resourceId, 'proj-beta-1');
  });

  test('21. OwnershipValidator returns 404 when resource is null or missing', async () => {
    const res = await ownershipValidator.validateOwnership(null, tenantAlpha.id, 'sandbox');
    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.code, 'SANDBOX_NOT_FOUND');
  });

  test('22. OwnershipValidator requires expectedTenantId', async () => {
    const project = { id: 'proj-1', tenant_id: tenantAlpha.id };
    const res = await ownershipValidator.validateOwnership(project, null, 'project');
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
    assert.equal(res.code, 'MISSING_TENANT_ID');
  });

  test('23. OwnershipValidator.buildScopedWhere generates parameterized SQL where clauses', () => {
    const clause = TenantOwnershipValidator.buildScopedWhere(tenantAlpha.id, 'p-123');
    assert.equal(clause.sql, 'tenant_id = ? AND id = ?');
    assert.deepEqual(clause.params, [tenantAlpha.id, 'p-123']);
  });
});
