const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const ArtifactDAO = require('../db/dao/ArtifactDAO');

const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const AgentHandoffService = require('../services/agentHandoffService');
const AgentCoordinator = require('../agent/runtime/AgentCoordinator');
const Supervisor = require('../agent/runtime/Supervisor');
const CapabilityPolicy = require('../agent/policy/CapabilityPolicy');
const { VerificationContract, VerificationValidationError } = require('../agent/verification/VerificationContract');
const MultiAgentVerifier = require('../agent/verification/MultiAgentVerifier');
const { SupervisorArbitrator } = require('../agent/arbitration/SupervisorArbitrator');
const lockManager = require('../agent/concurrency/LockManager');

test('Phase 2G.4 — Advanced Multi-Agent Verification + Arbitration Test Suite', async (t) => {
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
  const artifactDao = new ArtifactDAO(db);

  const workspaceManager = new WorkspaceManager(db);
  const projectAuthService = new ProjectAuthorizationService(db);
  const handoffService = new AgentHandoffService(db);

  const verifier = new MultiAgentVerifier({
    db,
    projectAuthService,
    workspaceManager,
    verificationResultDao: verifyDao,
    artifactDao
  });

  const arbitrator = new SupervisorArbitrator({ maxRepairs: 3 });

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
    artifactDao,
    multiAgentVerifier: verifier,
    arbitrator,
    lockManager
  });

  // Setup fixtures
  userDao.create({ id: 'user_alice', username: 'alice', role: 'user' });
  userDao.create({ id: 'user_bob', username: 'bob', role: 'user' });
  projectDao.create({ id: 'proj_verif', name: 'Verification Project', userId: 'user_alice' });
  projectDao.create({ id: 'proj_foreign', name: 'Foreign Project', userId: 'user_bob' });

  await workspaceManager.ensureWorkspace('proj_verif', 'user_alice');
  await workspaceManager.ensureWorkspace('proj_foreign', 'user_bob');

  const wsPath = workspaceManager.getWorkspacePath('proj_verif');
  fs.writeFileSync(path.join(wsPath, 'auth.js'), 'module.exports = { authenticate: () => true };');
  const authSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(wsPath, 'auth.js'))).digest('hex');

  // Create an artifact in proj_verif
  artifactDao.create({
    id: 'art_auth_spec',
    projectId: 'proj_verif',
    name: 'auth_spec.md',
    type: 'spec',
    mimeType: 'text/markdown',
    storagePath: '/specs/auth_spec.md',
    sha256: 'spec123hash'
  });

  // Create foreign artifact in proj_foreign
  artifactDao.create({
    id: 'art_foreign_secret',
    projectId: 'proj_foreign',
    name: 'secret.key',
    type: 'key',
    mimeType: 'text/plain',
    storagePath: '/secrets/secret.key',
    sha256: 'foreignhash123'
  });

  let supervisorSession = null;
  let coderWorker = null;

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Verifier Contract & Deterministic Semantics
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('1. Structured Verification Contract Validation & Sanitization', () => {
    // Valid PASS
    const pass = VerificationContract.validate({
      status: 'PASS',
      summary: 'All unit and file integrity checks passed',
      evidence_refs: ['auth.js'],
      artifact_refs: ['art_auth_spec'],
      failed_checks: [],
      confidence: 0.95
    });
    assert.strictEqual(pass.status, 'PASS');
    assert.strictEqual(pass.confidence, 0.95);

    // Invalid Status
    assert.throws(
      () => VerificationContract.validate({ status: 'MAYBE', summary: 'unsure' }),
      VerificationValidationError
    );

    // Summary length > 512
    assert.throws(
      () => VerificationContract.validate({ status: 'PASS', summary: 'X'.repeat(513) }),
      /exceeds 512 characters/
    );

    // PASS with non-empty failed_checks is illegal
    assert.throws(
      () => VerificationContract.validate({
        status: 'PASS',
        summary: 'All good',
        failed_checks: [{ check_type: 'UNIT_TEST', message: 'Fail' }]
      }),
      /cannot be PASS when failed_checks is non-empty/
    );

    // Secret leakage blocked
    assert.throws(
      () => VerificationContract.validate({
        status: 'FAIL',
        summary: 'Leaked API token: AIzaSyA12345678901234567890123456789012',
        failed_checks: []
      }),
      /detected sensitive secret/
    );

    // Stack trace blocked
    assert.throws(
      () => VerificationContract.validate({
        status: 'FAIL',
        summary: 'Failed at runTest (test.js:45:12)',
        failed_checks: []
      }),
      /forbidden stack trace/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Least-Privileged Verifier & Security Boundary
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('2. Verifier Role Least-Privilege (Cannot Mutate Files or Terminal Escalate)', () => {
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'filesystem.read'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'test.run'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'verification.inspect'), true);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'filesystem.write'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'code.edit'), false);
    assert.strictEqual(CapabilityPolicy.isAllowed('VERIFIER', 'orchestration.manage'), false);

    assert.throws(
      () => CapabilityPolicy.assertAllowed('VERIFIER', 'filesystem.write'),
      /denied for role 'VERIFIER'/
    );
    assert.throws(
      () => CapabilityPolicy.assertAllowed('VERIFIER', 'code.edit'),
      /denied for role 'VERIFIER'/
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Worker Results -> Independent Verifier PASS / FAIL / BLOCKED
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('3. Setup Supervisor and Coder Worker for Verification Flow', async () => {
    supervisorSession = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_verif',
      title: 'Auth Pipeline Task'
    });

    coderWorker = await supervisorSession.supervisor.delegate({
      role: 'CODER',
      objective: 'Implement auth middleware',
      contextRefs: ['auth_context'],
      artifactRefs: ['art_auth_spec']
    });

    // Worker completes successfully
    await coordinator.startWorker(coderWorker.workerRun.id, {
      runner: async () => ({
        status: 'COMPLETED',
        summary: 'Auth middleware implemented in auth.js',
        artifact_refs: ['art_auth_spec'],
        context_refs: ['auth_context'],
        verification_status: 'PASSED',
        errors: []
      })
    });
  });

  await t.test('4. Coder Result -> Independent Verifier PASS', async () => {
    const verif = await supervisorSession.supervisor.verifyWorker(coderWorker.workerRun.id, ['UNIT_TEST', 'FILE_INTEGRITY', 'SECURITY'], {
      evidenceVersionHashes: {
        'auth.js': authSha
      },
      checkExecutors: {
        UNIT_TEST: async () => ({ passed: true, message: 'All auth tests passed' })
      }
    });

    assert.strictEqual(verif.verificationResult.status, 'PASS');
    assert.strictEqual(verif.verificationResult.failed_checks.length, 0);
    assert.strictEqual(verif.arbitration.decision, 'COMPLETE');
    assert.strictEqual(verif.arbitration.shouldWaitUser, false);
  });

  await t.test('5. Coder Result -> Independent Verifier FAIL (Deterministic Failed Checks)', async () => {
    const verifFail = await supervisorSession.supervisor.verifyWorker(coderWorker.workerRun.id, ['UNIT_TEST', 'LINT'], {
      checkExecutors: {
        UNIT_TEST: async () => ({ passed: false, message: 'Test suite failed on 401 unauthorized test' }),
        LINT: async () => ({ passed: true })
      }
    });

    assert.strictEqual(verifFail.verificationResult.status, 'FAIL');
    assert.strictEqual(verifFail.verificationResult.failed_checks.length, 1);
    assert.strictEqual(verifFail.verificationResult.failed_checks[0].check_type, 'UNIT_TEST');
    assert.strictEqual(verifFail.arbitration.decision, 'REPAIR');
    assert.ok(verifFail.arbitration.repairPayload);
  });

  await t.test('6. Stale Evidence Is Rejected as Proof', async () => {
    // Verifier with wrong/stale expected hash
    const staleResult = await verifier.verify({
      projectId: 'proj_verif',
      userId: 'user_alice',
      workerResult: {
        status: 'COMPLETED',
        summary: 'Claimed fix',
        evidence_refs: ['auth.js'],
        artifact_refs: []
      },
      options: {
        evidenceVersionHashes: {
          'auth.js': 'stale_hash_from_previous_commit_123'
        }
      }
    });

    assert.strictEqual(staleResult.status, 'FAIL');
    const staleCheck = staleResult.failed_checks.find(c => c.message.includes('Stale evidence detected'));
    assert.ok(staleCheck);
  });

  await t.test('7. Foreign-Project Evidence / Artifact Is Rejected (Tenant Isolation)', async () => {
    const foreignResult = await verifier.verify({
      projectId: 'proj_verif',
      userId: 'user_alice',
      workerResult: {
        status: 'COMPLETED',
        summary: 'Using foreign artifact',
        artifact_refs: ['art_foreign_secret']
      }
    });

    assert.strictEqual(foreignResult.status, 'FAIL');
    const isoCheck = foreignResult.failed_checks.find(c => c.message.includes('belongs to another project'));
    assert.ok(isoCheck);
  });

  await t.test('8. Worker Self-Declaration of PASS is NOT Trusted Without Verifier Evidence', () => {
    // Worker claims it passed, but Verifier failed
    const arbitration = arbitrator.evaluate({
      workerResult: {
        status: 'COMPLETED',
        summary: 'Worker claims 100% bug fixed',
        verification_status: 'PASSED'
      },
      verificationResult: {
        status: 'FAIL',
        summary: 'Verifier found broken tests',
        evidence_refs: [],
        artifact_refs: [],
        failed_checks: [{ check_type: 'UNIT_TEST', message: 'Broken endpoint test' }],
        confidence: 0.8
      },
      repairAttempts: 0
    });

    // Must NOT complete! Must decide REPAIR
    assert.strictEqual(arbitration.decision, 'REPAIR');
    assert.strictEqual(arbitration.failureType, 'VERIFICATION_FAILED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Bounded Repair Loop & Arbitration Cycle
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('9. Verification Failure Triggers Bounded Repair to Coder', async () => {
    const repairRes = await supervisorSession.supervisor.executeRepair(
      coderWorker.workerRun.id,
      {
        objective: 'Fix 401 unauthorized response in auth.js',
        failed_checks: [{ check_type: 'UNIT_TEST', message: '401 test failed' }],
        evidence_refs: ['auth.js'],
        artifact_refs: ['art_auth_spec']
      },
      {
        repairAttempt: 1,
        checks: ['UNIT_TEST'],
        coderRunner: async () => ({
          status: 'COMPLETED',
          summary: 'Repaired 401 handler in auth.js',
          artifact_refs: ['art_auth_spec'],
          context_refs: ['auth.js'],
          verification_status: 'PASSED',
          errors: []
        }),
        checkExecutors: {
          UNIT_TEST: async () => ({ passed: true, message: 'All auth tests passed after repair' })
        }
      }
    );

    assert.strictEqual(repairRes.repairAttempt, 1);
    assert.strictEqual(repairRes.reverify.verificationResult.status, 'PASS');
    assert.strictEqual(repairRes.reverify.arbitration.decision, 'COMPLETE');
  });

  await t.test('10. Repair Limit Enforced (Max 3 Repairs -> WAITING_FOR_USER)', async () => {
    // Simulate hitting repairAttempt = 3
    const arbitrationMax = arbitrator.evaluate({
      workerResult: { status: 'COMPLETED', summary: 'Repair failed' },
      verificationResult: {
        status: 'FAIL',
        summary: 'Unit tests still failing',
        failed_checks: [{ check_type: 'UNIT_TEST', message: 'Persistent bug' }]
      },
      repairAttempts: 3
    });

    assert.strictEqual(arbitrationMax.decision, 'WAITING_FOR_USER');
    assert.strictEqual(arbitrationMax.failureType, 'REPAIR_FAILED');
    assert.strictEqual(arbitrationMax.shouldWaitUser, true);
  });

  await t.test('11. Blocked Verification Without Evidence -> WAITING_FOR_USER', () => {
    const blockedRes = arbitrator.evaluate({
      workerResult: { status: 'COMPLETED', summary: 'Output with missing files' },
      verificationResult: {
        status: 'BLOCKED',
        summary: 'Cannot verify: database seed credentials missing from user',
        failed_checks: [{ check_type: 'SECURITY', message: 'Credentials missing' }]
      },
      repairAttempts: 3
    });

    assert.strictEqual(blockedRes.decision, 'WAITING_FOR_USER');
    assert.strictEqual(blockedRes.failureType, 'VERIFICATION_BLOCKED');
    assert.strictEqual(blockedRes.shouldWaitUser, true);
  });

  await t.test('12. Budget Exhaustion & Security Denial Handling', () => {
    // 1. Budget Exceeded
    const budgetRes = arbitrator.evaluate({
      workerResult: { status: 'COMPLETED', summary: 'Done' },
      verificationResult: { status: 'PASS', summary: 'Pass' },
      context: { budgetExceeded: true }
    });
    assert.strictEqual(budgetRes.decision, 'WAITING_FOR_USER');
    assert.strictEqual(budgetRes.failureType, 'BUDGET_EXCEEDED');

    // 2. Security Violation
    const secRes = arbitrator.evaluate({
      workerResult: { status: 'COMPLETED', summary: 'Done' },
      verificationResult: { status: 'FAIL', summary: 'Exploit detected' },
      context: { securityViolation: 'Attempted sandbox breakout' }
    });
    assert.strictEqual(secRes.decision, 'FAILED');
    assert.strictEqual(secRes.failureType, 'SECURITY_DENIED');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Verification Persistence & Observability
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('13. Verification Result Persistence in DB and Handoff', () => {
    const step = stepDao.create({
      id: 'step_v_1',
      runId: coderWorker.workerRun.id,
      sequence: 1,
      stepType: 'VERIFY',
      status: 'SUCCEEDED'
    });

    verifyDao.create({
      id: 'vr_test_1',
      stepId: step.id,
      status: 'PASS',
      reason: 'Integrity verified',
      evidence: { confidence: 1.0, checks: ['FILE_INTEGRITY'] }
    });

    const persisted = verifyDao.getById('vr_test_1');
    assert.ok(persisted);
    assert.strictEqual(persisted.status, 'PASS');
    assert.strictEqual(persisted.step_id, 'step_v_1');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Realistic End-to-End Multi-Agent Flow
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('14. Realistic E2E: Supervisor -> Researcher -> Coder -> Verifier -> PASS -> Complete', async () => {
    projectDao.create({ id: 'proj_e2e', name: 'E2E Flow Project', userId: 'user_alice' });
    await workspaceManager.ensureWorkspace('proj_e2e', 'user_alice');

    const e2eSession = await coordinator.createSupervisorTask({
      userId: 'user_alice',
      projectId: 'proj_e2e',
      title: 'Full E2E Multi-Agent Flow'
    });

    // 1. Researcher
    const researcher = await e2eSession.supervisor.delegate({
      role: 'RESEARCHER',
      objective: 'Discover API token architecture'
    });
    await coordinator.startWorker(researcher.workerRun.id, {
      runner: async () => ({
        status: 'COMPLETED',
        summary: 'Found JWT architecture in documentation',
        artifact_refs: [],
        context_refs: ['jwt_docs'],
        verification_status: 'PASSED',
        errors: []
      })
    });

    // 2. Coder
    const coder = await e2eSession.supervisor.delegate({
      role: 'CODER',
      objective: 'Write JWT validator utility',
      contextRefs: ['jwt_docs']
    });
    await coordinator.startWorker(coder.workerRun.id, {
      runner: async () => ({
        status: 'COMPLETED',
        summary: 'Created jwtValidator.js with verifyToken function',
        artifact_refs: [],
        context_refs: ['jwt_docs'],
        verification_status: 'PASSED',
        errors: []
      })
    });

    // 3. Verifier
    const verif = await e2eSession.supervisor.verifyWorker(coder.workerRun.id, ['UNIT_TEST', 'SECURITY'], {
      checkExecutors: {
        UNIT_TEST: async () => ({ passed: true, message: 'All JWT test vectors verified' }),
        SECURITY: async () => ({ passed: true })
      }
    });

    assert.strictEqual(verif.verificationResult.status, 'PASS');
    assert.strictEqual(verif.arbitration.decision, 'COMPLETE');

    // 4. Supervisor completes task
    taskDao.updateStatus(e2eSession.task.id, 'COMPLETED');
    const finalTask = taskDao.getById(e2eSession.task.id);
    assert.strictEqual(finalTask.status, 'COMPLETED');
  });
});
