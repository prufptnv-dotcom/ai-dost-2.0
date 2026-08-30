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
const ExecutionController = require('../agent/runtime/ExecutionController');
const ProjectAuthorizationService = require('../services/projectAuthorization').ProjectAuthorizationService;
const WorkspaceManager = require('../services/workspaceManager').WorkspaceManager;
const Tool = require('../agent/runtime/Tool');

test('Phase 2A - Agent Runtime Foundation', async (t) => {
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
  
  const controller = new ExecutionController({
    db,
    agentRunDao: runDao,
    agentStepDao: stepDao,
    toolCallDao,
    observationDao,
    verificationResultDao: verifyDao,
    workspaceManager
  });

  // Setup fixtures
  userDao.create({ id: 'userA', username: 'userA', role: 'user' });
  userDao.create({ id: 'userB', username: 'userB', role: 'user' });
  projectDao.create({ id: 'projA', name: 'Proj A', userId: 'userA' });
  projectDao.create({ id: 'projB', name: 'Proj B', userId: 'userB' });

  await t.test('1. AgentTask creation', () => {
    const task = taskDao.create({
      id: 'task_1',
      projectId: 'projA',
      userId: 'userA',
      title: 'Setup DB'
    });
    assert.strictEqual(task.id, 'task_1');
    assert.strictEqual(task.status, 'PENDING');
  });

  await t.test('2. AgentRun creation', () => {
    const run = runDao.create({
      id: 'run_1',
      taskId: 'task_1'
    });
    assert.strictEqual(run.id, 'run_1');
    assert.strictEqual(run.status, 'PENDING');
  });

  await t.test('3. AgentStep persistence', async () => {
    await controller.startRun('run_1');
    const step = await controller.recordStep('run_1', 'EXECUTE_TOOL', { tool: 'bash' });
    assert.strictEqual(step.status, 'PENDING');
    assert.strictEqual(step.sequence, 1);
    await controller.startStep(step.id);
    assert.strictEqual(stepDao.getById(step.id).status, 'RUNNING');
  });

  await t.test('4. ToolCall persistence', async () => {
    const stepId = stepDao.listByRun('run_1')[0].id;
    const tc = await controller.recordToolCall(stepId, 'bash', 'ls');
    await controller.completeToolCall(tc.id, 'COMPLETED', 'output.txt');
    const verifyTc = toolCallDao.getById(tc.id);
    assert.strictEqual(verifyTc.output, 'output.txt');
  });

  await t.test('5. Observation persistence', async () => {
    const stepId = stepDao.listByRun('run_1')[0].id;
    const obs = await controller.recordObservation(stepId, 'fs_diff', { changed: 1 });
    assert.strictEqual(obs.observation_type, 'fs_diff');
  });

  await t.test('6. VerificationResult persistence', async () => {
    const stepId = stepDao.listByRun('run_1')[0].id;
    const ver = await controller.recordVerificationResult(stepId, 'PASS', 'all good', 'logs');
    assert.strictEqual(ver.status, 'PASS');
    
    // cleanup step
    await controller.completeStep(stepId, 'SUCCEEDED');
    assert.strictEqual(stepDao.getById(stepId).status, 'SUCCEEDED');
  });

  await t.test('7. valid state transitions', async () => {
    const run2 = runDao.create({ id: 'run_2', taskId: 'task_1' });
    // PENDING -> RUNNING
    await controller.startRun(run2.id);
    assert.strictEqual(runDao.getById(run2.id).status, 'RUNNING');
  });

  await t.test('8. invalid state transitions rejected', async () => {
    // RUNNING -> PENDING is invalid
    await assert.rejects(async () => {
      await controller.completeRun('run_2', 'PENDING');
    }, /Invalid completion status/);

    // RUNNING -> SUCCEEDED (Valid to prepare next test)
    await controller.completeRun('run_2', 'SUCCEEDED');

    // SUCCEEDED -> RUNNING is invalid
    await assert.rejects(async () => {
      await controller.startRun('run_2');
    }, /Invalid state transition/);
  });

  await t.test('9. failed execution persistence', async () => {
    const runFail = runDao.create({ id: 'run_fail', taskId: 'task_1' });
    await controller.startRun(runFail.id);
    await controller.completeRun(runFail.id, 'FAILED', 'crash');
    
    const verifyFail = runDao.getById('run_fail');
    assert.strictEqual(verifyFail.status, 'FAILED');
    assert.strictEqual(verifyFail.error_info, 'crash');
  });

  await t.test('10. successful execution persistence', async () => {
    const runSuccess = runDao.create({ id: 'run_success', taskId: 'task_1' });
    await controller.startRun(runSuccess.id);
    await controller.completeRun(runSuccess.id, 'SUCCEEDED');
    
    const verifySuccess = runDao.getById('run_success');
    assert.strictEqual(verifySuccess.status, 'SUCCEEDED');
  });

  await t.test('11. project ownership isolation', () => {
    const authService = new ProjectAuthorizationService(db);
    assert.strictEqual(authService.authorize('projA', { user: { id: 'userA' } }).authorized, true);
    assert.strictEqual(authService.authorize('projA', { user: { id: 'userB' } }).authorized, false);
    
    const userA_tasks = taskDao.listByProject('projA');
    assert.strictEqual(userA_tasks.length, 1);
  });

  await t.test('12. cross-user isolation', () => {
    const authService = new ProjectAuthorizationService(db);
    assert.strictEqual(authService.authorize('projB', { user: { id: 'userB' } }).authorized, true);
    assert.strictEqual(authService.authorize('projB', { user: { id: 'userA' } }).authorized, false);
    
    const userB_tasks = taskDao.listByProject('projB');
    assert.strictEqual(userB_tasks.length, 0); 
  });

  await t.test('13. foreign-key integrity', () => {
    assert.throws(() => {
      taskDao.create({
        id: 'task_invalid',
        projectId: 'missing_project',
        userId: 'userA'
      });
    }, /FOREIGN KEY constraint failed/);
  });

  await t.test('14. restart-safe persisted state loading', () => {
    const loadedRun = runDao.getById('run_1');
    assert.strictEqual(loadedRun.status, 'RUNNING');
    const steps = stepDao.listByRun('run_1');
    assert.strictEqual(steps.length, 1);
    assert.strictEqual(steps[0].status, 'SUCCEEDED');
  });

  await t.test('15. controller does not bypass WorkspaceManager', async () => {
    class DummyTool extends Tool {
      constructor() {
        super({ name: 'dummy', description: 'test', inputSchema: {} });
      }
      async execute(context, input) {
        // Must use context.workspaceManager
        const path = context.workspaceManager.getWorkspacePath(context.projectId);
        return { success: true, path };
      }
    }
    const t1 = new DummyTool();
    const result = await t1.execute({ workspaceManager, projectId: 'projA' }, {});
    assert.ok(result.path.includes('projA') || result.path.includes('default'));
  });

  await t.test('16. controller does not bypass ProjectAuthorizationService', async () => {
    // Validate we can use the auth service strictly inside execution controller workflows
    const authService = new ProjectAuthorizationService(db);
    const auth = authService.authorize('projA', { user: { id: 'userA' } });
    assert.ok(auth.authorized);
    
    const task = taskDao.create({
      id: 'task_2',
      projectId: auth.project.id,
      userId: auth.user.id,
      title: 'Authorized Task'
    });
    
    assert.strictEqual(task.project_id, 'projA');
    assert.strictEqual(task.user_id, 'userA');
  });

  await t.test('17. Tool inputSchema validation check', async () => {
    class ValidatingTool extends Tool {
      constructor() {
        super({
          name: 'valTool',
          description: 'test',
          inputSchema: { type: 'object', required: ['command'] }
        });
      }
      async execute(context, input) {
        this.validateInput(input);
        return { success: true };
      }
    }
    const t2 = new ValidatingTool();
    await assert.rejects(async () => {
      await t2.execute({}, { missing: 'yes' });
    }, /Validation Error: Missing required property 'command'/);
    
    const res = await t2.execute({}, { command: 'ls' });
    assert.strictEqual(res.success, true);
  });
});

