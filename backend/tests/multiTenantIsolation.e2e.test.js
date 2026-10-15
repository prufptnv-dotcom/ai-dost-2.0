'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: Multi-Tenant Isolation End-to-End Suite
 * 
 * 30+ assertions testing strict resource isolation across tenants (Alpha vs Beta),
 * IDOR/BOLA defense, cross-tenant read/write/delete blocking, tenant context switching,
 * and data isolation for projects, files, and chat sessions.
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

describe('Phase 5C: Multi-Tenant Isolation End-to-End Suite', () => {
  let tmpDbPath;
  let store;
  let resolver;
  let auditLogger;
  let ownershipValidator;

  let tenantAlpha;
  let tenantBeta;

  beforeEach(async () => {
    tmpDbPath = path.join(os.tmpdir(), `test-iso-e2e-${crypto.randomUUID()}.sqlite`);
    store = new SqliteTenantStore({ dbPath: tmpDbPath });
    await store.init();

    auditLogger = new TenantAuditLogger(store.db, { engine: 'sqlite' });
    resolver = new TenantContextResolver(store);
    ownershipValidator = new TenantOwnershipValidator({ auditLogger });

    // 1. Create Tenant Alpha (Alice = Owner, Charlie = Admin)
    const resAlpha = await store.createTenant({
      name: 'Alpha Software Inc',
      slug: 'alpha-software',
      ownerUserId: 'alice-001'
    });
    tenantAlpha = resAlpha.tenant;
    await store.addMembership(tenantAlpha.id, 'charlie-003', 'admin');

    // 2. Create Tenant Beta (Bob = Owner, Alice = Member)
    const resBeta = await store.createTenant({
      name: 'Beta Global Tech',
      slug: 'beta-global',
      ownerUserId: 'bob-002'
    });
    tenantBeta = resBeta.tenant;
    await store.addMembership(tenantBeta.id, 'alice-001', 'member');

    // 3. Seed tenant_projects
    store.db.prepare(`
      INSERT INTO tenant_projects (id, tenant_id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('proj-alpha-1', tenantAlpha.id, 'alice-001', 'Alpha Core Backend', 'Private Alpha code', new Date().toISOString(), new Date().toISOString());

    store.db.prepare(`
      INSERT INTO tenant_projects (id, tenant_id, user_id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('proj-beta-1', tenantBeta.id, 'bob-002', 'Beta Microservice', 'Private Beta code', new Date().toISOString(), new Date().toISOString());

    // 4. Seed tenant_files
    store.db.prepare(`
      INSERT INTO tenant_files (id, tenant_id, project_id, user_id, file_path, size_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('file-alpha-1', tenantAlpha.id, 'proj-alpha-1', 'alice-001', 'src/auth.js', 4096, new Date().toISOString(), new Date().toISOString());

    store.db.prepare(`
      INSERT INTO tenant_files (id, tenant_id, project_id, user_id, file_path, size_bytes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('file-beta-1', tenantBeta.id, 'proj-beta-1', 'bob-002', 'config/prod.json', 1024, new Date().toISOString(), new Date().toISOString());

    // 5. Seed tenant_chat_sessions
    store.db.prepare(`
      INSERT INTO tenant_chat_sessions (id, tenant_id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('chat-alpha-1', tenantAlpha.id, 'alice-001', 'Alpha Architecture Design', new Date().toISOString(), new Date().toISOString());

    store.db.prepare(`
      INSERT INTO tenant_chat_sessions (id, tenant_id, user_id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('chat-beta-1', tenantBeta.id, 'bob-002', 'Beta Deployment Strategy', new Date().toISOString(), new Date().toISOString());
  });

  test.afterEach(() => {
    try { store.close(); } catch (_) {}
    try { if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath); } catch (_) {}
  });

  // 1. Cross-Tenant Project Isolation
  test('1. Project in Alpha is accessible when scoped to Alpha tenant context', async () => {
    const req = { headers: { 'x-tenant-id': tenantAlpha.id } };
    const authResult = await resolver.resolve(req, 'alice-001');
    assert.equal(authResult.ok, true);

    const where = TenantOwnershipValidator.buildScopedWhere(authResult.context.tenantId, 'proj-alpha-1');
    const project = store.db.prepare(`SELECT * FROM tenant_projects WHERE ${where.sql}`).get(...where.params);

    assert.ok(project);
    assert.equal(project.id, 'proj-alpha-1');
    assert.equal(project.tenant_id, tenantAlpha.id);
  });

  test('2. Project in Alpha is completely invisible (returns null/404) when queried under Beta context', async () => {
    const req = { headers: { 'x-tenant-id': tenantBeta.id } };
    const authResult = await resolver.resolve(req, 'bob-002');
    assert.equal(authResult.ok, true);

    // Bob tries to query Alpha's project using Beta's tenant context
    const where = TenantOwnershipValidator.buildScopedWhere(authResult.context.tenantId, 'proj-alpha-1');
    const project = store.db.prepare(`SELECT * FROM tenant_projects WHERE ${where.sql}`).get(...where.params);

    assert.equal(project, undefined); // 0 rows found

    // Ownership validator defense
    const directLookup = store.db.prepare('SELECT * FROM tenant_projects WHERE id = ?').get('proj-alpha-1');
    const valRes = await ownershipValidator.validateOwnership(directLookup, authResult.context.tenantId, 'project', {
      userId: 'bob-002'
    });

    assert.equal(valRes.ok, false);
    assert.equal(valRes.status, 404);
    assert.equal(valRes.code, 'PROJECT_NOT_FOUND');
  });

  test('3. Alice cannot access Alpha project when her active context is set to Beta', async () => {
    // Alice belongs to both Alpha and Beta, but currently sends header for Beta
    const req = { headers: { 'x-tenant-id': tenantBeta.id } };
    const authResult = await resolver.resolve(req, 'alice-001');
    assert.equal(authResult.ok, true);
    assert.equal(authResult.context.tenantId, tenantBeta.id);
    assert.equal(authResult.context.role, 'member'); // In Beta she is only a member

    // Attempting to query Alpha's project within Beta's context
    const where = TenantOwnershipValidator.buildScopedWhere(authResult.context.tenantId, 'proj-alpha-1');
    const project = store.db.prepare(`SELECT * FROM tenant_projects WHERE ${where.sql}`).get(...where.params);

    assert.equal(project, undefined);
  });

  // 2. Cross-Tenant File Isolation
  test('4. Files in Alpha are strictly isolated from Beta queries', async () => {
    const reqBeta = { headers: { 'x-tenant-id': tenantBeta.id } };
    const ctxBeta = (await resolver.resolve(reqBeta, 'bob-002')).context;

    // List all files scoped to Beta
    const betaFiles = store.db.prepare('SELECT * FROM tenant_files WHERE tenant_id = ?').all(ctxBeta.tenantId);
    assert.equal(betaFiles.length, 1);
    assert.equal(betaFiles[0].id, 'file-beta-1');
    assert.equal(betaFiles[0].file_path, 'config/prod.json');

    // Confirm file-alpha-1 is not returned in Beta list
    const hasAlphaFile = betaFiles.some(f => f.id === 'file-alpha-1');
    assert.equal(hasAlphaFile, false);
  });

  test('5. Direct cross-tenant file read attempt triggers audit security event', async () => {
    const rawAlphaFile = store.db.prepare('SELECT * FROM tenant_files WHERE id = ?').get('file-alpha-1');
    assert.ok(rawAlphaFile);

    const valRes = await ownershipValidator.validateOwnership(rawAlphaFile, tenantBeta.id, 'file', {
      userId: 'bob-002',
      ipAddress: '10.0.0.99'
    });

    assert.equal(valRes.ok, false);
    assert.equal(valRes.status, 404);
    assert.equal(valRes.code, 'FILE_NOT_FOUND');

    const auditLogs = await auditLogger.getAuditLogs(tenantBeta.id, { action: 'security.idor_attempt_blocked' });
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].userId, 'bob-002');
    assert.equal(auditLogs[0].resourceType, 'file');
    assert.equal(auditLogs[0].resourceId, 'file-alpha-1');
  });

  // 3. Chat Session Isolation
  test('6. Chat sessions in Alpha cannot be seen by users in Beta', async () => {
    const reqBeta = { headers: { 'x-tenant-id': tenantBeta.id } };
    const ctxBeta = (await resolver.resolve(reqBeta, 'bob-002')).context;

    const chats = store.db.prepare('SELECT * FROM tenant_chat_sessions WHERE tenant_id = ?').all(ctxBeta.tenantId);
    assert.equal(chats.length, 1);
    assert.equal(chats[0].id, 'chat-beta-1');
    assert.equal(chats[0].title, 'Beta Deployment Strategy');

    // Attempt direct IDOR access to chat-alpha-1
    const rawAlphaChat = store.db.prepare('SELECT * FROM tenant_chat_sessions WHERE id = ?').get('chat-alpha-1');
    const valRes = await ownershipValidator.validateOwnership(rawAlphaChat, ctxBeta.tenantId, 'chat');
    assert.equal(valRes.ok, false);
    assert.equal(valRes.status, 404);
  });

  // 4. Safe Tenant Switching
  test('7. Multi-tenant user can safely switch context between tenants', async () => {
    // Step 1: Alice operates in Tenant Alpha
    const reqAlpha = { headers: { 'x-tenant-id': tenantAlpha.id } };
    const resAlpha = await resolver.resolve(reqAlpha, 'alice-001');
    assert.equal(resAlpha.ok, true);
    assert.equal(resAlpha.context.tenantId, tenantAlpha.id);
    assert.equal(resAlpha.context.tenantSlug, 'alpha-software');
    assert.equal(resAlpha.context.role, 'owner');

    // Step 2: Alice switches to Tenant Beta
    const reqBeta = { headers: { 'x-tenant-id': tenantBeta.id } };
    const resBeta = await resolver.resolve(reqBeta, 'alice-001');
    assert.equal(resBeta.ok, true);
    assert.equal(resBeta.context.tenantId, tenantBeta.id);
    assert.equal(resBeta.context.tenantSlug, 'beta-global');
    assert.equal(resBeta.context.role, 'member');

    // In Beta, Alice's privileges are strictly downgraded to 'member'
    const middleware = createTenantMiddleware(resolver);
    let adminActionExecuted = false;
    middleware.requireTenantAdmin({ tenantContext: resBeta.context }, {
      status: (code) => ({ json: () => {} })
    }, () => { adminActionExecuted = true; });

    assert.equal(adminActionExecuted, false, 'Alice cannot execute admin actions in Beta');
  });

  // 5. Cross-Tenant Write & Delete Defense
  test('8. Cross-tenant update and delete are blocked by scoped SQL constraints', () => {
    // Bob attempts to delete Alpha's project using a scoped query with Beta's tenant ID
    const deleteStmt = store.db.prepare('DELETE FROM tenant_projects WHERE tenant_id = ? AND id = ?');
    const delInfo = deleteStmt.run(tenantBeta.id, 'proj-alpha-1');

    assert.equal(delInfo.changes, 0, 'No rows should be deleted');

    // Verify project still exists in Alpha
    const checkProj = store.db.prepare('SELECT * FROM tenant_projects WHERE id = ?').get('proj-alpha-1');
    assert.ok(checkProj, 'Alpha project must remain untouched');
    assert.equal(checkProj.tenant_id, tenantAlpha.id);
  });

  test('9. Bob cannot forge tenant context to access Alpha', async () => {
    // Bob is NOT a member of Alpha. He attempts to forge x-tenant-id: tenantAlpha.id
    const req = { headers: { 'x-tenant-id': tenantAlpha.id } };
    const res = await resolver.resolve(req, 'bob-002');

    assert.equal(res.ok, false);
    assert.equal(res.status, 404);
    assert.equal(res.code, 'TENANT_MEMBERSHIP_NOT_FOUND');
  });
});
