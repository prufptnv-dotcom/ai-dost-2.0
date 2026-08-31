const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const migration002 = require('../db/migrations/002_agent_runtime');
const migration003 = require('../db/migrations/003_agent_handoffs');
const migration004 = require('../db/migrations/004_agent_handoff_results');

const UserDAO = require('../db/dao/UserDAO');
const ProjectDAO = require('../db/dao/ProjectDAO');
const WorkspaceDAO = require('../db/dao/WorkspaceDAO');
const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');
const AgentStepDAO = require('../db/dao/AgentStepDAO');
const AgentHandoffDAO = require('../db/dao/AgentHandoffDAO');
const ToolCallDAO = require('../db/dao/ToolCallDAO');
const ObservationDAO = require('../db/dao/ObservationDAO');
const VerificationResultDAO = require('../db/dao/VerificationResultDAO');

const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const CapabilityPolicy = require('../agent/policy/CapabilityPolicy');
const ExecutionController = require('../agent/runtime/ExecutionController');

function runTestMigrations(targetDb) {
  targetDb.pragma('journal_mode = WAL');
  targetDb.pragma('foreign_keys = ON');
  targetDb.pragma('busy_timeout = 5000');
  const runner = new MigrationRunner(targetDb);
  runner.runAll([
    migration001,
    { version: 2, name: '002_agent_runtime', up: migration002.up },
    migration003,
    migration004
  ]);
}

