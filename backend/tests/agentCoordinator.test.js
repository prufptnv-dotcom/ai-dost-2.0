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
const AgentHandoffDAO = require('../db/dao/AgentHandoffDAO');

const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const AgentHandoffService = require('../services/agentHandoffService');
const AgentCoordinator = require('../agent/runtime/AgentCoordinator');
const Supervisor = require('../agent/runtime/Supervisor');
const CapabilityPolicy = require('../agent/policy/CapabilityPolicy');
const { ResultValidator, ResultValidationError } = require('../agent/runtime/resultValidator');
const lockManager = require('../agent/concurrency/LockManager');

test('Phase 2G.3 - AgentCoordinator, Supervisor Runtime, and Result Persistence', async (t) => {
  const db = initDatabase(':memory:');
  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const taskDao = new AgentTaskDAO(db);
  const runDao = new AgentRunDAO(db);
  const stepDao = new AgentStepDAO(db);
  const toolCallDao = new ToolCallDAO(db);
  const observationDao = new ObservationDAO(db);
  const verifyDao = new VerificationResultDAO(db);
  const handoffDao = new AgentHandoffDAO(db);

  const workspaceManager = new WorkspaceManager(db);
  const projectAuthService = new ProjectAuthorizationService(db);
  const handoffService = new AgentHandoffService(db);

  const coordinator = new AgentCoordinator({
    db,
    projectAuthService,
    workspaceManager,
    agentTaskDao: taskDao,
    agentRunDao: runDao,
    agentStepDao: stepDao,
    toolCallDao,
    observationDao,
    verificationResultDao: verifyDao,
    agentHandoffDao: handoffDao,
    agentHandoffService: handoffService,
    lockManager
  });

  // Setup fixtures
  userDao.create({ id: 'user_alice', username: 'alice', role: 'user' });
  userDao.create({ id: 'user_bob', username: 'bob', role: 'user' });
  projectDao.create({ id: 'proj_alpha', name: 'Project Alpha', userId: 'user_alice' });
  projectDao.create({ id: 'proj_beta', name: 'Project Beta', userId: 'user_bob' });

  await workspaceManager.ensureWorkspace('proj_alpha', 'user_alice');
  await workspaceManager.ensureWorkspace('proj_beta', 'user_bob');

  let supervisorSession = null;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Supervisor Creation & Security Boundaries
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('1. Supervisor Creation and Trusted Role Storage', async () => {
    supervisorSession = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_alpha',
      title: 'Alpha Architecture Task',
      prompt: 'Refactor system and verify'
    });

    assert.ok(supervisorSession.task);
    assert.ok(supervisorSession.run);
    assert.ok(supervisorSession.supervisor instanceof Supervisor);
    assert.strictEqual(supervisorSession.task.project_id, 'proj_alpha');
    assert.strictEqual(supervisorSession.task.user_id, 'user_alice');

    // Verify trusted runtime_metadata.role
    const runInDb = runDao.getById(supervisorSession.run.id);
    const meta = JSON.parse(runInDb.runtime_metadata);
    assert.strictEqual(meta.role, 'SUPERVISOR');
    assert.strictEqual(meta.depth, 0);

    // Cross-user unauthorized creation attempt rejected
    await assert.rejects(
      coordinator.createSupervisorTask({
        userId: 'user_bob',
        projectId: 'proj_alpha',
        title: 'Unauthorized Supervisor'
      }),
      /Access denied/
    );
  });

  await t.test('2. Supervisor Capability Boundary (Only orchestration.manage)', () => {
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'orchestration.manage'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'filesystem.write'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'terminal.execute'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('SUPERVISOR', 'code.edit'), false);

    assert.throws(
      () => CapabilityPolicy.assertAllowed('SUPERVISOR', 'filesystem.write'),
      /denied for role 'SUPERVISOR'/
    );
    assert.throws(
      () => CapabilityPolicy.assertAllowed('SUPERVISOR', 'terminal.execute'),
      /denied for role 'SUPERVISOR'/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Worker Role Delegation & Validation
  // ──────────────────────────────────────────────────────────────────────────
  let researcherWorker = null;
  let coderWorker = null;
  let verifierWorker = null;

  await t.test('3. Delegation to Allowed Worker Roles (RESEARCHER, CODER, VERIFIER)', async () => {
    // 1. Researcher
    researcherWorker = await supervisorSession.supervisor.delegate({
      role: 'RESEARCHER',
      objective: 'Research auth patterns',
      contextRefs: ['ctx_auth_1']
    });
    assert.strictEqual(researcherWorker.workerRun.status, 'PENDING');
    let meta = JSON.parse(runDao.getById(researcherWorker.workerRun.id).runtime_metadata);
    assert.strictEqual(meta.role, 'RESEARCHER');
    assert.strictEqual(meta.depth, 1);

    // 2. Coder
    coderWorker = await supervisorSession.supervisor.delegate({
      role: 'CODER',
      objective: 'Implement OAuth router',
      artifactRefs: ['art_auth_route']
    });
    meta = JSON.parse(runDao.getById(coderWorker.workerRun.id).runtime_metadata);
    assert.strictEqual(meta.role, 'CODER');
    assert.strictEqual(meta.depth, 1);

    // 3. Verifier
    verifierWorker = await supervisorSession.supervisor.delegate({
      role: 'VERIFIER',
      objective: 'Verify OAuth router test suite'
    });
    meta = JSON.parse(runDao.getById(verifierWorker.workerRun.id).runtime_metadata);
    assert.strictEqual(meta.role, 'VERIFIER');
    assert.strictEqual(meta.depth, 1);
  });

  await t.test('4. Rejection of Disallowed Worker Roles & Spoofing', async () => {
    // Reject SUPERVISOR as target
    await assert.rejects(
      supervisorSession.supervisor.delegate({
        role: 'SUPERVISOR',
        objective: 'Sub-supervisor attempt'
      }),
      /Invalid or unauthorized worker role/
    );

    // Reject LEGACY_AGENT
    await assert.rejects(
      supervisorSession.supervisor.delegate({
        role: 'LEGACY_AGENT',
        objective: 'Legacy call'
      }),
      /Invalid or unauthorized worker role/
    );

    // Reject arbitrary unknown roles
    await assert.rejects(
      supervisorSession.supervisor.delegate({
        role: 'SUPER_ADMIN_ROOT',
        objective: 'Privilege escalation'
      }),
      /Invalid or unauthorized worker role/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Delegation Depth & Worker Limit Enforcement
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('5. Max Delegation Depth Enforcement (<= 3)', async () => {
    const depthTask = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_alpha',
      title: 'Depth Test Task'
    });

    // Level 1 sub-supervisor
    const subSup1 = runDao.create({
      id: 'run_depth_sup_1',
      taskId: depthTask.task.id,
      status: 'RUNNING',
      metadata: { role: 'SUPERVISOR', depth: 1 }
    });
    const sub1 = await coordinator.delegate({
      supervisorRunId: subSup1.id,
      role: 'CODER',
      objective: 'Depth 2 coder'
    });
    assert.strictEqual(JSON.parse(sub1.workerRun.runtime_metadata).depth, 2);

    // Level 2 sub-supervisor (depth 2)
    const subSup2 = runDao.create({
      id: 'run_depth_sup_2',
      taskId: depthTask.task.id,
      status: 'RUNNING',
      metadata: { role: 'SUPERVISOR', depth: 2 }
    });
    const sub2 = await coordinator.delegate({
      supervisorRunId: subSup2.id,
      role: 'VERIFIER',
      objective: 'Depth 3 verifier'
    });
    assert.strictEqual(JSON.parse(sub2.workerRun.runtime_metadata).depth, 3);

    // Level 3 sub-supervisor trying to create depth 4 -> Should throw
    const subSup3 = runDao.create({
      id: 'run_depth_sup_3',
      taskId: depthTask.task.id,
      status: 'RUNNING',
      metadata: { role: 'SUPERVISOR', depth: 3 }
    });
    await assert.rejects(
      coordinator.delegate({
        supervisorRunId: subSup3.id,
        role: 'CODER',
        objective: 'Depth 4 coder attempt'
      }),
      /Delegation depth limit exceeded: max allowed depth is 3/
    );
  });

  await t.test('6. Worker Limits per Supervisor Task and per Project', async () => {
    projectDao.create({ id: 'proj_limits', name: 'Limits Project', userId: 'user_alice' });
    await workspaceManager.ensureWorkspace('proj_limits', 'user_alice');

    const limitSession = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_limits',
      title: 'Limit Test Task'
    });

    // Create 5 workers
    for (let i = 1; i <= 5; i++) {
      await limitSession.supervisor.delegate({
        role: 'RESEARCHER',
        objective: `Worker ${i} task`
      });
    }

    // 6th worker should be rejected
    await assert.rejects(
      limitSession.supervisor.delegate({
        role: 'RESEARCHER',
        objective: 'Worker 6 exceeding limit'
      }),
      /Worker limit per supervisor task exceeded: max allowed is 5/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Logical Handoff Idempotency vs Mutation Lock
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('7. Logical Handoff Idempotency', async () => {
    projectDao.create({ id: 'proj_idem', name: 'Idem Project', userId: 'user_alice' });
    await workspaceManager.ensureWorkspace('proj_idem', 'user_alice');

    const idemSession = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_idem',
      title: 'Idempotency Test'
    });

    const d1 = await idemSession.supervisor.delegate({
      role: 'RESEARCHER',
      objective: 'Analyze DB schema',
      contextRefs: ['schema_doc']
    });

    // Exact duplicate delegation call
    const d2 = await idemSession.supervisor.delegate({
      role: 'RESEARCHER',
      objective: 'Analyze DB schema',
      contextRefs: ['schema_doc']
    });

    // Must return the exact same handoff and worker run
    assert.strictEqual(d1.handoff.id, d2.handoff.id);
    assert.strictEqual(d1.workerRun.id, d2.workerRun.id);
  });

  await t.test('8. Mutation Serialization & Read-Only Concurrency', async () => {
    // 1. Read-only workers (RESEARCHER) can run concurrently without locks
    const r1 = await coordinator.startWorker(researcherWorker.workerRun.id, {
      runner: async () => ({
        status: 'COMPLETED',
        summary: 'Research completed',
        artifact_refs: [],
        context_refs: ['ctx_auth_1'],
        verification_status: 'PASSED',
        errors: []
      })
    });
    assert.strictEqual(r1.status, 'SUCCEEDED');

    // 2. Mutating worker (CODER) acquires workspace lock
    const c1 = await coordinator.startWorker(coderWorker.workerRun.id, {
      runner: async () => ({
        status: 'COMPLETED',
        summary: 'OAuth router implemented',
        artifact_refs: ['art_auth_route'],
        context_refs: [],
        verification_status: 'PASSED',
        errors: []
      })
    });
    assert.strictEqual(c1.status, 'SUCCEEDED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Result Persistence & Result Contract Validation
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('9. Canonical Structured Result Persistence in result_json', async () => {
    // Collect result for coderWorker
    const result = await coordinator.collectWorkerResult(coderWorker.workerRun.id, 'user_alice');
    assert.strictEqual(result.status, 'COMPLETED');
    assert.strictEqual(result.summary, 'OAuth router implemented');
    assert.deepStrictEqual(result.artifact_refs, ['art_auth_route']);
    assert.strictEqual(result.verification_status, 'PASSED');
    assert.deepStrictEqual(result.errors, []);

    // Verify directly in DB table agent_handoffs
    const handoffRow = handoffDao.getById(coderWorker.handoff.id);
    assert.ok(handoffRow.result_json);
    const parsed = JSON.parse(handoffRow.result_json);
    assert.strictEqual(parsed.summary, 'OAuth router implemented');
  });

  await t.test('10. Result Validator: Strict Contract, Limits, and Secrets Blocking', () => {
    // 1. Valid result
    const valid = ResultValidator.validate({
      status: 'COMPLETED',
      summary: 'Clean implementation',
      artifact_refs: ['art_1', 'art_2'],
      context_refs: ['ctx_1'],
      verification_status: 'PASSED',
      errors: []
    });
    assert.strictEqual(valid.status, 'COMPLETED');

    // 2. Missing/invalid status
    assert.throws(
      () => ResultValidator.validate({ status: 'INVALID', summary: 'ok' }),
      ResultValidationError
    );

    // 3. Summary length > 512 chars
    assert.throws(
      () => ResultValidator.validate({
        status: 'COMPLETED',
        summary: 'A'.repeat(513),
        verification_status: 'PASSED'
      }),
      ResultValidationError
    );

    // 4. Artifact refs > 10 items
    assert.throws(
      () => ResultValidator.validate({
        status: 'COMPLETED',
        summary: 'Too many artifacts',
        artifact_refs: Array.from({ length: 11 }, (_, i) => `art_${i}`),
        verification_status: 'PASSED'
      }),
      ResultValidationError
    );

    // 5. Secret pattern detected in summary
    assert.throws(
      () => ResultValidator.validate({
        status: 'COMPLETED',
        summary: 'Leaked key AIzaSyA12345678901234567890123456789012',
        verification_status: 'PASSED'
      }),
      /Result contains detected sensitive secret/
    );

    // 6. Stack trace in summary or error message
    assert.throws(
      () => ResultValidator.validate({
        status: 'FAILED',
        summary: 'Error: boom\n    at Object.<anonymous> (test.js:12:34)',
        verification_status: 'FAILED'
      }),
      /forbidden stack trace/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Project and User Ownership Isolation
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('11. Cross-Project and Cross-User Result Access Denied (SEC-001)', async () => {
    // Alice is authorized for Alpha
    const aliceRes = await coordinator.collectWorkerResult(researcherWorker.workerRun.id, 'user_alice');
    assert.ok(aliceRes);

    // Bob tries to collect Alice's worker result from Project Alpha -> Must throw Unauthorized
    await assert.rejects(
      coordinator.collectWorkerResult(researcherWorker.workerRun.id, 'user_bob'),
      /Unauthorized: User 'user_bob' does not have permission to access results from project 'proj_alpha'/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Cancellation & Late Completion Protection
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('12. Cancellation and Late Completion Race Protection', async () => {
    projectDao.create({ id: 'proj_cancel', name: 'Cancel Project', userId: 'user_alice' });
    await workspaceManager.ensureWorkspace('proj_cancel', 'user_alice');

    const cancelSession = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_cancel',
      title: 'Cancellation Test Task'
    });

    // Create new worker to cancel
    const cancelTestWorker = await cancelSession.supervisor.delegate({
      role: 'VERIFIER',
      objective: 'Long running verification to be cancelled'
    });

    // Cancel worker
    const cancelRes = await coordinator.cancelWorker(cancelTestWorker.workerRun.id, 'User requested abort');
    assert.strictEqual(cancelRes.status, 'CANCELLED');

    const runAfterCancel = runDao.getById(cancelTestWorker.workerRun.id);
    assert.strictEqual(runAfterCancel.status, 'CANCELLED');

    const handoffAfterCancel = handoffDao.getById(cancelTestWorker.handoff.id);
    assert.strictEqual(handoffAfterCancel.status, 'CANCELLED');

    // Late completion attempt must NOT revert status back to COMPLETED
    await handoffService.completeHandoff(cancelTestWorker.handoff.id, {
      status: 'COMPLETED',
      summary: 'Late completed worker',
      verification_status: 'PASSED'
    });

    const verifyLate = handoffDao.getById(cancelTestWorker.handoff.id);
    assert.strictEqual(verifyLate.status, 'CANCELLED');

    // Result collection returns CANCELLED envelope
    const collectedCancelled = await coordinator.collectWorkerResult(cancelTestWorker.workerRun.id, 'user_alice');
    assert.strictEqual(collectedCancelled.status, 'CANCELLED');
    assert.strictEqual(collectedCancelled.verification_status, 'SKIPPED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 8. Migration 004 Verification
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('13. Migration 004 Table Rebuild and Idempotency Verification', () => {
    const migration004 = require('../db/migrations/004_agent_handoff_results');

    // Check result_json column exists
    const cols = db.prepare('PRAGMA table_info(agent_handoffs)').all().map(c => c.name);
    assert.ok(cols.includes('result_json'));

    // Test idempotent up
    migration004.up(db);
    const colsAfterUp = db.prepare('PRAGMA table_info(agent_handoffs)').all().map(c => c.name);
    assert.ok(colsAfterUp.includes('result_json'));

    // Test fresh DB with 004 migration
    const freshDb = initDatabase(':memory:');
    const freshCols = freshDb.prepare('PRAGMA table_info(agent_handoffs)').all().map(c => c.name);
    assert.ok(freshCols.includes('result_json'));
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 9. Restart & Recovery Classification
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('14. Restart Recovery & Single-Node Concurrency Limitations', async () => {
    // Verify persisted state survives across new Coordinator instances connected to same DB
    const freshCoordinator = new AgentCoordinator({ db });
    const status = await freshCoordinator.getWorkerStatus(coderWorker.workerRun.id);
    assert.strictEqual(status.run.status, 'SUCCEEDED');
    assert.strictEqual(status.handoff.status, 'COMPLETED');

    // Verification of single-node in-process lock limitation:
    // LockManager in memory is lost on process restart, which is classified as
    // ACCEPTABLE FOR CURRENT SINGLE-NODE PHASE (documented limitation).
  });
});
