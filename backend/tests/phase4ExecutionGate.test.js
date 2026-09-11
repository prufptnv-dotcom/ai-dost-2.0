const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../db/index');
const ExecutionController = require('../agent/runtime/ExecutionController');
const { CapabilityGatekeeper } = require('../agent/policy/CapabilityGatekeeper');
const { CapabilityRegistry } = require('../agent/registry/CapabilityRegistry');
const Tool = require('../agent/runtime/Tool');
const ToolRegistry = require('../agent/runtime/ToolRegistry');
const ApplyDiffTool = require('../agent/tools/ApplyDiffTool');
const UserDAO = require('../db/dao/UserDAO');
const ProjectDAO = require('../db/dao/ProjectDAO');
const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');
const AgentStepDAO = require('../db/dao/AgentStepDAO');
const ToolCallDAO = require('../db/dao/ToolCallDAO');
const ObservationDAO = require('../db/dao/ObservationDAO');
const VerificationResultDAO = require('../db/dao/VerificationResultDAO');
const WorkspaceManager = require('../services/workspaceManager').WorkspaceManager;

test('Phase 4 — Execution Engine & Gatekeeper Binding', async (t) => {
  const db = initDatabase(':memory:');
  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const taskDao = new AgentTaskDAO(db);
  const runDao = new AgentRunDAO(db);
  const stepDao = new AgentStepDAO(db);
  const toolCallDao = new ToolCallDAO(db);
  const observationDao = new ObservationDAO(db);
  const verifyDao = new VerificationResultDAO(db);
  const workspaceManager = new WorkspaceManager(db);

  // Setup user and project
  userDao.create({ id: 'dev_user', username: 'dev', role: 'developer' });
  projectDao.create({ id: 'test_project', name: 'Test Project', userId: 'dev_user' });
  const task = taskDao.create({ id: 'task_exec_1', projectId: 'test_project', userId: 'dev_user', title: 'Phase 4 Execution' });
  const run = runDao.create({ id: 'run_exec_1', taskId: 'task_exec_1' });

  // Initialize Gatekeeper with real capability registry
  const registry = new CapabilityRegistry();
  const gatekeeper = new CapabilityGatekeeper(registry);

  // Initialize ExecutionController with gatekeeper bound
  const controller = new ExecutionController({
    db,
    agentRunDao: runDao,
    agentStepDao: stepDao,
    toolCallDao,
    observationDao,
    verificationResultDao: verifyDao,
    workspaceManager,
    gatekeeper
  });

  await controller.startRun(run.id);

  // Create mock tool registry with Low-risk and High-risk tools
  const toolRegistry = new Map();

  class MockReadTool extends Tool {
    constructor() {
      super({ name: 'read_file', description: 'Reads a file', inputSchema: {} });
    }
    async execute() {
      return { success: true, content: 'test file content' };
    }
  }

  class MockTerminalTool extends Tool {
    constructor() {
      super({ name: 'run_terminal', description: 'Executes command', inputSchema: {} });
    }
    async execute(context, input) {
      return { success: true, output: `executed ${input.command}` };
    }
  }

  toolRegistry.set('read_file', new MockReadTool());
  toolRegistry.set('run_terminal', new MockTerminalTool());

  const mockToolRegistry = {
    get: (name) => toolRegistry.get(name)
  };

  await t.test('1. Low-risk tool (read_file) executes without approval token (ALLOW)', async () => {
    const step = await controller.recordStep(run.id, 'READ', { tool: 'read_file' });
    await controller.startStep(step.id);

    const context = { userId: 'dev_user', projectId: 'test_project' };
    const result = await controller.executeTool(step.id, 'read_file', { path: 'index.js' }, context, mockToolRegistry);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.content, 'test file content');

    const calls = toolCallDao.listByStep(step.id);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].status, 'SUCCEEDED');
  });

  await t.test('2. High-risk tool (run_terminal) without approval token fails with APPROVAL_REQUIRED', async () => {
    const step = await controller.recordStep(run.id, 'TERMINAL', { tool: 'run_terminal' });
    await controller.startStep(step.id);

    const context = { userId: 'dev_user', projectId: 'test_project' };

    await assert.rejects(async () => {
      await controller.executeTool(step.id, 'run_terminal', { command: 'npm install' }, context, mockToolRegistry);
    }, (err) => {
      assert.strictEqual(err.code, 'APPROVAL_REQUIRED');
      assert.ok(err.approvalToken, 'Should include newly minted approval token');
      assert.ok(err.capabilities.some(c => c.capability_id === 'devops.terminal'));
      return true;
    });
  });

  await t.test('3. High-risk tool (run_terminal) with valid approval token succeeds', async () => {
    const step = await controller.recordStep(run.id, 'TERMINAL_APPROVED', { tool: 'run_terminal' });
    await controller.startStep(step.id);

    // Evaluate terminal capability directly to issue token
    const evalResult = gatekeeper.evaluate(['devops.terminal'], { user: { id: 'dev_user' } });
    assert.ok(evalResult.approval_token);

    const context = {
      userId: 'dev_user',
      projectId: 'test_project',
      planId: 'task_exec_1',
      approvalToken: evalResult.approval_token
    };

    const result = await controller.executeTool(step.id, 'run_terminal', { command: 'npm test' }, context, mockToolRegistry);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.output, 'executed npm test');

    const calls = toolCallDao.listByStep(step.id);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].status, 'SUCCEEDED');
  });

  await t.test('4. Token replay rejection: previously used approval token is blocked on second run', async () => {
    const step = await controller.recordStep(run.id, 'TERMINAL_REPLAY', { tool: 'run_terminal' });
    await controller.startStep(step.id);

    // Issue a fresh token
    const evalResult = gatekeeper.evaluate(['devops.terminal'], { user: { id: 'dev_user' } });
    const token = evalResult.approval_token;

    const context = {
      userId: 'dev_user',
      projectId: 'test_project',
      planId: 'task_exec_1',
      approvalToken: token
    };

    // First use: must succeed
    const firstResult = await controller.executeTool(step.id, 'run_terminal', { command: 'ls' }, context, mockToolRegistry);
    assert.strictEqual(firstResult.success, true);

    // Second use with SAME token: must fail closed (Replay attack prevention)
    await assert.rejects(async () => {
      await controller.executeTool(step.id, 'run_terminal', { command: 'rm -rf /' }, context, mockToolRegistry);
    }, (err) => {
      assert.ok(err.message.includes('Invalid or expired approval token') || err.message.includes('Action requires user approval'));
      return true;
    });
  });

  await t.test('5. ApplyDiffTool preserves file integrity on syntax guard error', async () => {
    const diffTool = new ApplyDiffTool();
    const tempDir = path.join(__dirname, 'scratch_p4');
    fs.mkdirSync(tempDir, { recursive: true });
    const testFile = path.join(tempDir, 'sample.js');
    const initialCode = `function add(a, b) {\n  return a + b;\n}\nmodule.exports = add;\n`;
    fs.writeFileSync(testFile, initialCode, 'utf-8');

    const mockWsManager = {
      resolvePath: () => testFile
    };

    // Attempt to introduce syntax error (unclosed brace)
    const badDiffResult = await diffTool.execute({
      workspaceManager: mockWsManager,
      projectId: 'test_project',
      userId: 'dev_user'
    }, {
      path: 'sample.js',
      search: `return a + b;`,
      replace: `return a + b; \n const syntaxError = (`
    });

    // Guard should reject the code
    assert.strictEqual(badDiffResult.success, false);
    assert.ok(badDiffResult.error.includes('rejected before persistence'));

    // Verify initial file was preserved exactly without corrupting disk
    const contentOnDisk = fs.readFileSync(testFile, 'utf-8');
    assert.strictEqual(contentOnDisk, initialCode);

    // Cleanup scratch dir
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await controller.completeRun(run.id, 'SUCCEEDED');
});
