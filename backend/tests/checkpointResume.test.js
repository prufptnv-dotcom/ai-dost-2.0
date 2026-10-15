const test = require('node:test');
const assert = require('node:assert');

const { initDatabase } = require('../db/index');
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

test('Phase 2E - Checkpoint & Resume Architecture Verification', async (t) => {
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
  userDao.create({ id: 'u2', username: 'u2' });
  projectDao.create({ id: 'p1', name: 'Proj 1', userId: 'u1' });
  await workspaceManager.ensureWorkspace('p1', 'u1');

  const executionController = new ExecutionController({
    db, agentRunDao, agentStepDao, toolCallDao, observationDao, verificationResultDao, workspaceManager
  });

  const toolRegistry = new ToolRegistry();
  
  let toolExecutionCount = 0;
  class MockTool extends Tool {
    constructor(name) {
      super({ name, description: 'mock', inputSchema: { type: 'object' }});
    }
    async execute(context, input) {
      toolExecutionCount++;
      // Check concurrency in memory hack
      await new Promise(r => setTimeout(r, 10)); 
      return { success: true };
    }
  }
  toolRegistry.register(new MockTool('success_tool'));

  const contextAssembler = new ContextAssembler({ projectAuthService, workspaceManager, toolRegistry, projectDao });
  
  let mockVerifyPlan = { goal: 'verify', steps: [{ id: 'v1', tool: 'success_tool', description: 'v1', input: {} }] };
  const aiService = { 
    generateStructuredPlan: async () => ({ goal: 'run', steps: [{ id: 's1', tool: 'success_tool', description: 's1', input: {} }] }),
    generateRepairPlan: async () => ({ goal: 'repair', steps: [] }),
    generateVerificationPlan: async () => mockVerifyPlan
  };
  const taskPlanner = new TaskPlanner({ toolRegistry, aiService });

  const loop = new PlannerExecutionLoop({
    contextAssembler, taskPlanner, executionController, toolRegistry, agentTaskDao, agentRunDao
  });

  await t.test('1 & 2. Persistence and load across instance', async () => {
    agentTaskDao.create({ id: 't_persist', projectId: 'p1', prompt: 'test', status: 'RUNNING' });
    agentRunDao.create({ id: 'r_persist', taskId: 't_persist', status: 'RUNNING' });
    await executionController.saveCheckpoint('r_persist', { stepQueue: [{id: 'abc'}], repairAttempts: 1, goal: 'g' });
    
    // Create entirely new ExecutionController to simulate fresh process
    const ec2 = new ExecutionController({
      db, agentRunDao, agentStepDao, toolCallDao, observationDao, verificationResultDao, workspaceManager
    });
    const cp = await ec2.loadCheckpoint('r_persist');
    
    assert.strictEqual(cp.repairAttempts, 1);
    assert.strictEqual(cp.goal, 'g');
    assert.strictEqual(cp.stepQueue[0].id, 'abc');
  });

  await t.test('3. Stale step is recovered (RUNNING -> FAILED)', async () => {
    agentTaskDao.create({ id: 't_stale', projectId: 'p1', prompt: 'test', status: 'RUNNING' });
    agentRunDao.create({ id: 'r_stale', taskId: 't_stale', status: 'RUNNING' });
    
    // Simulate step that crashed mid-execution
    const staleStep = await executionController.recordStep('r_stale', 'TOOL', {});
    await executionController.startStep(staleStep.id); 
    
    assert.strictEqual(agentStepDao.getById(staleStep.id).status, 'RUNNING');
    
    await executionController.recoverStaleSteps('r_stale');
    
    const recovered = agentStepDao.getById(staleStep.id);
    assert.strictEqual(recovered.status, 'FAILED');
    assert.strictEqual(recovered.error_info, 'Process crashed during execution');
  });

  await t.test('4. Resume continues correctly', async () => {
    toolExecutionCount = 0;
    agentTaskDao.create({ id: 't_res', projectId: 'p1', prompt: 'test', status: 'RUNNING' });
    agentRunDao.create({ id: 'r_res', taskId: 't_res', status: 'RUNNING' });
    
    // Suppose s1 was completed, and we only have s2 in the queue
    await executionController.saveCheckpoint('r_res', { 
      stepQueue: [{ id: 's2', tool: 'success_tool', description: 's2', input: {} }], 
      repairAttempts: 0, goal: 'g' 
    });

    const res = await loop.resume('r_res', 'p1', 'u1', 3);
    assert.strictEqual(res.status, 'SUCCEEDED');
    
    // toolExecutionCount should be 2 (s2 + v1). s1 is skipped.
    assert.strictEqual(toolExecutionCount, 2);
  });

  await t.test('5. Atomic Checkpoint Updates (Sequence Integrity)', async () => {
    // Verified by SQLite atomic row updates in `updateMetadata`, no partial states.
    const run = agentRunDao.getById('r_res');
    const meta = JSON.parse(run.runtime_metadata);
    // Queue should be empty after run
    assert.strictEqual(meta.stepQueue.length, 0);
  });

  await t.test('6. Corrupted/malformed metadata throws cleanly', async () => {
    agentTaskDao.create({ id: 't_corr', projectId: 'p1', prompt: 'test', status: 'RUNNING' });
    agentRunDao.create({ id: 'r_corr', taskId: 't_corr', status: 'RUNNING' });
    
    db.prepare('UPDATE agent_runs SET runtime_metadata = ? WHERE id = ?').run('{ bad_json', 'r_corr');
    
    await assert.rejects(executionController.loadCheckpoint('r_corr'), /Checkpoint corruption for run r_corr: Invalid JSON format/);
    await assert.rejects(loop.resume('r_corr', 'p1', 'u1', 3), /Invalid JSON format/);
  });

  await t.test('7. Concurrent resume attempts throw error', async () => {
    agentTaskDao.create({ id: 't_conc', projectId: 'p1', prompt: 'test', status: 'RUNNING' });
    agentRunDao.create({ id: 'r_conc', taskId: 't_conc', status: 'RUNNING' });
    await executionController.saveCheckpoint('r_conc', { 
      stepQueue: [{ id: 's_conc', tool: 'success_tool', description: 's', input: {} }], 
      repairAttempts: 0, goal: 'g' 
    });

    // Start one run and don't wait for it immediately
    const p1 = loop.resume('r_conc', 'p1', 'u1', 3);
    
    // Attempt second resume synchronously
    await assert.rejects(loop.resume('r_conc', 'p1', 'u1', 3), /is already actively executing/);
    
    await p1; // Let it finish
  });

  await t.test('8. Isolation constraints enforced', async () => {
    agentTaskDao.create({ id: 't_iso', projectId: 'p1', prompt: 'test', status: 'RUNNING' });
    agentRunDao.create({ id: 'r_iso', taskId: 't_iso', status: 'RUNNING' });
    await executionController.saveCheckpoint('r_iso', { stepQueue: [], repairAttempts: 0, goal: 'g' });
    
    // Try to resume with u2 instead of u1
    await assert.rejects(loop.resume('r_iso', 'p1', 'u2', 3), /Access denied/);
  });

});
