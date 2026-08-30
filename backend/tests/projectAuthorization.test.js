const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const projectAuth = require('../services/projectAuthorization');
const workspaceManager = require('../services/workspaceManager');
const ProjectDAO = require('../db/dao/ProjectDAO');
const ConversationDAO = require('../db/dao/ConversationDAO');
const MessageDAO = require('../db/dao/MessageDAO');

describe('Phase 1.2 — Milestone 3: Legacy API Route Delegation & SEC-001 Remediation Test Suite', () => {
  let testDb;
  let customAuth;
  let customWs;
  let projectDao;
  let conversationDao;
  let messageDao;

  before(() => {
    testDb = new Database(':memory:');
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');

    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    customAuth = new projectAuth.ProjectAuthorizationService(testDb);
    customWs = new workspaceManager.WorkspaceManager(testDb);
    projectDao = new ProjectDAO(testDb);
    conversationDao = new ConversationDAO(testDb);
    messageDao = new MessageDAO(testDb);
  });

  after(() => {
    if (testDb) {
      testDb.close();
    }
  });

  test('1. User Identity Resolution: Priority and Spoofing Prevention', () => {
    // 1. req.user has highest priority
    const req1 = { user: { id: 'alice' }, headers: { 'x-user-id': 'bob' }, body: { userId: 'mallory' } };
    assert.strictEqual(customAuth.resolveUser(req1), 'alice');

    // 2. req.headers['x-user-id'] is used when no session user
    const req2 = { headers: { 'x-user-id': 'bob' }, body: { userId: 'mallory' } };
    assert.strictEqual(customAuth.resolveUser(req2), 'bob');

    // 3. Fallback to local-user when no auth headers
    const req3 = { body: { userId: 'mallory' } };
    assert.strictEqual(customAuth.resolveUser(req3), 'local-user');

    // 4. req.body.userId is NEVER accepted as proof of identity
    const reqSpoof = { body: { userId: 'alice' } };
    assert.notStrictEqual(customAuth.resolveUser(reqSpoof), 'alice');
    assert.strictEqual(customAuth.resolveUser(reqSpoof), 'local-user');
  });

  test('2. Cross-User Project Access (SEC-001): Alice vs Bob', () => {
    const projAlice = `proj_alice_${Date.now()}`;
    const projBob = `proj_bob_${Date.now()}`;

    // Alice creates Project A
    customWs.ensureWorkspaceSync(projAlice, 'alice', { description: 'Alice Project' });
    // Bob creates Project B
    customWs.ensureWorkspaceSync(projBob, 'bob', { description: 'Bob Project' });

    // Alice accessing Project A -> ALLOW
    const authA1 = customAuth.authorize(projAlice, { headers: { 'x-user-id': 'alice' } });
    assert.strictEqual(authA1.authorized, true);
    assert.strictEqual(authA1.project.id, projAlice);

    // Bob accessing Project B -> ALLOW
    const authB1 = customAuth.authorize(projBob, { headers: { 'x-user-id': 'bob' } });
    assert.strictEqual(authB1.authorized, true);
    assert.strictEqual(authB1.project.id, projBob);

    // Alice accessing Project B -> 403 DENY
    const authA2 = customAuth.authorize(projBob, { headers: { 'x-user-id': 'alice' } });
    assert.strictEqual(authA2.authorized, false);
    assert.strictEqual(authA2.status, 403);
    assert.ok(authA2.error.includes('Access denied'));

    // Bob accessing Project A -> 403 DENY
    const authB2 = customAuth.authorize(projAlice, { headers: { 'x-user-id': 'bob' } });
    assert.strictEqual(authB2.authorized, false);
    assert.strictEqual(authB2.status, 403);
    assert.ok(authB2.error.includes('Access denied'));

    try {
      fs.rmSync(customWs.getWorkspacePath(projAlice), { recursive: true, force: true });
      fs.rmSync(customWs.getWorkspacePath(projBob), { recursive: true, force: true });
    } catch (_) {}
  });

  test('3. Cross-User Project Mutation & Deletion Protection', () => {
    const projId = `proj_mut_${Date.now()}`;
    customWs.ensureWorkspaceSync(projId, 'alice');

    // Mallory tries to delete Alice project
    const malloryReq = { headers: { 'x-user-id': 'mallory' } };
    const auth = customAuth.authorize(projId, malloryReq);
    assert.strictEqual(auth.authorized, false);
    assert.strictEqual(auth.status, 403);

    // Verify project still exists in DB
    const p = projectDao.getById(projId);
    assert.ok(p);
    assert.strictEqual(p.user_id, 'alice');

    try {
      fs.rmSync(customWs.getWorkspacePath(projId), { recursive: true, force: true });
    } catch (_) {}
  });

  test('4. Cross-Project Chat / Conversation Isolation', () => {
    const projAlice = `proj_chat_a_${Date.now()}`;
    const projBob = `proj_chat_b_${Date.now()}`;

    customWs.ensureWorkspaceSync(projAlice, 'alice');
    customWs.ensureWorkspaceSync(projBob, 'bob');

    const convAlice = conversationDao.create({
      id: `conv_alice_${Date.now()}`,
      projectId: projAlice,
      userId: 'alice',
      title: 'Secret Alice Chat',
      surface: 'chat'
    });

    // Alice access -> ALLOW
    assert.strictEqual(convAlice.user_id, 'alice');
    assert.strictEqual(convAlice.project_id, projAlice);

    // Bob tries to query Alice conversation
    const bobLookup = conversationDao.getById(convAlice.id, projBob);
    assert.strictEqual(bobLookup, null, 'Bob querying Project B must not see Alice Project A conversation');
  });

  test('5. Spoofed Body userId Rejection', () => {
    const projTarget = `proj_spoof_${Date.now()}`;
    customWs.ensureWorkspaceSync(projTarget, 'alice');

    // Mallory passes headers x-user-id: mallory with body { userId: "alice" }
    const spoofReq = {
      headers: { 'x-user-id': 'mallory' },
      body: { userId: 'alice', user_id: 'alice' }
    };

    const auth = customAuth.authorize(projTarget, spoofReq);
    assert.strictEqual(auth.authorized, false);
    assert.strictEqual(auth.status, 403);
    assert.strictEqual(auth.user.id, 'mallory'); // Must remain mallory!

    try {
      fs.rmSync(customWs.getWorkspacePath(projTarget), { recursive: true, force: true });
    } catch (_) {}
  });

  test('6. Nonexistent Project Returns 404', () => {
    const auth = customAuth.authorize('non_existent_proj_12345', { headers: { 'x-user-id': 'alice' } });
    assert.strictEqual(auth.authorized, false);
    assert.strictEqual(auth.status, 404);
    assert.ok(auth.error.includes('not found'));
  });

  test('7. Shared / Default Project is Accessible to All Users', () => {
    const authAlice = customAuth.authorize('default', { headers: { 'x-user-id': 'alice' } }, { autoCreateIfMissing: true });
    assert.strictEqual(authAlice.authorized, true);

    const authBob = customAuth.authorize('default', { headers: { 'x-user-id': 'bob' } });
    assert.strictEqual(authBob.authorized, true);
  });
});
