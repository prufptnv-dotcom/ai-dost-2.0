const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');

const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const LegacyMigrator = require('../db/legacyMigrator');
const UserDAO = require('../db/dao/UserDAO');
const ProjectDAO = require('../db/dao/ProjectDAO');
const WorkspaceDAO = require('../db/dao/WorkspaceDAO');
const ConversationDAO = require('../db/dao/ConversationDAO');
const MessageDAO = require('../db/dao/MessageDAO');
const ArtifactDAO = require('../db/dao/ArtifactDAO');
const ContextNodeDAO = require('../db/dao/ContextNodeDAO');
const ContextEdgeDAO = require('../db/dao/ContextEdgeDAO');
const projectService = require('../services/projectService');

describe('Phase 1.1 — Universal Project Store & Unified Context Foundation Test Suite', () => {
  let testDbPath;
  let testDb;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `test-ups-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    testDb = new Database(testDbPath);
    testDb.pragma('journal_mode = WAL');
    testDb.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    if (testDb) {
      testDb.close();
    }
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch (_) {}
  });

  test('1. Fresh Database Migration & Version Tracking', () => {
    const runner = new MigrationRunner(testDb);
    const count = runner.runAll([migration001]);
    assert.strictEqual(count, 1, 'Should apply exactly 1 migration on fresh DB');

    const versions = testDb.prepare('SELECT * FROM _schema_migrations').all();
    assert.strictEqual(versions.length, 1);
    assert.strictEqual(versions[0].version, 1);
    assert.strictEqual(versions[0].name, '001_universal_project_store_schema');
  });

  test('2. Migration Idempotency & Duplicate Run Safety', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);
    const secondRun = runner.runAll([migration001]);
    assert.strictEqual(secondRun, 0, 'Second migration run must be a no-op');

    const versions = testDb.prepare('SELECT * FROM _schema_migrations').all();
    assert.strictEqual(versions.length, 1);
  });

  test('3. WAL Mode and Foreign Keys Invariants Enforcement', () => {
    const journalMode = testDb.pragma('journal_mode', { simple: true });
    assert.strictEqual(journalMode.toLowerCase(), 'wal', 'WAL mode must be active');

    const fk = testDb.pragma('foreign_keys', { simple: true });
    assert.strictEqual(fk, 1, 'Foreign keys pragma must be active');
  });

  test('4. Default local-user and default Copilot Workspace Seed', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const userDAO = new UserDAO(testDb);
    const defaultUser = userDAO.getById('local-user');
    assert.ok(defaultUser, 'local-user must exist');
    assert.strictEqual(defaultUser.username, 'local-user');

    const projectDAO = new ProjectDAO(testDb);
    const defaultProj = projectDAO.getById('default');
    assert.ok(defaultProj, 'default project must exist');
    assert.strictEqual(defaultProj.name, 'Copilot Workspace');

    const wsDAO = new WorkspaceDAO(testDb);
    const defaultWs = wsDAO.getByProjectId('default');
    assert.ok(defaultWs, 'default workspace binding must exist');
    assert.ok(defaultWs.disk_path.includes('agent-ws-default'));
  });

  test('5. Project DAO CRUD & Slug Generation', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const projectDAO = new ProjectDAO(testDb);
    const proj = projectDAO.create({
      id: 'proj_alpha',
      userId: 'local-user',
      name: 'Alpha Fintech App',
      description: 'Banking Dashboard',
      framework: 'react-vite',
      settings: { port: 8801 }
    });

    assert.strictEqual(proj.id, 'proj_alpha');
    assert.strictEqual(proj.slug, 'alpha-fintech-app');
    assert.strictEqual(proj.framework, 'react-vite');

    // Update
    const updated = projectDAO.update('proj_alpha', { description: 'Updated Dashboard' });
    assert.strictEqual(updated.description, 'Updated Dashboard');

    // List
    const all = projectDAO.list('local-user');
    assert.ok(all.some(p => p.id === 'proj_alpha'));

    // Delete
    const deleted = projectDAO.delete('proj_alpha');
    assert.strictEqual(deleted, true);
    assert.strictEqual(projectDAO.getById('proj_alpha'), null);
  });

  test('6. Foreign Key Cascade Deletions (Project -> Workspace/Conversation/Artifact)', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const projectDAO = new ProjectDAO(testDb);
    const wsDAO = new WorkspaceDAO(testDb);
    const convDAO = new ConversationDAO(testDb);
    const artDAO = new ArtifactDAO(testDb);

    projectDAO.create({ id: 'proj_cascade', name: 'Cascade Test' });
    wsDAO.create({ id: 'ws_cascade', projectId: 'proj_cascade', diskPath: 'C:\\tmp\\ws' });
    convDAO.create({ id: 'conv_cascade', projectId: 'proj_cascade', title: 'Test Conv' });
    artDAO.create({
      id: 'art_cascade',
      projectId: 'proj_cascade',
      name: 'Report.pdf',
      type: 'document_pdf',
      mimeType: 'application/pdf',
      storagePath: '/downloads/report.pdf'
    });

    // Delete parent project
    projectDAO.delete('proj_cascade');

    // Check cascades
    assert.strictEqual(wsDAO.getById('ws_cascade'), null, 'Workspace must cascade delete');
    assert.strictEqual(convDAO.getById('conv_cascade'), null, 'Conversation must cascade delete');
    assert.strictEqual(artDAO.getById('art_cascade'), null, 'Artifact must cascade delete');
  });

  test('7. Foreign Key Rejection on Orphaned Inserts', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const wsDAO = new WorkspaceDAO(testDb);
    assert.throws(() => {
      wsDAO.create({
        id: 'ws_orphan',
        projectId: 'non_existent_project_id',
        diskPath: 'C:\\tmp\\orphan'
      });
    }, /FOREIGN KEY constraint failed/);
  });

  test('8. Canonical Project Resolver (projectService.resolveProject)', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const svc = new projectService.ProjectService(testDb);

    // Explicit valid project
    const resA = svc.resolveProject('my-cool-project');
    assert.strictEqual(resA.project.id, 'my-cool-project');
    assert.strictEqual(resA.workspace.project_id, 'my-cool-project');
    assert.ok(resA.workspace.disk_path.includes('agent-ws-my-cool-project'));

    // Missing / null project -> resolves to 'default'
    const resDefault = svc.resolveProject(null);
    assert.strictEqual(resDefault.project.id, 'default');
    assert.strictEqual(resDefault.workspace.project_id, 'default');
  });

  test('9. Unified Conversation & Message Persistence with Latency Tracking', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const convDAO = new ConversationDAO(testDb);
    const msgDAO = new MessageDAO(testDb);

    const conv = convDAO.create({
      id: 'conv_101',
      projectId: 'default',
      title: 'Full Stack Build Discussion',
      surface: 'copilot'
    });
    assert.strictEqual(conv.id, 'conv_101');

    msgDAO.create({
      id: 'msg_001',
      conversationId: 'conv_101',
      role: 'user',
      content: 'Generate a full-stack weather app'
    });

    msgDAO.create({
      id: 'msg_002',
      conversationId: 'conv_101',
      role: 'assistant',
      content: 'Planning project architecture...',
      model: 'gemini-1.5-flash',
      tokensUsed: 450,
      latencyMs: 1200,
      attachments: [{ name: 'plan.md', type: 'spec' }]
    });

    const messages = msgDAO.listByConversation('conv_101');
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[1].role, 'assistant');
    assert.strictEqual(messages[1].model, 'gemini-1.5-flash');
    assert.strictEqual(messages[1].tokens_used, 450);
  });

  test('10. Artifact Registry Persistence & SHA256 Integrity', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const artDAO = new ArtifactDAO(testDb);
    const art = artDAO.create({
      id: 'art_doc_99',
      projectId: 'default',
      name: 'Q3_Financial_Summary.docx',
      type: 'document_docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storagePath: '/downloads/doc-abc123.docx',
      sizeBytes: 45200,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      metadata: { pages: 5, topic: 'Q3 Financials' }
    });

    assert.strictEqual(art.id, 'art_doc_99');
    assert.strictEqual(art.type, 'document_docx');
    assert.strictEqual(art.size_bytes, 45200);

    const list = artDAO.listByProject('default', 'document_docx');
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, 'art_doc_99');
  });

  test('11. Context Graph Nodes and Typed Edge Relationships', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const nodeDAO = new ContextNodeDAO(testDb);
    const edgeDAO = new ContextEdgeDAO(testDb);

    const node1 = nodeDAO.create({
      id: 'node_file_app',
      projectId: 'default',
      nodeType: 'FILE',
      title: 'App.jsx',
      contentSummary: 'Main React application component'
    });

    const node2 = nodeDAO.create({
      id: 'node_doc_spec',
      projectId: 'default',
      nodeType: 'DECISION',
      title: 'Architecture Decision',
      contentSummary: 'Use Vite bundler and Tailwind CSS'
    });

    const edge = edgeDAO.create({
      id: 'edge_01',
      projectId: 'default',
      sourceNodeId: node1.id,
      targetNodeId: node2.id,
      relationType: 'IMPLEMENTS',
      weight: 1.0
    });

    assert.strictEqual(edge.relation_type, 'IMPLEMENTS');
    const edgesForApp = edgeDAO.listByNode(node1.id);
    assert.strictEqual(edgesForApp.length, 1);
    assert.strictEqual(edgesForApp[0].id, 'edge_01');
  });

  test('12. Transaction Rollback Safety on Mid-Batch Errors', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const projectDAO = new ProjectDAO(testDb);
    const wsDAO = new WorkspaceDAO(testDb);

    try {
      const tx = testDb.transaction(() => {
        projectDAO.create({ id: 'proj_tx_test', name: 'Tx Test' });
        // Trigger intentional FK failure
        testDb.prepare('INSERT INTO workspaces (id, project_id, disk_path) VALUES (?, ?, ?)')
          .run('ws_bad', 'non_existent_pid_error', 'C:\\bad');
      });
      tx();
    } catch (err) {
      // expected error
    }

    assert.strictEqual(projectDAO.getById('proj_tx_test'), null, 'Project creation must be rolled back');
  });

  test('13. SQL Injection Resistance on User-Supplied IDs & Content', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const projectDAO = new ProjectDAO(testDb);
    const maliciousId = "proj_test'; DROP TABLE projects; --";
    const maliciousName = "Evil Name'); DROP TABLE users; --";

    const proj = projectDAO.create({
      id: maliciousId,
      name: maliciousName
    });

    assert.strictEqual(proj.id, maliciousId);
    assert.strictEqual(proj.name, maliciousName);

    // Verify tables are intact
    const checkProjects = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").get();
    const checkUsers = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    assert.ok(checkProjects, 'projects table must still exist');
    assert.ok(checkUsers, 'users table must still exist');
  });

  test('14. Legacy Data Migration (chat_history, resumes, projects)', () => {
    // Seed legacy schema tables before migration
    testDb.exec(`
      CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, description TEXT, created_at TEXT, status TEXT);
      CREATE TABLE IF NOT EXISTS chat_history (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT, content TEXT, timestamp TEXT);
      CREATE TABLE IF NOT EXISTS resumes (id INTEGER PRIMARY KEY AUTOINCREMENT, prompt TEXT, json_data TEXT, created_at TEXT);
    `);

    testDb.prepare("INSERT INTO projects VALUES ('legacy_p1', 'Legacy App', 'Old Project', datetime('now'), 'Active')").run();
    testDb.prepare("INSERT INTO chat_history (session_id, role, content) VALUES ('sess_99', 'user', 'Legacy question')").run();
    testDb.prepare("INSERT INTO resumes (prompt, json_data) VALUES ('Software Engineer', '{\"name\":\"Vikash\"}')").run();

    // Run Migration & Legacy Migrator
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const migrator = new LegacyMigrator(testDb);
    const stats = migrator.migrateAll();

    assert.ok(stats.projectsMapped >= 1);
    assert.ok(stats.chatMessagesMigrated >= 1);
    assert.ok(stats.resumesMappedToArtifacts >= 1);

    // Verify conversation was created
    const convDAO = new ConversationDAO(testDb);
    const conv = convDAO.getById('legacy_conv_sess_99');
    assert.ok(conv, 'Legacy conversation must exist');

    // Verify messages exist
    const msgDAO = new MessageDAO(testDb);
    const msgs = msgDAO.listByConversation('legacy_conv_sess_99');
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].content, 'Legacy question');

    // Verify resume artifact exists
    const artDAO = new ArtifactDAO(testDb);
    const resumeArt = artDAO.getById('legacy_resume_1');
    assert.ok(resumeArt, 'Resume artifact must exist');
    assert.strictEqual(resumeArt.type, 'resume_data');
  });

  test('15. Cross-Project Data Isolation', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const projectDAO = new ProjectDAO(testDb);
    const convDAO = new ConversationDAO(testDb);
    const artDAO = new ArtifactDAO(testDb);

    projectDAO.create({ id: 'proj_team_a', name: 'Team A Project' });
    projectDAO.create({ id: 'proj_team_b', name: 'Team B Project' });

    convDAO.create({ id: 'conv_a', projectId: 'proj_team_a', title: 'Team A Secret Chat' });
    artDAO.create({
      id: 'art_a',
      projectId: 'proj_team_a',
      name: 'Secret_Doc.docx',
      type: 'document_docx',
      mimeType: 'application/docx',
      storagePath: '/downloads/secret.docx'
    });

    // Verification: Querying under Project B returns zero items from Project A
    const bConversations = convDAO.listByProject('proj_team_b');
    assert.strictEqual(bConversations.length, 0);

    const bArtifacts = artDAO.listByProject('proj_team_b');
    assert.strictEqual(bArtifacts.length, 0);

    const crossAccessConv = convDAO.getById('conv_a', 'proj_team_b');
    assert.strictEqual(crossAccessConv, null, 'Cross-project conversation access must return null');

    const crossAccessArt = artDAO.getById('art_a', 'proj_team_b');
    assert.strictEqual(crossAccessArt, null, 'Cross-project artifact access must return null');
  });

  test('16. Unified Project Context Hydrator (getProjectContext)', () => {
    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    const svc = new projectService.ProjectService(testDb);
    const { project } = svc.resolveProject('proj_hydrated');
    svc.conversations.create({ id: 'conv_hyd', projectId: 'proj_hydrated', title: 'Hydrated Chat' });
    svc.artifacts.create({
      id: 'art_hyd',
      projectId: 'proj_hydrated',
      name: 'Hydrated_Doc.pdf',
      type: 'document_pdf',
      mimeType: 'application/pdf',
      storagePath: '/downloads/hydrated.pdf'
    });
    svc.contextNodes.create({
      id: 'node_hyd',
      projectId: 'proj_hydrated',
      nodeType: 'FILE',
      title: 'index.js'
    });

    const ctx = svc.getProjectContext('proj_hydrated');
    assert.ok(ctx.project);
    assert.strictEqual(ctx.project.id, 'proj_hydrated');
    assert.ok(ctx.workspace);
    assert.strictEqual(ctx.conversations.length, 1);
    assert.strictEqual(ctx.artifacts.length, 1);
    assert.strictEqual(ctx.contextGraph.nodes.length, 1);
  });
});
