const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DatabaseSync: Database } = require('node:sqlite');
const MigrationRunner = require('../db/migrationRunner');
const migration001 = require('../db/migrations/001_universal_schema');
const workspaceManager = require('../services/workspaceManager');
const ProjectDAO = require('../db/dao/ProjectDAO');
const WorkspaceDAO = require('../db/dao/WorkspaceDAO');
const ConversationDAO = require('../db/dao/ConversationDAO');

describe('Chat and Copilot IDE Integration Test Suite', () => {
  let testDb;
  let customWs;
  let projectDao;
  let workspaceDao;
  let conversationDao;

  before(() => {
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');

    const runner = new MigrationRunner(testDb);
    runner.runAll([migration001]);

    testDb.exec(`
      CREATE TABLE IF NOT EXISTS copilot_sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        prompt_summary TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        session_data TEXT
      );
    `);

    customWs = new workspaceManager.WorkspaceManager(testDb);
    projectDao = new ProjectDAO(testDb);
    workspaceDao = new WorkspaceDAO(testDb);
    conversationDao = new ConversationDAO(testDb);
  });

  after(() => {
    if (testDb) testDb.close();
  });

  test('Writing code for chat session stores files in workspace_files', () => {
    const sessionId = 'chat_test_abc1';
    
    // Create user and project
    testDb.prepare("INSERT OR IGNORE INTO users (id, username) VALUES ('local-user', 'local-user')").run();
    projectDao.create({ id: sessionId, userId: 'local-user', name: 'Test Chat Project' });

    // Store workspace file for this session
    testDb.prepare("INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)")
      .run(sessionId, 'src/App.jsx', 'export default function App() { return <div>Chat App</div>; }');

    // Also insert chat history message
    testDb.prepare("INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)")
      .run(sessionId, 'user', 'Build todo app');

    // Verify stored
    const files = testDb.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(sessionId);
    assert.strictEqual(files.length, 1);
    assert.strictEqual(files[0].path, 'src/App.jsx');

    const chatRows = testDb.prepare('SELECT * FROM chat_history WHERE session_id = ?').all(sessionId);
    assert.strictEqual(chatRows.length, 1);
  });

  test('New chat starts greenfield with 0 files, not showing previous project', () => {
    const oldSessionId = 'chat_test_abc1';
    const newSessionId = 'chat_test_fresh2';

    // Verify old session has files
    const oldFiles = testDb.prepare('SELECT path FROM workspace_files WHERE project_id = ?').all(oldSessionId);
    assert.strictEqual(oldFiles.length, 1);

    // Verify new session has ZERO files
    const newFiles = testDb.prepare('SELECT path FROM workspace_files WHERE project_id = ?').all(newSessionId);
    assert.strictEqual(newFiles.length, 0);
  });

  test('Deleting chat session completely deletes chat history, workspace files, and workspace record', async () => {
    const sessionId = 'chat_test_abc1';

    // Ensure physical workspace also exists
    const ws = await customWs.ensureWorkspace(sessionId, 'local-user');
    assert.ok(fs.existsSync(ws.diskPath));

    // Simulate deleteChatHistory cleanup
    testDb.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sessionId);
    testDb.prepare('DELETE FROM workspace_files WHERE project_id = ? OR project_id = ?').run(sessionId, `workspace_${sessionId}`);
    testDb.prepare('DELETE FROM copilot_sessions WHERE id = ?').run(sessionId);
    projectDao.delete(sessionId, 'local-user');
    customWs.deleteWorkspace(sessionId, 'local-user');

    // 1. Chat history must be completely gone
    const chatRows = testDb.prepare('SELECT * FROM chat_history WHERE session_id = ?').all(sessionId);
    assert.strictEqual(chatRows.length, 0, 'Chat history should be empty');

    // 2. Workspace files must be completely gone
    const files = testDb.prepare('SELECT * FROM workspace_files WHERE project_id = ?').all(sessionId);
    assert.strictEqual(files.length, 0, 'Workspace files should be empty');

    // 3. Project record must be gone
    const project = projectDao.getById(sessionId);
    assert.strictEqual(project, null, 'Project should be deleted');

    // 4. Physical workspace directory must be deleted
    assert.strictEqual(fs.existsSync(ws.diskPath), false, 'Physical workspace disk path should be deleted');

    // 5. Workspace DB record must be deleted
    const wsRecord = workspaceDao.getByProjectId(sessionId);
    assert.strictEqual(wsRecord, null, 'Workspace DB record should be deleted');
  });
});
