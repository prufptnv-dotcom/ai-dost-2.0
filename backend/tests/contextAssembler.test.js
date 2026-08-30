const test = require('node:test');
const assert = require('node:assert');
const { initDatabase } = require('../db/index');
const ProjectDAO = require('../db/dao/ProjectDAO');
const UserDAO = require('../db/dao/UserDAO');
const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const { ToolRegistry } = require('../agent/runtime/ToolRegistry');
const ContextAssembler = require('../agent/runtime/ContextAssembler');

test('ContextAssembler', async (t) => {
  const db = initDatabase(':memory:');
  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const workspaceManager = new WorkspaceManager(db);
  const projectAuthService = new ProjectAuthorizationService(db);
  const toolRegistry = new ToolRegistry();
  toolRegistry.register({ name: 'mock_tool', description: 'mock', execute: () => {} });

  const contextAssembler = new ContextAssembler({ projectAuthService, workspaceManager, toolRegistry, projectDao });

  userDao.create({ id: 'u1', username: 'u1' });
  userDao.create({ id: 'u2', username: 'u2' });
  projectDao.create({ id: 'p1', name: 'Proj 1', userId: 'u1', framework: 'react' });

  await workspaceManager.ensureWorkspace('p1', 'u1');

  await t.test('Assembles context for authorized user', async () => {
    const context = await contextAssembler.assemble('p1', 'u1');
    assert.strictEqual(context.authenticatedUser, 'u1');
    assert.strictEqual(context.project.id, 'p1');
    assert.strictEqual(context.project.framework, 'react');
    assert.ok(context.workspace);
    assert.strictEqual(context.availableTools.length, 1);
    assert.strictEqual(context.availableTools[0].name, 'mock_tool');
    assert.ok(context.workspaceManager); // needed for tools
  });

  await t.test('Rejects cross-user access', async () => {
    await assert.rejects(contextAssembler.assemble('p1', 'u2'), /Context Assembly Failed: Access denied/);
  });

  await t.test('Rejects non-existent project', async () => {
    await assert.rejects(contextAssembler.assemble('does_not_exist', 'u1'), /Context Assembly Failed: Access denied/);
  });
});
