'use strict';

/**
 * AI-Dost 2.0 — Phase 4C: Final Hardening & Real E2E Verification Suite
 *
 * Real, isolated end-to-end testing with actual disk fixtures, subprocess execution,
 * security boundary enforcement, process cleanup, and multi-intent orchestration.
 *
 * Run: node --test tests/testCaseGeneration.e2e.test.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
  TestGenerationPlan,
  TestGenerationValidator,
  TestCaseGenerator,
  TestExecutionManager,
  TestGenerationResult,
  adapters
} = require('../agent/capabilities/testCaseGeneration');

const { capabilityDiscovery } = require('../agent/registry/CapabilityDiscovery');
const { capabilityRegistry } = require('../agent/registry/CapabilityRegistry');
const { capabilityGatekeeper } = require('../agent/policy/CapabilityGatekeeper');
const { FullStackDeliveryOrchestrator } = require('../agent/capabilities/fullStackDelivery');
const transactionManagerModule = require('../services/transactionManager');
const TransactionManager = transactionManagerModule.TransactionManager;
const deterministicCodeGuard = require('../services/DeterministicCodeGuard');

const FIXTURE_DIR = path.join(__dirname, 'fixtures_phase4c_e2e');

describe('AI-Dost 2.0 — Phase 4C Final Hardening & Real E2E Gate', () => {

  before(() => {
    if (fs.existsSync(FIXTURE_DIR)) {
      fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  after(() => {
    try {
      if (fs.existsSync(FIXTURE_DIR)) {
        fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
      }
    } catch {
      // Cleanup best effort
    }
  });

  // =========================================================================
  // 1. REAL END-TO-END WORKFLOW A: NODE UNIT TEST GENERATION & EXECUTION
  // =========================================================================

  test('1. Real E2E A: Generate and execute real node:test for calculator module', async () => {
    // 1. Create real source fixture
    const srcDir = path.join(FIXTURE_DIR, 'src');
    const testsDir = path.join(FIXTURE_DIR, 'tests');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(testsDir, { recursive: true });

    const calcSource = `
function add(a, b) { return Number(a) + Number(b); }
function divide(a, b) {
  if (Number(b) === 0) throw new Error('Division by zero');
  return Number(a) / Number(b);
}
module.exports = { add, divide };
`;
    const srcFile = path.join(srcDir, 'calculator.js');
    fs.writeFileSync(srcFile, calcSource, 'utf8');

    // 2. Request generation
    const gen = new TestCaseGenerator();
    const plan = new TestGenerationPlan({
      projectId: 'calc-e2e',
      workspacePath: FIXTURE_DIR,
      framework: 'node:test',
      language: 'javascript',
      testType: 'unit',
      targetFiles: [srcFile],
      outputDir: testsDir
    });

    const genRes = gen.generate(plan);
    assert.equal(genRes.ok, true);
    assert.equal(genRes.files.length, 1);

    const generatedFile = genRes.files[0];
    const fullTestPath = path.join(testsDir, generatedFile.fileName);
    fs.writeFileSync(fullTestPath, generatedFile.content, 'utf8');

    // 3. Verify real file exists and has content
    assert.ok(fs.existsSync(fullTestPath));
    assert.ok(generatedFile.content.includes("require('node:test')"));

    // 4. Real Execution through TestExecutionManager
    const execMgr = new TestExecutionManager();
    const execRes = await execMgr.execute({
      command: 'node',
      args: ['--test', fullTestPath],
      cwd: FIXTURE_DIR,
      framework: 'node:test',
      timeoutMs: 8000
    });

    assert.equal(execRes.ok, true);
    assert.equal(execRes.exitCode, 0);
    assert.equal(execRes.status, 'EXECUTION_SUCCESS');
    assert.ok(execRes.passed >= 1);
    assert.equal(execRes.failed, 0);

    // 5. Wrap in TestGenerationResult and verify states
    const result = new TestGenerationResult({
      ...genRes,
      status: 'EXECUTED',
      execution: execRes
    });
    assert.equal(result.isSuccess(), true);
    assert.equal(result.status, 'EXECUTED');
  });

  // =========================================================================
  // 2. REAL END-TO-END WORKFLOW B: FAILING TEST CLASSIFICATION
  // =========================================================================

  test('2. Real E2E B: Deliberate failure is accurately classified as ASSERTION_FAILURE', async () => {
    const failingTestPath = path.join(FIXTURE_DIR, 'deliberate_fail.test.js');
    const failingCode = `
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('intentional failure', () => {
  assert.equal(1 + 1, 999, 'Mathematics invariant violated');
});
`;
    fs.writeFileSync(failingTestPath, failingCode, 'utf8');

    const execMgr = new TestExecutionManager();
    const execRes = await execMgr.execute({
      command: 'node',
      args: ['--test', failingTestPath],
      cwd: FIXTURE_DIR,
      timeoutMs: 5000
    });

    assert.equal(execRes.ok, false);
    assert.notEqual(execRes.exitCode, 0);
    assert.equal(execRes.status, 'ASSERTION_FAILURE');
    assert.equal(execRes.failed, 1);
    assert.ok(execRes.stdout.includes('Mathematics invariant violated') || execRes.stderr.includes('Mathematics invariant violated'));
  });

  // =========================================================================
  // 3. REAL END-TO-END WORKFLOW C: TIMEOUT AND PROCESS CLEANUP
  // =========================================================================

  test('3. Real E2E C: Long-running test is killed gracefully on timeout without hanging', async () => {
    const infiniteTestPath = path.join(FIXTURE_DIR, 'infinite_loop.test.js');
    const infiniteCode = `
const { test } = require('node:test');
test('infinite loop test', async () => {
  await new Promise(() => {}); // Never resolves
});
`;
    fs.writeFileSync(infiniteTestPath, infiniteCode, 'utf8');

    const execMgr = new TestExecutionManager();
    const startTime = Date.now();
    const execRes = await execMgr.execute({
      command: 'node',
      args: ['--test', infiniteTestPath],
      cwd: FIXTURE_DIR,
      timeoutMs: 500
    });

    const elapsed = Date.now() - startTime;
    assert.equal(execRes.ok, false);
    assert.equal(execRes.status, 'TIMEOUT');
    assert.equal(execRes.timedOut, true);
    assert.ok(elapsed >= 450 && elapsed < 3500, `Elapsed time was ${elapsed}ms`);
  });

  // =========================================================================
  // 4. ADAPTER SCOPE & MISSING DEPENDENCY ERROR HANDLING
  // =========================================================================

  test('4. Real E2E D: Missing Jest dependency returns structured DEPENDENCY_ERROR without crashing', async () => {
    const emptyFixtureDir = path.join(FIXTURE_DIR, 'empty_pkg');
    fs.mkdirSync(emptyFixtureDir, { recursive: true });
    fs.writeFileSync(path.join(emptyFixtureDir, 'package.json'), JSON.stringify({ name: 'empty' }), 'utf8');

    const execMgr = new TestExecutionManager();
    const res = await execMgr.execute({
      command: 'npx',
      args: ['jest'],
      cwd: emptyFixtureDir,
      framework: 'jest'
    });

    assert.equal(res.ok, false);
    assert.equal(res.status, 'DEPENDENCY_ERROR');
    assert.equal(res.error.code, 'DEPENDENCY_ERROR');
    assert.ok(res.stderr.includes('Jest is not installed'));
  });

  test('5. Real E2E E: Missing Playwright dependency returns structured DEPENDENCY_ERROR', async () => {
    const emptyFixtureDir = path.join(FIXTURE_DIR, 'empty_pkg');
    const execMgr = new TestExecutionManager();
    const res = await execMgr.execute({
      command: 'npx',
      args: ['playwright', 'test'],
      cwd: emptyFixtureDir,
      framework: 'playwright'
    });

    assert.equal(res.ok, false);
    assert.equal(res.status, 'DEPENDENCY_ERROR');
    assert.equal(res.error.code, 'DEPENDENCY_ERROR');
    assert.ok(res.stderr.includes('Playwright'));
  });

  // =========================================================================
  // 5. SECURITY CONTROLS IN EXECUTION PATH
  // =========================================================================

  test('6. Security: Output buffer is capped at 64KB preventing memory exhaustion', async () => {
    const floodTestPath = path.join(FIXTURE_DIR, 'flood_output.test.js');
    const floodCode = `
for (let i = 0; i < 20000; i++) {
  process.stdout.write('A'.repeat(50) + '\\n');
}
`;
    fs.writeFileSync(floodTestPath, floodCode, 'utf8');

    const execMgr = new TestExecutionManager();
    const execRes = await execMgr.execute({
      command: 'node',
      args: [floodTestPath],
      cwd: FIXTURE_DIR,
      timeoutMs: 5000
    });

    assert.ok(execRes.stdout.length <= 66000, `Output length was ${execRes.stdout.length}`);
    assert.ok(execRes.stdout.includes('OUTPUT TRUNCATED'));
  });

  test('7. Security: Path traversal in test arguments is rejected before spawn', async () => {
    const execMgr = new TestExecutionManager();
    const res = await execMgr.execute({
      command: 'node',
      args: ['--test', '../../etc/passwd'],
      cwd: FIXTURE_DIR
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 'SECURITY_VIOLATION');
    assert.equal(res.error.code, 'SECURITY_VIOLATION');
  });

  test('8. Security: .env credential target in test arguments is rejected before spawn', async () => {
    const execMgr = new TestExecutionManager();
    const res = await execMgr.execute({
      command: 'node',
      args: ['--test', '.env'],
      cwd: FIXTURE_DIR
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 'SECURITY_VIOLATION');
    assert.equal(res.error.code, 'SECURITY_VIOLATION');
  });

  test('9. Security: Private key files in test arguments are rejected before spawn', async () => {
    const execMgr = new TestExecutionManager();
    const res = await execMgr.execute({
      command: 'node',
      args: ['--test', 'config/id_rsa.pem'],
      cwd: FIXTURE_DIR
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 'SECURITY_VIOLATION');
  });

  test('10. Security: Shell metacharacter injection in arguments is rejected before spawn', async () => {
    const execMgr = new TestExecutionManager();
    const res = await execMgr.execute({
      command: 'node',
      args: ['--test', 'test.js; rm -rf /'],
      cwd: FIXTURE_DIR
    });
    assert.equal(res.ok, false);
    assert.equal(res.status, 'SECURITY_VIOLATION');
  });

  test('11. Security: Disallowed command (e.g. bash, cmd, powershell, curl) is blocked', async () => {
    const execMgr = new TestExecutionManager();
    for (const badCmd of ['bash', 'cmd', 'powershell', 'curl', 'wget', 'rm']) {
      const res = await execMgr.execute({ command: badCmd, args: ['--version'] });
      assert.equal(res.ok, false);
      assert.equal(res.status, 'DISALLOWED_COMMAND');
    }
  });

  test('12. Security: Environment sanitization strips AWS, Google, Azure, Vercel, and proxy credentials', () => {
    const execMgr = new TestExecutionManager();
    const dirty = {
      SAFE_PATH: '/bin',
      AWS_SECRET_ACCESS_KEY: 'AKIAIOSFODNN7EXAMPLE',
      GOOGLE_APPLICATION_CREDENTIALS: '/path/to/key.json',
      VERCEL_TOKEN: 'vercel_token_123',
      HTTP_PROXY: 'http://proxy.internal:8080',
      GITHUB_TOKEN: 'ghp_123456789012345678901234567890123456'
    };
    const clean = execMgr.sanitizeEnvironment(dirty);
    assert.equal(clean.AWS_SECRET_ACCESS_KEY, undefined);
    assert.equal(clean.GOOGLE_APPLICATION_CREDENTIALS, undefined);
    assert.equal(clean.VERCEL_TOKEN, undefined);
    assert.equal(clean.HTTP_PROXY, undefined);
    assert.equal(clean.GITHUB_TOKEN, undefined);
    assert.equal(clean.NODE_ENV, 'test');
  });

  test('13. Security: Output redactor masks private keys and Google API keys', () => {
    const execMgr = new TestExecutionManager();
    const raw = 'Error with AIzaSyD9876543210ZYXWVUTSRQPONMLKJIHGFED and -----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----';
    const redacted = execMgr.redactOutput(raw);
    assert.ok(!redacted.includes('AIzaSyD9876543210ZYXWVUTSRQPONMLKJIHGFED'));
    assert.ok(!redacted.includes('MIIEvgIBADANBgkqhkiG9w0BAQEFAASC'));
    assert.ok(redacted.includes('***REDACTED_GOOGLE_KEY***'));
    assert.ok(redacted.includes('***REDACTED_PRIVATE_KEY***'));
  });

  test('14. Security: Production database target is strictly rejected by TestGenerationValidator', () => {
    const plan = new TestGenerationPlan({
      databaseTarget: 'postgres://admin:pass@production-db.aws.neon.tech/main'
    });
    const val = TestGenerationValidator.validate(plan);
    assert.equal(val.valid, false);
    assert.ok(val.errors.some(e => e.code === 'PRODUCTION_DATABASE_BLOCKED'));
  });

  // =========================================================================
  // 6. DETERMINISM, USER-AUTHORED TEST PRESERVATION & IDEMPOTENCY
  // =========================================================================

  test('15. Determinism: Existing user-authored test is preserved without overwrite', () => {
    const userTestFile = path.join(FIXTURE_DIR, 'user_existing.test.js');
    const userContent = `
// Custom user-authored test file
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('user custom business rule', () => {
  assert.equal(true, true);
});
`;
    fs.writeFileSync(userTestFile, userContent, 'utf8');

    const gen = new TestCaseGenerator();
    const plan = new TestGenerationPlan({
      workspacePath: FIXTURE_DIR,
      targetFiles: [userTestFile],
      outputDir: '.'
    });

    const res = gen.generate(plan);
    assert.equal(res.ok, true);
    assert.equal(res.files.length, 1);
    assert.equal(res.files[0].preservedUserTests, true);
    assert.equal(res.files[0].content, userContent);
  });

  test('16. Determinism: Repeated generation produces identical output without duplicating tests', () => {
    const gen = new TestCaseGenerator();
    const plan = new TestGenerationPlan({
      targetFiles: ['src/service.js'],
      outputDir: 'tests'
    });

    const run1 = gen.generate(plan);
    const run2 = gen.generate(plan);
    assert.equal(run1.files[0].content, run2.files[0].content);
    assert.equal(run1.testCount, run2.testCount);
  });

  test('17. DeterministicCodeGuard validates generated test code AST and grammar', () => {
    const gen = new TestCaseGenerator();
    const plan = new TestGenerationPlan({
      targetFiles: ['src/math.js'],
      outputDir: 'tests'
    });
    const res = gen.generate(plan);
    assert.equal(res.ok, true);

    const guardResult = deterministicCodeGuard.guard(res.files[0].path, res.files[0].content);
    assert.equal(guardResult.accepted, true);
    assert.equal(guardResult.grammarScore, 1);
  });

  // =========================================================================
  // 7. MULTI-INTENT DISCOVERY & DOWNSTREAM ORCHESTRATION
  // =========================================================================

  test('18. Multi-Intent: Full-stack prompt routes to FullStackDelivery primary with test_case_generation downstream', () => {
    const prompt = 'Build a full-stack SaaS app with authentication, PostgreSQL database, tests and Docker.';
    const res = capabilityDiscovery.discover(prompt);

    assert.equal(res.unresolved_intent, false);
    const matchedIds = res.matched.map(m => m.capability_id);

    // FullStackDelivery must be present and not hijacked solely by test_case_generation
    assert.ok(matchedIds.includes('coding.full_stack_delivery'));
    assert.ok(matchedIds.includes('coding.database_schema_generation'));
    assert.ok(matchedIds.includes('coding.test_case_generation'));
    assert.ok(matchedIds.includes('saas.authentication'));
    assert.ok(matchedIds.includes('devops.docker'));
  });

  test('19. Multi-Intent: Non-generation prompts do NOT trigger test_case_generation', () => {
    const negatives = [
      'run existing tests',
      'what is unit testing?',
      'create a database table'
    ];
    for (const prompt of negatives) {
      const res = capabilityDiscovery.discover(prompt);
      assert.ok(
        !res.matched.some(m => m.capability_id === 'coding.test_case_generation'),
        `Prompt "${prompt}" should NOT match coding.test_case_generation`
      );
    }
  });

  test('20. Multi-Intent: Explicit test generation prompt DOES trigger test_case_generation', () => {
    const res = capabilityDiscovery.discover('generate unit tests for this service');
    assert.ok(res.matched.some(m => m.capability_id === 'coding.test_case_generation'));
  });

  // =========================================================================
  // 8. FULL-STACK DELIVERY & TRANSACTION MANAGER INTEGRATION
  // =========================================================================

  test('21. FullStackDelivery integration places test generation downstream of backend files', () => {
    const orchestrator = new FullStackDeliveryOrchestrator();
    const plan = {
      planId: 'fs_plan_e2e',
      projectName: 'FullAppE2E',
      frontend: { framework: 'react-vite', components: [] },
      backend: { framework: 'express', routes: [] },
      database: { engine: 'sqlite', tables: [{ name: 'users', columns: [{ name: 'id', primaryKey: true }] }] },
      environmentVariables: []
    };

    const backendFiles = orchestrator._generateBackendFiles(plan);
    assert.ok(backendFiles.some(f => f.path === 'server/server.js'), 'Server file must exist');
    assert.ok(backendFiles.some(f => f.path.startsWith('tests/')), 'Test file must be generated downstream');

    const testFile = backendFiles.find(f => f.path.startsWith('tests/'));
    assert.ok(testFile.content.includes("require('node:test')"));
  });

  test('22. TransactionManager atomicity verifies staged test files commit cleanly', () => {
    const txManager = new TransactionManager();
    const txId = 'tx_test_e2e_01';
    const tx = txManager.beginTransaction(txId, FIXTURE_DIR, 'test_project');
    assert.equal(tx.status, 'ACTIVE');

    const stagedFile = {
      path: 'tests/atomic.test.js',
      content: '// Generated by AI Dost 2.0\nconst { test } = require("node:test");\ntest("smoke", () => {});\n'
    };

    txManager.stageNewFile(txId, stagedFile);
    const commitRes = txManager.commit(txId);
    assert.equal(commitRes.success, true);
    assert.equal(commitRes.status, 'COMMITTED');

    const writtenFile = path.join(FIXTURE_DIR, stagedFile.path);
    assert.ok(fs.existsSync(writtenFile));
  });

  test('23. Unsupported framework (vitest, pytest) returns structured UNSUPPORTED_TEST_FRAMEWORK with retryable: false', () => {
    const gen = new TestCaseGenerator();
    const resVitest = gen.generate(new TestGenerationPlan({ framework: 'vitest' }));
    assert.equal(resVitest.ok, false);
    assert.equal(resVitest.error.code, 'UNSUPPORTED_TEST_FRAMEWORK');
    assert.equal(resVitest.error.retryable, false);

    const resPytest = gen.generate(new TestGenerationPlan({ framework: 'pytest' }));
    assert.equal(resPytest.ok, false);
    assert.equal(resPytest.error.code, 'UNSUPPORTED_TEST_FRAMEWORK');
    assert.equal(resPytest.error.retryable, false);
  });

  test('24. CapabilityGatekeeper policy requires confirmation and rejects tampered token', () => {
    const decision = capabilityGatekeeper.evaluate('coding.test_case_generation', {
      requestId: 'req_gate_e2e',
      permissions: ['workspace:write', 'terminal:execute']
    });
    assert.equal(decision.decision, 'REQUIRE_CONFIRMATION');
    assert.ok(decision.approval_token);

    const tampered = capabilityGatekeeper.validateApproval({
      token: decision.approval_token + '_tampered',
      requestId: 'req_gate_e2e',
      capabilityIds: ['coding.test_case_generation']
    });
    assert.equal(tampered.valid, false);
  });

});
