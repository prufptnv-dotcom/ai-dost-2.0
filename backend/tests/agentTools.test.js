const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { initDatabase, closeDatabase } = require('../db/index');
const ProjectDAO = require('../db/dao/ProjectDAO');
const UserDAO = require('../db/dao/UserDAO');
const WorkspaceManager = require('../services/workspaceManager').WorkspaceManager;
const ProjectAuthorizationService = require('../services/projectAuthorization').ProjectAuthorizationService;

const ToolRegistry = require('../agent/runtime/ToolRegistry').ToolRegistry;
const ReadFileTool = require('../agent/tools/ReadFileTool');
const WriteFileTool = require('../agent/tools/WriteFileTool');
const ListFilesTool = require('../agent/tools/ListFilesTool');
const TerminalTool = require('../agent/tools/TerminalTool');
const sandboxManager = require('../sandbox/SandboxManager');

test('Phase 2B - Tool Porting & Execution Boundaries', async (t) => {
  const db = initDatabase(':memory:');
  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const workspaceManager = new WorkspaceManager(db);
  const authService = new ProjectAuthorizationService(db);

  // Setup fixtures
  userDao.create({ id: 'u1', username: 'u1', role: 'user' });
  userDao.create({ id: 'u2', username: 'u2', role: 'user' });
  projectDao.create({ id: 'p1', name: 'P1', userId: 'u1' });
  projectDao.create({ id: 'p2', name: 'P2', userId: 'u2' });

  // Ensure workspace physical directories
  const { diskPath: ws1 } = await workspaceManager.ensureWorkspace('p1', 'u1');
  const { diskPath: ws2 } = await workspaceManager.ensureWorkspace('p2', 'u2');

  // Setup ToolRegistry
  const registry = new ToolRegistry();
  
  await t.test('Tool Registry Registration', () => {
    registry.register(new ReadFileTool());
    registry.register(new WriteFileTool());
    registry.register(new ListFilesTool());
    registry.register(new TerminalTool());
    
    assert.ok(registry.has('read_file'));
    assert.ok(registry.has('write_file'));
    assert.ok(registry.has('run_terminal'));
    
    // Duplicate rejection
    assert.throws(() => registry.register(new ReadFileTool()), /is already registered/);
    
    // Unknown rejection handled in execution controller, registry returns null
    assert.strictEqual(registry.get('unknown'), null);
  });

  const getContext = (projectId, userId) => {
    const auth = authService.authorize(projectId, { user: { id: userId } });
    if (!auth.authorized) throw new Error(auth.error);
    return {
      projectId: auth.project.id,
      userId: auth.user.id,
      workspaceManager
    };
  };

    await t.test('Input Schema Validation', async () => {
    const contextU1 = getContext('p1', 'u1');
    const writeTool = registry.get('write_file');
    
    // Missing required
    await assert.rejects(writeTool.execute(contextU1, { path: 'test.txt' }), /Missing required property 'content'/);
    
    // Wrong type
    await assert.rejects(writeTool.execute(contextU1, { path: 'test.txt', content: 123 }), /Property 'content' must be a string/);
    
    // Malformed input (null)
    await assert.rejects(writeTool.execute(contextU1, null), /must be an object/);
  });

  await t.test('WriteFileTool & ReadFileTool - Isolation & Traversal', async () => {
    const contextU1 = getContext('p1', 'u1');
    const writeTool = registry.get('write_file');
    const readTool = registry.get('read_file');

    // Valid write
    await writeTool.execute(contextU1, { path: 'src/test.txt', content: 'hello' });
    assert.ok(fs.existsSync(path.join(ws1, 'src', 'test.txt')));

    // Valid read
    const readRes = await readTool.execute(contextU1, { path: 'src/test.txt' });
    assert.strictEqual(readRes.content, 'hello');

    // Path traversal attempt -> Should throw Security Error
    await assert.rejects(
      writeTool.execute(contextU1, { path: '../../secret.txt', content: 'hack' }),
      /Workspace path security violation/
    );

    // Absolute path attempt -> Should throw Security Error
    await assert.rejects(
      readTool.execute(contextU1, { path: 'C:\\Windows\\System32\\cmd.exe' }),
      /Workspace path security violation/
    );

    // UNC path attempt -> Should throw Security Error
    await assert.rejects(
      readTool.execute(contextU1, { path: '\\\\server\\share\\file' }),
      /Workspace path security violation/
    );
    
    // Null byte attempt -> Should throw Security Error
    await assert.rejects(
      readTool.execute(contextU1, { path: 'test.txt\0' }),
      /Workspace path security violation/
    );
  });

  await t.test('Authorization Isolation', async () => {
    const readTool = registry.get('read_file');

    // u2 tries to read p1 (u2 doesn't own p1)
    assert.throws(() => getContext('p1', 'u2'), /Access denied/);
    
    // Test direct resolution fails if they bypassed context setup
    await assert.rejects(async () => {
      // Simulate fake context object without auth layer
      const fakeContext = { projectId: 'p1', userId: 'u2', workspaceManager };
      await readTool.execute(fakeContext, { path: 'src/test.txt' });
    }, /Access denied/); 
  });

  await t.test('ListFilesTool - Scoping', async () => {
    const contextU1 = getContext('p1', 'u1');
    const listTool = registry.get('list_directory');
    
    const res = await listTool.execute(contextU1, { path: '.' });
    assert.ok(res.success);
    assert.ok(res.files.includes('src/'));
    assert.ok(res.files.includes('src/test.txt'));
  });

  await t.test('TerminalTool - Sandbox and Safety Boundaries', async () => {
    const contextU1 = getContext('p1', 'u1');
    const terminalTool = registry.get('run_terminal');

    // Blocked command
    await assert.rejects(
      terminalTool.execute(contextU1, { command: 'rm -rf /' }),
      /Command blocked for safety/
    );

    // Mock sandboxManager to avoid docker requirement in unit test
    const origCreate = sandboxManager.createSandbox;
    const origExec = sandboxManager.exec;
    
    sandboxManager.createSandbox = async () => ({ id: 'mock-sb' });
    sandboxManager.exec = async (id, cmd) => ({ success: true, stdout: 'mocked output', stderr: '', exitCode: 0 });

    try {
      const res = await terminalTool.execute(contextU1, { command: 'echo "hello"' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.stdout, 'mocked output');
    } finally {
      sandboxManager.createSandbox = origCreate;
      sandboxManager.exec = origExec;
    }
  });

});


