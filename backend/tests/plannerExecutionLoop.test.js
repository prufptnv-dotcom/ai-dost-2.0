const test = require('node:test');
const assert = require('node:assert');

const { initDatabase, closeDatabase } = require('../db/index');
const ProjectDAO = require('../db/dao/ProjectDAO');
const UserDAO = require('../db/dao/UserDAO');
const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');
const AgentStepDAO = require('../db/dao/AgentStepDAO');
const ToolCallDAO = require('../db/dao/ToolCallDAO');
const ObservationDAO = require('../db/dao/ObservationDAO');
const VerificationResultDAO = require('../db/dao/VerificationResultDAO');

const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const { ToolRegistry } = require('../agent/runtime/ToolRegistry');
const ExecutionController = require('../agent/runtime/ExecutionController');

const ContextAssembler = require('../agent/runtime/ContextAssembler');
const TaskPlanner = require('../agent/runtime/TaskPlanner');
const PlannerExecutionLoop = require('../agent/runtime/PlannerExecutionLoop');
const Tool = require('../agent/runtime/Tool');

test('PlannerExecutionLoop', async (t) => {
  const db = initDatabase(':memory:');
  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const agentTaskDao = new AgentTaskDAO(db);
  const agentRunDao = new AgentRunDAO(db);
  const agentStepDao = new AgentStepDAO(db);
  const toolCallDao = new ToolCallDAO(db);
  const observationDao = new ObservationDAO(db);
  const verificationResultDao = new VerificationResultDAO(db);
  
  const workspaceManager = new WorkspaceManager(db);
  const projectAuthService = new ProjectAuthorizationService(db);

  userDao.create({ id: 'u1', username: 'u1' });
  projectDao.create({ id: 'p1', name: 'Proj 1', userId: 'u1' });
  await workspaceManager.ensureWorkspace('p1', 'u1');

  const executionController = new ExecutionController({
    db, agentRunDao, agentStepDao, toolCallDao, observationDao, verificationResultDao, workspaceManager
  });

  const toolRegistry = new ToolRegistry();
  
  let toolExecutionCount = 0;
  class MockTool extends Tool {
    constructor(name, shouldFail = false) {
      super({ name, description: 'mock', inputSchema: { type: 'object' }});
      this.shouldFail = shouldFail;
    }
    async execute(context, input) {
      toolExecutionCount++;
      if (this.shouldFail) throw new Error('Tool mock error');
      return { success: true };
    }
  }

  toolRegistry.register(new MockTool('success_tool'));
  toolRegistry.register(new MockTool('fail_tool', true));

  const contextAssembler = new ContextAssembler({ projectAuthService, workspaceManager, toolRegistry, projectDao });
  
  let mockPlan = null;
  let mockRepairPlan = null;
  let mockVerifyPlan = null;
  const aiService = { 
    generateStructuredPlan: async () => mockPlan,
    generateRepairPlan: async () => mockRepairPlan,
    generateVerificationPlan: async () => mockVerifyPlan
  };
  const taskPlanner = new TaskPlanner({ toolRegistry, aiService });

  const loop = new PlannerExecutionLoop({
    contextAssembler, taskPlanner, executionController, toolRegistry, agentTaskDao, agentRunDao
  });

  await t.test('Successful Loop Execution', async () => {
    toolExecutionCount = 0;
    mockPlan = {
      goal: 'test',
      steps: [
        { id: 's1', tool: 'success_tool', description: 'desc', input: {} },
        { id: 's2', tool: 'success_tool', description: 'desc', input: {} }
      ]
    };
    mockVerifyPlan = {
      goal: 'verify test',
      steps: [
        { id: 'v1', tool: 'success_tool', description: 'verify', input: {} }
      ]
    };

    const res = await loop.run('p1', 'u1', 'do it');
    assert.strictEqual(res.status, 'SUCCEEDED');
    assert.strictEqual(toolExecutionCount, 3); // 2 tool + 1 verify

    const run = agentRunDao.getById(res.runId);
    assert.strictEqual(run.status, 'SUCCEEDED');

    const steps = agentStepDao.listByRun(res.runId);
    assert.strictEqual(steps.length, 3);
    assert.strictEqual(steps[0].status, 'SUCCEEDED');
    assert.strictEqual(steps[1].status, 'SUCCEEDED');
    assert.strictEqual(steps[2].status, 'SUCCEEDED');

    const obs1 = observationDao.listByStep(steps[0].id);
    assert.strictEqual(obs1.length, 1);
    assert.strictEqual(obs1[0].observation_type, 'TOOL_OUTPUT');
  });

  await t.test('Failed Tool Execution Triggers Repair', async () => {
    toolExecutionCount = 0;
    mockPlan = {
      goal: 'test fail',
      steps: [
        { id: 's1', tool: 'success_tool', description: 'desc', input: {} },
        { id: 's2', tool: 'fail_tool', description: 'desc', input: {} },
        { id: 's3', tool: 'success_tool', description: 'desc', input: {} }
      ]
    };
    mockRepairPlan = {
      goal: 'repair',
      steps: [
        { id: 'r1', tool: 'success_tool', description: 'desc', input: {} }
      ]
    };
    // Verification should fail so we can also test Verification repair, but let's just make verification pass
    mockVerifyPlan = {
      goal: 'verify',
      steps: [
        { id: 'v1', tool: 'success_tool', description: 'verify', input: {} }
      ]
    };

    const res = await loop.run('p1', 'u1', 'fail it', 3);
    assert.strictEqual(res.status, 'SUCCEEDED');
    
    // Execution sequence: 
    // s1 (success)
    // s2 (fail -> triggers repair)
    // r1 (success)
    // s3 (success)
    // v1 (success)
    
    assert.strictEqual(toolExecutionCount, 5); 

    const steps = agentStepDao.listByRun(res.runId);
    assert.strictEqual(steps.length, 5); 
    assert.strictEqual(steps[1].status, 'FAILED'); // s2
    
    const obs2 = observationDao.listByStep(steps[1].id);
    assert.ok(obs2.some(o => o.observation_type === 'TOOL_ERROR'));
    assert.ok(obs2.some(o => o.observation_type === 'REPAIR_REQUEST'));
  });

  await t.test('Planner Failure Halts Task', async () => {
    mockPlan = { invalid: true }; // TaskPlanner will throw
    
    // We expect PlannerExecutionLoop to catch TaskPlanner throw? 
    // Wait, the loop propagates the error from generatePlan?
    // Let's check PlannerExecutionLoop code.
    await assert.rejects(loop.run('p1', 'u1', 'bad'), /Invalid plan structure/);
    
    // The task should be FAILED
    // Since task ID is generated inside run(), we can't easily assert on it unless we mock or query tasks
    const tasks = db.prepare('SELECT * FROM agent_tasks ORDER BY rowid DESC').all();
    assert.strictEqual(tasks[0].status, 'FAILED');
  });

  await t.test('Crash and Resume Recovery', async () => {
    toolExecutionCount = 0;
    
    // Simulate a crash state directly in the DB
    const taskId = 'task_crash_sim';
    agentTaskDao.create({ id: taskId, projectId: 'p1', prompt: 'resume me', status: 'RUNNING' });
    
    const runId = 'run_crash_sim';
    agentRunDao.create({ id: runId, taskId: taskId, status: 'RUNNING' });
    
    const stepQueue = [
      { id: 's2', tool: 'success_tool', description: 's2', input: {} },
      { id: 's3', tool: 'success_tool', description: 's3', input: {} }
    ];
    
    // Checkpoint
    executionController.saveCheckpoint(runId, { stepQueue, repairAttempts: 0, goal: 'resume goal' });
    
    // Simulate a step that was left in RUNNING state
    const staleStep = await executionController.recordStep(runId, 'TOOL', {});
    await executionController.startStep(staleStep.id);
    
    mockVerifyPlan = { goal: 'verify', steps: [{ id: 'v1', tool: 'success_tool', description: 'desc', input: {} }] };
    
    const res = await loop.resume(runId, 'p1', 'u1', 3);
    
    assert.strictEqual(res.status, 'SUCCEEDED');
    // Stale step should be marked as FAILED
    const step = agentStepDao.getById(staleStep.id);
    assert.strictEqual(step.status, 'FAILED');
    assert.strictEqual(step.error_info, 'Process crashed during execution');
    
    // Resume queue should execute s2, s3, and then verify
    assert.strictEqual(toolExecutionCount, 3);
  });
});
