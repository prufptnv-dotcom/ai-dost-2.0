'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: Tenant Quota & Lifecycle Test Suite
 * 
 * 15+ assertions testing TenantQuotaManager, anti-bypass multi-account quota aggregation,
 * storage/project/sandbox limits, tenant suspension lifecycle, and audit log isolation.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  SqliteTenantStore,
  TenantQuotaManager,
  TenantContextResolver,
  TenantAuditLogger
} = require('../agent/capabilities/tenant');

describe('Phase 5C: Tenant Quota & Lifecycle Suite', () => {
  let tmpDbPath;
  let store;
  let quotaManager;
  let auditLogger;
  let resolver;

  let tenantA;
  let tenantB;

  beforeEach(async () => {
    tmpDbPath = path.join(os.tmpdir(), `test-quota-${crypto.randomUUID()}.sqlite`);
    store = new SqliteTenantStore({ dbPath: tmpDbPath });
    await store.init();

    auditLogger = new TenantAuditLogger(store.db, { engine: 'sqlite' });
    resolver = new TenantContextResolver(store);

    // Create Tenant A with small limits: maxProjects=3, maxStorageBytes=10000, maxConcurrentSandboxes=2
    const resA = await store.createTenant({
      name: 'Small Limit Tenant',
      slug: 'small-limit',
      ownerUserId: 'user-a1',
      maxProjects: 3,
      maxStorageBytes: 10000,
      maxConcurrentSandboxes: 2
    });
    tenantA = resA.tenant;

    // Add user-a2 as member to Tenant A
    await store.addMembership(tenantA.id, 'user-a2', 'member');

    // Create Tenant B
    const resB = await store.createTenant({
      name: 'Other Tenant',
      slug: 'other-tenant',
      ownerUserId: 'user-b1'
    });
    tenantB = resB.tenant;

    // Mock rate limiter
    const mockRateLimiter = {
      isAllowed: async (key, category) => {
        if (key.includes('rate-limited')) {
          return { allowed: false, remaining: 0, resetTime: Date.now() + 60000 };
        }
        return { allowed: true, remaining: 100 };
      }
    };

    quotaManager = new TenantQuotaManager(store, { rateLimiter: mockRateLimiter });
  });

  test.afterEach(() => {
    try { store.close(); } catch (_) {}
    try { if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath); } catch (_) {}
  });

  // 1. Anti-Bypass Multi-Account Project Quota
  test('1. Project quota allows creation below tenant limit', async () => {
    // 2 existing projects
    const check1 = await quotaManager.checkProjectQuota(tenantA.id, 2);
    assert.equal(check1.ok, true);
    assert.equal(check1.quota.allowed, true);
    assert.equal(check1.quota.current, 2);
  });

  test('2. Anti-bypass: Member 2 is blocked when combined tenant projects reach limit', async () => {
    // Even though user-a2 has 0 projects personally, the tenant has 3 projects
    const checkBlocked = await quotaManager.checkProjectQuota(tenantA.id, 3);
    assert.equal(checkBlocked.ok, false);
    assert.equal(checkBlocked.code, 'TENANT_QUOTA_EXCEEDED');
    assert.equal(checkBlocked.details.resource, 'projects');
    assert.match(checkBlocked.error, /project limit reached/i);
  });

  // 2. Storage Quota
  test('3. Storage quota allows writes within capacity', async () => {
    // Currently 4000 bytes used, requesting 5000 bytes more (total 9000 <= 10000 limit)
    const check = await quotaManager.checkStorageQuota(tenantA.id, 4000, 5000);
    assert.equal(check.ok, true);
    assert.equal(check.quota.allowed, true);
    assert.equal(check.quota.projected, 9000);
  });

  test('4. Storage quota blocks writes that would exceed tenant capacity', async () => {
    // Currently 8000 bytes used, requesting 3000 bytes more (total 11000 > 10000 limit)
    const check = await quotaManager.checkStorageQuota(tenantA.id, 8000, 3000);
    assert.equal(check.ok, false);
    assert.equal(check.code, 'TENANT_QUOTA_EXCEEDED');
    assert.equal(check.details.resource, 'storage');
    assert.equal(check.details.limit, 10000);
  });

  // 3. Concurrent Sandboxes Limit
  test('5. Sandbox quota allows up to maxConcurrentSandboxes', async () => {
    const check1 = await quotaManager.checkSandboxQuota(tenantA.id, 1);
    assert.equal(check1.ok, true);
    assert.equal(check1.quota.allowed, true);

    const checkBlocked = await quotaManager.checkSandboxQuota(tenantA.id, 2);
    assert.equal(checkBlocked.ok, false);
    assert.equal(checkBlocked.code, 'TENANT_QUOTA_EXCEEDED');
    assert.equal(checkBlocked.details.resource, 'sandboxes');
  });

  // 4. Distributed Rate Limiter Hook
  test('6. Distributed rate limit integrates with tenant key prefix', async () => {
    const allowed = await quotaManager.checkRateLimit(tenantA.id, 'api');
    assert.equal(allowed.allowed, true);

    const blocked = await quotaManager.checkRateLimit('rate-limited-tenant', 'api');
    assert.equal(blocked.allowed, false);
  });

  // 5. Tenant Suspension Lifecycle
  test('7. Tenant suspension immediately revokes access for all members', async () => {
    // Verify user-a1 and user-a2 can access initially
    const preA1 = await resolver.resolve({ headers: { 'x-tenant-id': tenantA.id } }, 'user-a1');
    const preA2 = await resolver.resolve({ headers: { 'x-tenant-id': tenantA.id } }, 'user-a2');
    assert.equal(preA1.ok, true);
    assert.equal(preA2.ok, true);

    // Suspend tenant
    await store.updateTenantStatus(tenantA.id, 'suspended');

    // Both members must be immediately blocked with 403 TENANT_SUSPENDED
    const postA1 = await resolver.resolve({ headers: { 'x-tenant-id': tenantA.id } }, 'user-a1');
    const postA2 = await resolver.resolve({ headers: { 'x-tenant-id': tenantA.id } }, 'user-a2');

    assert.equal(postA1.ok, false);
    assert.equal(postA1.status, 403);
    assert.equal(postA1.code, 'TENANT_SUSPENDED');

    assert.equal(postA2.ok, false);
    assert.equal(postA2.status, 403);
    assert.equal(postA2.code, 'TENANT_SUSPENDED');
  });

  // 6. Audit Log Isolation
  test('8. Audit logs of Tenant A cannot be viewed or queried by Tenant B', async () => {
    // Log event in Tenant A
    await auditLogger.logEvent({
      tenantId: tenantA.id,
      userId: 'user-a1',
      action: 'project.created',
      resourceType: 'project',
      resourceId: 'proj-confidential-a'
    });

    // Log event in Tenant B
    await auditLogger.logEvent({
      tenantId: tenantB.id,
      userId: 'user-b1',
      action: 'project.created',
      resourceType: 'project',
      resourceId: 'proj-open-b'
    });

    // Query Tenant A logs specifically for project.created
    const logsA = await auditLogger.getAuditLogs(tenantA.id, { action: 'project.created' });
    assert.equal(logsA.length, 1);
    assert.equal(logsA[0].resourceId, 'proj-confidential-a');

    // Query Tenant B logs specifically for project.created
    const logsB = await auditLogger.getAuditLogs(tenantB.id, { action: 'project.created' });
    assert.equal(logsB.length, 1);
    assert.equal(logsB[0].resourceId, 'proj-open-b');

    // Tenant B cannot see Tenant A's event
    const crossCheck = logsB.some(l => l.resourceId === 'proj-confidential-a');
    assert.equal(crossCheck, false);
  });
});
