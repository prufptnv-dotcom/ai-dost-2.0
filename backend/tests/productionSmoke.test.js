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
const ConversationDAO = require('../db/dao/ConversationDAO');
const MessageDAO = require('../db/dao/MessageDAO');
const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');
const AgentHandoffDAO = require('../db/dao/AgentHandoffDAO');
const ArtifactDAO = require('../db/dao/ArtifactDAO');

const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const { RetrievalService } = require('../services/retrievalService');

describe('AI-Dost v2.0: Minimal Production Release Smoke Suite', () => {
  let db;
  let testDbPath;
  let testWorkspaceRoot;
  let workspaceManager;
  let authService;

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-smoke-'));
    testDbPath = path.join(tempDir, 'smoke.db');
    testWorkspaceRoot = path.join(tempDir, 'workspaces');
    fs.mkdirSync(testWorkspaceRoot, { recursive: true });

    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const runner = new MigrationRunner(db);
    runner.runAll([
      migration001,
      { version: 2, name: '002_agent_runtime', up: migration002.up },
      migration003,
      migration004
    ]);

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

  test('1. Database schema and migration version invariants', () => {
    const journalMode = db.pragma('journal_mode', { simple: true });
    assert.equal(journalMode.toLowerCase(), 'wal');

    const fk = db.pragma('foreign_keys', { simple: true });
    assert.equal(fk, 1);

    const rows = db.prepare('SELECT version FROM _schema_migrations ORDER BY version ASC').all();
    assert.deepEqual(rows.map(r => r.version), [1, 2, 3, 4]);
  });

  test('2. Project creation, conversation, and message storage', () => {
    const userDAO = new UserDAO(db);
    const projDAO = new ProjectDAO(db);
    const convDAO = new ConversationDAO(db);
    const msgDAO = new MessageDAO(db);

    userDAO.create({ id: 'smoke-user', username: 'smoke-user' });
    const project = projDAO.create({ id: 'smoke-project', userId: 'smoke-user', name: 'Smoke Test Project', slug: 'smoke-test' });
    assert.equal(project.id, 'smoke-project');

    const conv = convDAO.create({ id: 'smoke-conv-1', projectId: 'smoke-project', title: 'Release Verification' });
    assert.equal(conv.title, 'Release Verification');

    const msg = msgDAO.create({ id: 'smoke-msg-1', conversationId: 'smoke-conv-1', role: 'user', content: 'Build release candidate' });
    assert.equal(msg.content, 'Build release candidate');
  });

  test('3. Agent task, execution run, and supervisor handoff recording', () => {
    const userDAO = new UserDAO(db);
    const projDAO = new ProjectDAO(db);
    const taskDAO = new AgentTaskDAO(db);
    const runDAO = new AgentRunDAO(db);
    const handoffDAO = new AgentHandoffDAO(db);

    userDAO.create({ id: 'u-smoke', username: 'u-smoke' });
    projDAO.create({ id: 'p-smoke', userId: 'u-smoke', name: 'P Smoke', slug: 'p-smoke' });
    
    const task = taskDAO.create({ id: 't-smoke-1', projectId: 'p-smoke', title: 'Verify release smoke', type: 'feature', status: 'RUNNING' });
    const run = runDAO.create({ id: 'r-smoke-1', taskId: 't-smoke-1', status: 'RUNNING' });
    
    const handoff = handoffDAO.create({
      id: 'hnd-smoke-1',
      taskId: 't-smoke-1',
      sourceRunId: 'r-smoke-1',
      sourceAgent: 'supervisor',
      targetAgent: 'coder',
      objective: 'Scaffold application structure',
      status: 'ACTIVE'
    });

    assert.equal(task.id, 't-smoke-1');
    assert.equal(run.id, 'r-smoke-1');
    assert.equal(handoff.target_agent, 'coder');
  });

  test('4. Artifact registration, SHA256 integrity and storage path', () => {
    const userDAO = new UserDAO(db);
    const projDAO = new ProjectDAO(db);
    const artDAO = new ArtifactDAO(db);

    userDAO.create({ id: 'u-art', username: 'u-art' });
    projDAO.create({ id: 'p-art', userId: 'u-art', name: 'Artifact Proj', slug: 'art-proj' });

    const artifact = artDAO.create({
      id: 'art-smoke-1',
      projectId: 'p-art',
      name: 'Release_Notes.docx',
      type: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storagePath: '/downloads/Release_Notes.docx',
      sizeBytes: 15420,
      sha256: '5a8f2e1a4b9c'
    });

    assert.equal(artifact.name, 'Release_Notes.docx');
    assert.equal(artifact.size_bytes, 15420);
  });

  test('5. Workspace boundary defense and RAG fallback behavior', async () => {
    const pId = 'p-boundary';
    const wsPath = workspaceManager.getWorkspacePath(pId, 'local-user');
    fs.mkdirSync(wsPath, { recursive: true });

    // Path traversal must fail
    assert.throws(
      () => workspaceManager.resolvePath(pId, '../../../../etc/passwd', 'local-user'),
      (err) => err.code === 'ERR_PATH_TRAVERSAL'
    );

    // Safe path must succeed
    const safeResolved = workspaceManager.resolvePath(pId, 'src/main.js', 'local-user');
    assert.ok(safeResolved.includes('agent-ws-p-boundary'));

    // RAG fallback when python service offline
    const retrieval = new RetrievalService();
    retrieval.apiClient = {
      post: async () => { throw new Error('ECONNREFUSED'); }
    };

    await assert.rejects(
      retrieval.search({ userId: 'local-user', projectId: pId, query: 'find entry point' }),
      /INDEX_UNAVAILABLE/
    );
  });
});