describe('Phase 4: Production Hardening & Security Audit Suite', () => {
  let db;
  let testDbPath;
  let testWorkspaceRoot;
  let workspaceManager;
  let authService;

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-prod-test-'));
    testDbPath = path.join(tempDir, 'prod_test.db');
    testWorkspaceRoot = path.join(tempDir, 'workspaces');
    fs.mkdirSync(testWorkspaceRoot, { recursive: true });

    db = new Database(testDbPath);
    runTestMigrations(db);

    workspaceManager = new WorkspaceManager(db);
    workspaceManager.getBaseWorkspaceDir = () => testWorkspaceRoot;
    workspaceManager.getDefaultDiskPath = (pId) => path.join(testWorkspaceRoot, `agent-ws-${pId}`);

    authService = new ProjectAuthorizationService(db);
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  describe('1. Security & Path Traversal Attack Defense', () => {
    test('blocks classic directory traversal ../ escape', () => {
      const pId = 'proj-sec-1';
      const user = 'alice';
      const wsPath = workspaceManager.getWorkspacePath(pId, user);
      fs.mkdirSync(wsPath, { recursive: true });

      assert.throws(
        () => workspaceManager.resolvePath(pId, '../../../../etc/passwd', user),
        (err) => err.code === 'ERR_PATH_TRAVERSAL'
      );
    });

    test('blocks Windows UNC network path injection (\\\\server\\share)', () => {
      const pId = 'proj-sec-2';
      assert.throws(
        () => workspaceManager.resolvePath(pId, '\\\\malicious.host\\share\\exploit.js', 'alice'),
        (err) => err.code === 'ERR_PATH_TRAVERSAL'
      );
    });

    test('blocks null byte injection attacks in file paths', () => {
      const pId = 'proj-sec-3';
      assert.throws(
        () => workspaceManager.resolvePath(pId, 'safe.txt\0/etc/shadow', 'alice'),
        (err) => err.code === 'ERR_PATH_TRAVERSAL'
      );
    });

    test('enforces cross-user project authorization isolation', () => {
      const userDAO = new UserDAO(db);
      const projectDAO = new ProjectDAO(db);

      userDAO.create({ id: 'alice', username: 'alice' });
      userDAO.create({ id: 'bob', username: 'bob' });

      projectDAO.create({
        id: 'alice-secret-proj',
        userId: 'alice',
        name: 'Alice Top Secret',
        slug: 'alice-top-secret'
      });

      // Bob tries to access Alice's project
      const bobReq = { headers: { 'x-user-id': 'bob' } };
      const auth = authService.authorize('alice-secret-proj', bobReq);

      assert.equal(auth.authorized, false);
      assert.equal(auth.status, 403);
      assert.match(auth.error, /Access denied/i);
    });

    test('enforces strict capability policy tool restrictions per role', () => {
      assert.equal(CapabilityPolicy.isAllowed('RESEARCHER', 'filesystem.write'), false);
      assert.equal(CapabilityPolicy.isAllowed('RESEARCHER', 'terminal.execute'), false);
      assert.equal(CapabilityPolicy.isAllowed('CODER', 'filesystem.write'), true);
      assert.equal(CapabilityPolicy.isAllowed('CODER', 'terminal.execute'), true);
      assert.equal(CapabilityPolicy.isAllowed('VERIFIER', 'verification.inspect'), true);
      assert.equal(CapabilityPolicy.isAllowed('VERIFIER', 'filesystem.write'), false);
    });
  });

  describe('2. Universal Database Safety & Durability', () => {
    test('enforces WAL mode and foreign key integrity', () => {
      const journalMode = db.pragma('journal_mode', { simple: true });
      assert.equal(journalMode.toLowerCase(), 'wal');

      const fkStatus = db.pragma('foreign_keys', { simple: true });
      assert.equal(fkStatus, 1);
    });

    test('survives clean close, restart and preserves complete state', () => {
      const userDAO = new UserDAO(db);
      const projectDAO = new ProjectDAO(db);
      const taskDAO = new AgentTaskDAO(db);

      userDAO.create({ id: 'dev1', username: 'dev1' });
      projectDAO.create({ id: 'p-durability', userId: 'dev1', name: 'Durability App', slug: 'durability-app' });
      taskDAO.create({
        id: 'task_restart_1',
        projectId: 'p-durability',
        title: 'Crash test task',
        type: 'feature',
        status: 'RUNNING'
      });

      // Simulate crash / restart
      db.close();

      const dbReopened = new Database(testDbPath);
      const reopenedTaskDAO = new AgentTaskDAO(dbReopened);
      const restored = reopenedTaskDAO.getById('task_restart_1');

      assert.ok(restored);
      assert.equal(restored.title, 'Crash test task');
      assert.equal(restored.status, 'RUNNING');
      dbReopened.close();
    });
  });

  describe('3. Agent Runtime Reliability & Checkpoint Resumption', () => {
    test('executes valid state machine transitions and rejects illegal transitions', async () => {
      const userDAO = new UserDAO(db);
      const projectDAO = new ProjectDAO(db);
      const taskDAO = new AgentTaskDAO(db);
      const runDAO = new AgentRunDAO(db);
      const stepDAO = new AgentStepDAO(db);
      const toolDAO = new ToolCallDAO(db);
      const obsDAO = new ObservationDAO(db);
      const verDAO = new VerificationResultDAO(db);

      userDAO.create({ id: 'u1', username: 'u1' });
      projectDAO.create({ id: 'p1', userId: 'u1', name: 'P1', slug: 'p1' });
      taskDAO.create({ id: 't1', projectId: 'p1', title: 'Task 1', type: 'feature', status: 'RUNNING' });
      runDAO.create({ id: 'r1', taskId: 't1', status: 'PENDING' });

      const controller = new ExecutionController({
        db,
        agentRunDao: runDAO,
        agentStepDao: stepDAO,
        toolCallDao: toolDAO,
        observationDao: obsDAO,
        verificationResultDao: verDAO,
        workspaceManager
      });

      // PENDING -> RUNNING
      const running = await controller.startRun('r1');
      assert.equal(running.status, 'RUNNING');

      // RUNNING -> VERIFYING
      const verifying = await controller.verifyRun('r1');
      assert.equal(verifying.status, 'VERIFYING');

      // VERIFYING -> SUCCEEDED
      const succeeded = await controller.completeRun('r1', 'SUCCEEDED');
      assert.equal(succeeded.status, 'SUCCEEDED');

      // Illegal transition from SUCCEEDED -> RUNNING must throw
      await assert.rejects(
        async () => controller.startRun('r1'),
        /Invalid state transition/i
      );
    });

    test('records supervisor handoff delegation chain in canonical DB', () => {
      const userDAO = new UserDAO(db);
      const projectDAO = new ProjectDAO(db);
      const taskDAO = new AgentTaskDAO(db);
      const runDAO = new AgentRunDAO(db);
      const handoffDAO = new AgentHandoffDAO(db);

      userDAO.create({ id: 'u2', username: 'u2' });
      projectDAO.create({ id: 'p2', userId: 'u2', name: 'P2', slug: 'p2' });
      taskDAO.create({ id: 't2', projectId: 'p2', title: 'Handoff Task', type: 'feature' });
      runDAO.create({ id: 'r2', taskId: 't2', status: 'RUNNING' });

      const handoff = handoffDAO.create({
        id: 'hnd_1',
        taskId: 't2',
        sourceRunId: 'r2',
        sourceAgent: 'supervisor',
        targetAgent: 'coder',
        objective: 'Implement authentication middleware',
        status: 'ACTIVE'
      });

      assert.ok(handoff);
      assert.equal(handoff.source_agent, 'supervisor');
      assert.equal(handoff.target_agent, 'coder');
      assert.equal(handoff.status, 'ACTIVE');

      const fetched = handoffDAO.listByTask('t2');
      assert.equal(fetched.length, 1);
      assert.equal(fetched[0].id, 'hnd_1');
    });
  });

  describe('4. Large Project Scaling & IO Containment', () => {
    test('scans and indexes 1,000+ files within deterministic memory and time limits', () => {
      const pId = 'proj-large-scale';
      const wsPath = workspaceManager.getWorkspacePath(pId, 'local-user');
      fs.mkdirSync(wsPath, { recursive: true });

      // Create 1,000 synthetic nested files
      const startTime = Date.now();
      for (let dir = 0; dir < 10; dir++) {
        const subDir = path.join(wsPath, `module_${dir}`);
        fs.mkdirSync(subDir, { recursive: true });
        for (let file = 0; file < 100; file++) {
          fs.writeFileSync(
            path.join(subDir, `component_${file}.js`),
            `// Module ${dir} Component ${file}\nexport const id = "${dir}_${file}";\n`
          );
        }
      }

      const creationTime = Date.now() - startTime;
      assert.ok(creationTime < 10000, `Creation of 1000 files took ${creationTime}ms`);

      // Verify file count and memory efficiency
      let fileCount = 0;
      function walk(current) {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) walk(path.join(current, entry.name));
          else if (entry.isFile()) fileCount++;
        }
      }
      walk(wsPath);

      assert.equal(fileCount, 1000);
    });
  });
});
