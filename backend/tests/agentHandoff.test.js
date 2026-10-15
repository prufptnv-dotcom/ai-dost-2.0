const test = require('node:test');
const assert = require('node:assert');
const { initDatabase } = require('../db/index');
const ProjectDAO = require('../db/dao/ProjectDAO');
const UserDAO = require('../db/dao/UserDAO');
const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');
const AgentHandoffDAO = require('../db/dao/AgentHandoffDAO');
const AgentHandoffService = require('../services/agentHandoffService');
const { ResultValidator } = require('../agent/runtime/resultValidator');

test('Phase 2G.3 - Agent Handoff Service & Canonical Result Persistence', async (t) => {
  const db = initDatabase(':memory:');
  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const taskDao = new AgentTaskDAO(db);
  const runDao = new AgentRunDAO(db);
  const handoffDao = new AgentHandoffDAO(db);
  const service = new AgentHandoffService(db);

  // Setup fixtures
  userDao.create({ id: 'u_test', username: 'utest' });
  projectDao.create({ id: 'p_test', name: 'P Test', userId: 'u_test' });
  const task = taskDao.create({ id: 't_handoff', projectId: 'p_test', userId: 'u_test', title: 'Task' });
  const supRun = runDao.create({ id: 'r_sup', taskId: task.id, status: 'RUNNING' });
  const workerRun = runDao.create({ id: 'r_worker', taskId: task.id, status: 'PENDING' });

  let createdHandoff = null;

  await t.test('1. Create Handoff & Idempotency', async () => {
    createdHandoff = await service.createHandoff({
      taskId: task.id,
      sourceRunId: supRun.id,
      sourceAgent: 'SUPERVISOR',
      targetAgent: 'RESEARCHER',
      objective: 'Analyze docs'
    });

    assert.ok(createdHandoff.id);
    assert.strictEqual(createdHandoff.status, 'PENDING');

    // Duplicate call returns existing active handoff
    const duplicate = await service.createHandoff({
      taskId: task.id,
      sourceRunId: supRun.id,
      sourceAgent: 'SUPERVISOR',
      targetAgent: 'RESEARCHER',
      objective: 'Analyze docs'
    });

    assert.strictEqual(duplicate.id, createdHandoff.id);
  });

  await t.test('2. Accept & Start Handoff', async () => {
    const accepted = await service.acceptHandoff(createdHandoff.id, workerRun.id);
    assert.strictEqual(accepted.status, 'ACCEPTED');
    assert.strictEqual(accepted.target_run_id, workerRun.id);

    const started = await service.startHandoff(createdHandoff.id);
    assert.strictEqual(started.status, 'IN_PROGRESS');
  });

  await t.test('3. Complete Handoff with Canonical result_json', async () => {
    const validResult = {
      status: 'COMPLETED',
      summary: 'Research completed cleanly',
      artifact_refs: ['art_1'],
      context_refs: ['ctx_1'],
      verification_status: 'PASSED',
      errors: []
    };

    const completed = await service.completeHandoff(createdHandoff.id, validResult);
    assert.strictEqual(completed.status, 'COMPLETED');
    assert.ok(completed.result_json);

    const parsed = JSON.parse(completed.result_json);
    assert.strictEqual(parsed.summary, 'Research completed cleanly');
    assert.strictEqual(parsed.verification_status, 'PASSED');
  });

  await t.test('4. Cancel Handoff & Late Completion Protection', async () => {
    const workerRun2 = runDao.create({ id: 'r_worker_2', taskId: task.id, status: 'PENDING' });
    const h2 = await service.createHandoff({
      taskId: task.id,
      sourceRunId: supRun.id,
      sourceAgent: 'SUPERVISOR',
      targetAgent: 'CODER',
      objective: 'Write feature'
    });
    await service.acceptHandoff(h2.id, workerRun2.id);

    const cancelled = await service.cancelHandoff(h2.id, 'User cancelled');
    assert.strictEqual(cancelled.status, 'CANCELLED');

    // Late completion attempt
    const late = await service.completeHandoff(h2.id, {
      status: 'COMPLETED',
      summary: 'Late finish',
      verification_status: 'PASSED'
    });

    assert.strictEqual(late.status, 'CANCELLED');
    const row = handoffDao.getById(h2.id);
    assert.strictEqual(row.status, 'CANCELLED');
  });

  await t.test('5. Fail Handoff with Structured Error Result', async () => {
    const workerRun3 = runDao.create({ id: 'r_worker_3', taskId: task.id, status: 'PENDING' });
    const h3 = await service.createHandoff({
      taskId: task.id,
      sourceRunId: supRun.id,
      sourceAgent: 'SUPERVISOR',
      targetAgent: 'VERIFIER',
      objective: 'Verify feature'
    });
    await service.acceptHandoff(h3.id, workerRun3.id);

    const failed = await service.failHandoff(h3.id, 'Test suite failure');
    assert.strictEqual(failed.status, 'FAILED');
    assert.ok(failed.result_json);

    const parsed = JSON.parse(failed.result_json);
    assert.strictEqual(parsed.status, 'FAILED');
    assert.strictEqual(parsed.verification_status, 'FAILED');
    assert.ok(parsed.errors.length > 0);
  });
});
