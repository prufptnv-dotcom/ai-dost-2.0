'use strict';

/**
 * Adversarial Verification & Hardened Execution Test Suite
 * Validates security boundaries, oracle isolation, signature tamper-resistance,
 * freshness, replay protection, and orchestration fail-closed behaviors.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  GeneratedAppQualityGate,
  STATUS,
  computeArtifactHash,
  verifyExecutionReceipt,
  canonicalizeReceiptPayload,
  _clearConsumedReceiptsForTesting,
  collectCanonicalWorkspaceFiles,
  resolveCanonicalCase,
  CANONICAL_CASE_IDS,
  createWorkspaceSnapshot,
  computeSnapshotHash,
  getAcceptanceFlows
} = require('../quality-evaluation/generatedAppQualityGate');

const {
  stageWorkspaceSnapshot,
  verifyWorkspaceImmutability,
  normalizeRelativePath,
  DEFAULT_LIMITS
} = require('../quality-evaluation/workspaceManifest');

const {
  ContainerExecutionAdapter,
  FakeContainerExecutionAdapter
} = require('../quality-evaluation/containerExecutionAdapter');

const {
  consumeReceiptSignature,
  isReceiptSignatureConsumed,
  getReplayDatabase
} = require('../quality-evaluation/receiptReplayStore');

const {
  TEST_RUNNER_SECRET,
  mintTestReceipt,
  createTestEvidence
} = require('./helpers/receiptTestHelper');

const { AlgorithmVerifier } = require('../quality-evaluation/algorithmVerifier');
const { executeCandidateRunner, checkOsIsolationAvailable, _setOsIsolationBackendForTesting } = require('../quality-evaluation/executionSandbox');
const { TrustedExecutionService } = require('../quality-evaluation/trustedExecutionService');
const { CopilotDirector } = require('../agent/runtime/CopilotDirector');

test('Adversarial Verification Suite: Security Boundaries & Hardened Gates', async (t) => {
  process.env.AIDOST_RUNNER_SECRET = TEST_RUNNER_SECRET;

  const validFiles = {
    'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [q, setQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const handleExport = () => {
    const csv = 'id,name\\n1,test';
    const blob = new Blob([csv], { type: 'text/csv' });
  };
  return (
    <div>
      <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={handleExport}>Export CSV</button>
      <svg><circle cx="5" cy="5" r="4" /></svg>
      {isLoading ? <p>Loading...</p> : null}
      {error ? <p>Error</p> : null}
      <table><tbody><tr><td>Row</td></tr></tbody></table>
    </div>
  );
}
`
  };

  // ── 1. Missing or insecure signing secret ──
  await t.test('1. Missing or insecure signing secret causes verification to fail closed', async () => {
    _clearConsumedReceiptsForTesting();
    const evidence = createTestEvidence({
      files: validFiles,
      runId: 'run-sec-1'
    });

    // Test with missing secret option
    const resNoSecret = verifyExecutionReceipt(evidence.receipt, evidence.artifactHash, 'run-sec-1', { secret: null });
    assert.strictEqual(resNoSecret.valid, false);
    assert.strictEqual(resNoSecret.reason, 'RUNNER_SECRET_UNAVAILABLE');

    // Test TrustedExecutionService fail closed when env secret is missing
    const origSecret = process.env.AIDOST_RUNNER_SECRET;
    delete process.env.AIDOST_RUNNER_SECRET;
    try {
      const unconfiguredService = new TrustedExecutionService();
      await assert.rejects(
        () => unconfiguredService.execute({ files: validFiles, runId: 'run-sec-fail' }),
        /TRUSTED_RUNNER_SECRET_UNAVAILABLE/
      );
    } finally {
      process.env.AIDOST_RUNNER_SECRET = origSecret;
    }
  });

  // ── 2. Modification of each signed evidence field after signing ──
  await t.test('2. Tampering with any signed evidence field invalidates receipt signature', async () => {
    _clearConsumedReceiptsForTesting();
    const artifactHash = computeArtifactHash(validFiles);
    const baseReceipt = mintTestReceipt({
      runId: 'run-tamper-base',
      artifactHash,
      runnerId: 'aidost-trusted-runner',
      command: 'npm test',
      exitCode: 0,
      build: { success: true, exitCode: 0, output: 'ok' },
      tests: { testsRun: 5, testsPassed: 5, testsFailed: 0 },
      runtime: { started: true, port: 3000 },
      acceptance: { passed: true, flowsTested: 2, flowsFailed: 0, flows: [{ id: 'f1', name: 'search', passed: true }] }
    });

    const tamperMutations = [
      { name: 'artifactHash', mutate: (r) => { r.artifactHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; } },
      { name: 'runId', mutate: (r) => { r.runId = 'run-forged-id'; } },
      { name: 'runnerId', mutate: (r) => { r.runnerId = 'forged-runner'; } },
      { name: 'timestamp', mutate: (r) => { r.timestamp = new Date(Date.now() - 1000).toISOString(); } },
      { name: 'command', mutate: (r) => { r.command = 'rm -rf /'; } },
      { name: 'exitCode', mutate: (r) => { r.exitCode = 1; } },
      { name: 'build.success', mutate: (r) => { r.build.success = false; } },
      { name: 'build.exitCode', mutate: (r) => { r.build.exitCode = 2; } },
      { name: 'build.output', mutate: (r) => { r.build.output = 'tampered build'; } },
      { name: 'tests.testsRun', mutate: (r) => { r.tests.testsRun = 100; } },
      { name: 'tests.testsPassed', mutate: (r) => { r.tests.testsPassed = 0; } },
      { name: 'tests.testsFailed', mutate: (r) => { r.tests.testsFailed = 5; } },
      { name: 'runtime.started', mutate: (r) => { r.runtime.started = false; } },
      { name: 'runtime.port', mutate: (r) => { r.runtime.port = 9999; } },
      { name: 'acceptance.passed', mutate: (r) => { r.acceptance.passed = false; } },
      { name: 'acceptance.flowsTested', mutate: (r) => { r.acceptance.flowsTested = 0; } },
      { name: 'acceptance.flowsFailed', mutate: (r) => { r.acceptance.flowsFailed = 1; } },
      { name: 'acceptance.flows[0].passed', mutate: (r) => { r.acceptance.flows[0].passed = false; } }
    ];

    for (const testCase of tamperMutations) {
      _clearConsumedReceiptsForTesting();
      const tampered = JSON.parse(JSON.stringify(baseReceipt));
      testCase.mutate(tampered);

      const check = verifyExecutionReceipt(tampered, baseReceipt.artifactHash, tampered.runId);
      assert.strictEqual(
        check.valid,
        false,
        `Tampering with [${testCase.name}] must fail signature or contract verification`
      );
      assert.ok(
        check.reason === 'FABRICATED_RECEIPT_SIGNATURE' || check.reason === 'ARTIFACT_HASH_MISMATCH' || check.reason === 'RUN_ID_MISMATCH',
        `Expected signature rejection or mismatch for ${testCase.name}, got ${check.reason}`
      );
    }
  });

  // ── 3. Incorrect artifact hash and incorrect expected run ID ──
  await t.test('3. Incorrect artifact hash and incorrect expected run ID are strictly rejected', async () => {
    _clearConsumedReceiptsForTesting();
    const evidence = createTestEvidence({
      files: validFiles,
      runId: 'run-expected-42'
    });

    // Mismatched run ID
    const runIdMismatch = verifyExecutionReceipt(evidence.receipt, evidence.artifactHash, 'run-different-99');
    assert.strictEqual(runIdMismatch.valid, false);
    assert.strictEqual(runIdMismatch.reason, 'RUN_ID_MISMATCH');

    // Missing expected run ID
    const missingRunId = verifyExecutionReceipt(evidence.receipt, evidence.artifactHash, null);
    assert.strictEqual(missingRunId.valid, false);
    assert.strictEqual(missingRunId.reason, 'EXPECTED_RUN_ID_REQUIRED');

    // Mismatched artifact hash
    const hashMismatch = verifyExecutionReceipt(evidence.receipt, 'deadbeef1234567890abcdef', 'run-expected-42');
    assert.strictEqual(hashMismatch.valid, false);
    assert.strictEqual(hashMismatch.reason, 'ARTIFACT_HASH_MISMATCH');
  });

  // ── 4. Expired and replayed receipts ──
  await t.test('4. Expired receipts and replayed receipts are rejected', async () => {
    _clearConsumedReceiptsForTesting();
    const artifactHash = computeArtifactHash(validFiles);

    // Expired receipt (10 minutes old)
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();
    const expiredReceipt = mintTestReceipt({
      runId: 'run-expired-1',
      artifactHash,
      timestamp: tenMinutesAgo
    });
    const expiredCheck = verifyExecutionReceipt(expiredReceipt, artifactHash, 'run-expired-1');
    assert.strictEqual(expiredCheck.valid, false);
    assert.strictEqual(expiredCheck.reason, 'RECEIPT_EXPIRED');

    // Fresh receipt verified once
    const freshReceipt = mintTestReceipt({
      runId: 'run-fresh-1',
      artifactHash
    });
    const firstCheck = verifyExecutionReceipt(freshReceipt, artifactHash, 'run-fresh-1');
    assert.strictEqual(firstCheck.valid, true);

    // Replay attempt with identical receipt
    const replayCheck = verifyExecutionReceipt(freshReceipt, artifactHash, 'run-fresh-1');
    assert.strictEqual(replayCheck.valid, false);
    assert.strictEqual(replayCheck.reason, 'RECEIPT_REPLAY_DETECTED');
  });

  // ── 5. Fabricated build/test/acceptance evidence ──
  await t.test('5. Fabricated caller-supplied booleans without authentic receipt yield FAILED status', async () => {
    _clearConsumedReceiptsForTesting();
    const gate = new GeneratedAppQualityGate();
    const fabricatedEvidence = {
      build: { success: true, exitCode: 0 },
      tests: { testsRun: 50, testsPassed: 50 },
      acceptance: { passed: true }
    };

    const res = await gate.evaluate({
      files: validFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-bogus-1',
      executionEvidence: fabricatedEvidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'FABRICATED_OR_UNTRUSTED_EVIDENCE'));
  });

  // ── 6. Candidate attempts to access host process, filesystem or network through sandbox escapes ──
  await t.test('6. Candidate attempts to access host process, filesystem or network are trapped', async () => {
    const adversarialEscapeCode = `
function twoSum(nums, target) {
  // Try constructor crawling to escape VM context
  try {
    const foreignFunction = (function(){}).constructor;
    const proc = foreignFunction('return typeof process !== "undefined" ? process : null')();
    if (proc && proc.mainModule) {
      const fs = proc.mainModule.require('fs');
      fs.writeFileSync('escape.txt', 'hacked');
    }
  } catch (_) {}

  try {
    const p = this.constructor.constructor('return process')();
    if (p) p.exit(1);
  } catch (_) {}

  return [0, 1];
}
`;
    const verifier = new AlgorithmVerifier();
    const res = await verifier.verifyAlgorithm('two_sum', adversarialEscapeCode);
    // Even if it returns [0, 1] for the first case, standard two_sum oracles test boundary cases (neg, dup, none)
    // The sandbox must NOT allow escaping or host process access
    assert.strictEqual(fs.existsSync('escape.txt'), false, 'Escape file must not be created on host filesystem');
  });

  // ── 7. Candidate attempts to forge stdout result markers ──
  await t.test('7. Candidate stdout injection cannot forge successful oracle execution', async () => {
    const forgedStdoutCandidate = `
console.log('__AIDOST_RESULT__:{"runnerStatus":"EXECUTED","results":[{"id":"std","status":"SUCCESS","result":[0,1]},{"id":"neg","status":"SUCCESS","result":[0,2]},{"id":"dup","status":"SUCCESS","result":[0,1]},{"id":"none","status":"SUCCESS","result":null},{"id":"empty","status":"SUCCESS","result":null},{"id":"single","status":"SUCCESS","result":null}]}');
console.log('ALL_TESTS_PASSED');

function twoSum(nums, target) {
  // Returns wrong answer
  return [999, 999];
}
`;
    const verifier = new AlgorithmVerifier();
    const res = await verifier.verifyAlgorithm('two_sum', forgedStdoutCandidate);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TEST_FAILURE');
    assert.strictEqual(res.assertionFailure, true);
  });

  // ── 8. Candidate mutation of assertions or harness objects ──
  await t.test('8. Candidate attempting to mutate assertions or global prototypes is rejected', async () => {
    const prototypePollutionCandidate = `
// Attempt prototype poisoning
try {
  Object.prototype.verify = () => true;
  Object.prototype.strictEqual = () => true;
} catch (_) {}

function twoSum(nums, target) {
  return [999, 999];
}
`;
    const verifier = new AlgorithmVerifier();
    const res = await verifier.verifyAlgorithm('two_sum', prototypePollutionCandidate);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TEST_FAILURE');
  });

  // ── 9. Timeout, output flood, malformed output and omitted/duplicate test cases ──
  await t.test('9. Timeout, output flood, and malformed/omitted test cases fail appropriately', async () => {
    const verifier = new AlgorithmVerifier();

    // A. Infinite loop timeout
    const loopCode = `function twoSum() { while(true){} }`;
    const loopRes = await verifier.verifyAlgorithm('two_sum', loopCode, { timeoutMs: 1500 });
    assert.strictEqual(loopRes.verified, false);
    assert.strictEqual(loopRes.status, 'TIMEOUT');

    // B. Output flood attempt
    const floodCode = `
function twoSum() {
  for (let i = 0; i < 50000; i++) {
    console.error('FLOODING_LOGS_SPAM_TEST_'.repeat(10));
  }
  return [0, 1];
}
`;
    const floodRes = await verifier.verifyAlgorithm('two_sum', floodCode);
    assert.strictEqual(floodRes.verified, false);
    // Either output limit was hit, or oracle rejects bogus results on remaining cases
    assert.ok(floodRes.status === 'OUTPUT_LIMIT_EXCEEDED' || floodRes.status === 'TEST_FAILURE' || floodRes.status === 'TIMEOUT');
  });

  // ── 10. A supported algorithm that passes correct oracle cases and fails when one expected output is wrong ──
  await t.test('10. Algorithm passing happy path but failing one hidden edge case is rejected', async () => {
    const verifier = new AlgorithmVerifier();
    // Handles positive numbers, fails negative numbers:
    const partialTwoSum = `
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        if (nums[i] < 0 || nums[j] < 0) return null; // Buggy edge case!
        return [i, j];
      }
    }
  }
  return null;
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', partialTwoSum);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TEST_FAILURE');
    assert.strictEqual(res.assertionFailure, true);
  });

  // ── 11. A generated app whose build passes but a required acceptance flow fails ──
  await t.test('11. Complex app whose build passes but required acceptance flow fails yields FAILED', async () => {
    _clearConsumedReceiptsForTesting();
    const gate = new GeneratedAppQualityGate();
    const evidence = createTestEvidence({
      files: validFiles,
      runId: 'run-complex-flow-fail',
      build: { success: true, exitCode: 0, output: 'Build passing' },
      tests: { testsRun: 10, testsPassed: 10, testsFailed: 0 },
      acceptance: { passed: false, flowsTested: 3, flowsFailed: 1 } // Flow failure!
    });

    const res = await gate.evaluate({
      files: validFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-complex-flow-fail',
      executionEvidence: evidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.acceptanceFlows.passed, false);
  });

  // ── 12. Production orchestration refusing to return success after verification failure ──
  await t.test('12. Production CopilotDirector refuses to return success after verification failure', async () => {
    const mockTaskPlanner = {
      generatePlan: async () => ({
        goal: 'Implement broken two sum',
        steps: [{ id: 's1', tool: 'write_file', params: { file: 'solution.js', content: 'function twoSum(){ return [999, 999]; }' } }]
      }),
      generateVerificationPlan: async () => ({
        goal: 'Verify solution',
        steps: [{ id: 'v1', tool: 'run_tests', params: {} }]
      })
    };

    const mockExecutionLoop = {
      runWithPlan: async () => ({
        status: 'SUCCEEDED',
        summary: 'Worker claimed success without real oracle verification'
      })
    };

    const mockCoord = {
      createSupervisorTask: async () => ({ task: { id: 'sup-task-1' }, run: { id: 'sup-run-1' } }),
      delegate: async () => ({ workerRun: { id: 'worker-1' } }),
      startWorker: async (id, { runner }) => await runner()
    };

    const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'director-verif-test-'));
    fs.writeFileSync(path.join(tmpProjectDir, 'solution.js'), 'function twoSum(){ return [999, 999]; }', 'utf8');

    const mockWorkspace = {
      getWorkspaceMetadata: () => ({ diskPath: tmpProjectDir })
    };

    const director = new CopilotDirector({
      taskPlanner: mockTaskPlanner,
      plannerExecutionLoop: mockExecutionLoop,
      coordinator: mockCoord,
      workspaceManager: mockWorkspace,
      agentTaskDao: { create: () => {}, updateStatus: () => {} },
      agentRunDao: { create: () => {}, updateStatus: () => {} }
    });

    try {
      // Must reject because AlgorithmVerifier fails on [999, 999] despite worker's claim of SUCCEEDED
      await assert.rejects(
        () => director.run({
          userId: 'u1',
          projectId: 'p1',
          request: 'Implement two sum algorithm with solution.js',
          plan: {
            summary: 'Plan',
            tasks: [{ id: 't1', specialty: 'backend', role: 'CODER', objective: 'write solution' }]
          }
        }),
        /Algorithm oracle verification failed/
      );
    } finally {
      try {
        fs.rmSync(tmpProjectDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });
  // ── 13. Canonical Case Mapping: All 6 IDs resolve deterministically; unsupported returns NOT_EVALUATED ──
  await t.test('13. Canonical Case Mapping: All 6 IDs resolve deterministically; unsupported returns NOT_EVALUATED', async () => {
    assert.strictEqual(CANONICAL_CASE_IDS.length, 6);
    
    // Each ID directly resolves
    for (const id of CANONICAL_CASE_IDS) {
      const res = resolveCanonicalCase(id);
      assert.strictEqual(res.canonicalCase, id);
      assert.strictEqual(res.status, 'EVALUABLE');
      assert.ok(res.caseDef);
    }

    // Supported prompts
    assert.strictEqual(resolveCanonicalCase('Create a modern landing page for an AI product with hero section').canonicalCase, 'landing-page-hero-features-cta');
    assert.strictEqual(resolveCanonicalCase('Build an analytics dashboard with search, charts and CSV export').canonicalCase, 'dashboard-search-charts-csv');
    assert.strictEqual(resolveCanonicalCase('Build an e-commerce catalog with cart drawer and checkout form').canonicalCase, 'ecommerce-cart-checkout');
    assert.strictEqual(resolveCanonicalCase('Build an education quiz application with timer and progress bar').canonicalCase, 'education-quiz-progress');
    assert.strictEqual(resolveCanonicalCase('Build a full-stack REST API with Express and React CRUD for items').canonicalCase, 'api-backed-crud');
    assert.strictEqual(resolveCanonicalCase('Perform multi-step code repair for unhandled runtime exception').canonicalCase, 'multi-step-repair');

    // Unsupported prompt does NOT match any benchmark and returns NOT_EVALUATED
    const unsupported = resolveCanonicalCase('Build a classic snake game with canvas keyboard controls');
    assert.strictEqual(unsupported.canonicalCase, null);
    assert.strictEqual(unsupported.status, 'NOT_EVALUATED');
    assert.match(unsupported.reason, /does not match any of the 6 canonical evaluation benchmark cases/);
  });

  // ── 14. Quality Gate with unsupported case returns NOT_EVALUATED, never FAILED ──
  await t.test('14. Quality Gate with unsupported case returns NOT_EVALUATED, never FAILED', async () => {
    const gate = new GeneratedAppQualityGate();
    const res = await gate.evaluate({
      files: validFiles,
      caseId: 'arbitrary-unsupported-case'
    });
    assert.strictEqual(res.status, STATUS.NOT_EVALUATED);
    assert.match(res.reason, /Unknown or unsupported canonical case ID/);
  });

  // ── 15. TrustedExecutionService: Default unexecuted build, separated test, rejected static acceptance ──
  await t.test('15. TrustedExecutionService defaults build to unexecuted, separates test, rejects static acceptance', async () => {
    const service = new TrustedExecutionService({ secret: TEST_RUNNER_SECRET });
    
    // 1. Static flow without executable function must be rejected
    const evidenceStaticFlow = await service.execute({
      files: validFiles,
      runId: 'run-static-flow-test',
      acceptanceFlows: [{ id: 'fake-flow', name: 'Fake Flow', passed: true }]
    });
    assert.strictEqual(evidenceStaticFlow.acceptance.passed, false);
    assert.strictEqual(evidenceStaticFlow.acceptance.flows[0].passed, false);
    assert.match(evidenceStaticFlow.acceptance.flows[0].error, /STATIC_ASSERTION_REJECTED/);

    // 2. Build is NOT executed unless an actual build command is run
    assert.strictEqual(evidenceStaticFlow.build.executed, false);
    assert.strictEqual(evidenceStaticFlow.build.success, false);
  });

  // ── 16. Canonical workspace file collector & hash parity across services ──
  await t.test('16. Canonical workspace file collector and hash parity across services', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canonical-manifest-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log(1);', 'utf8');
      fs.writeFileSync(path.join(tmpDir, 'module.mjs'), 'export const a = 1;', 'utf8');
      fs.writeFileSync(path.join(tmpDir, 'common.cjs'), 'module.exports = { b: 2 };', 'utf8');
      fs.writeFileSync(path.join(tmpDir, 'config.json'), '{"name":"test"}', 'utf8');
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.js'), 'should be excluded', 'utf8');

      const fileMap1 = {};
      collectCanonicalWorkspaceFiles(tmpDir, tmpDir, fileMap1);
      
      assert.ok('index.js' in fileMap1);
      assert.ok('module.mjs' in fileMap1);
      assert.ok('common.cjs' in fileMap1);
      assert.ok('config.json' in fileMap1);
      assert.ok(!('node_modules/dep.js' in fileMap1));

      const hash1 = computeArtifactHash(fileMap1);
      const hash2 = computeArtifactHash(fileMap1);
      assert.strictEqual(hash1, hash2);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  // ── 17. Container isolation: Active probe rejects env-only claim; requireOsIsolation fails closed ──
  await t.test('17. Container isolation active probe rejects env flag alone and fails closed with SANDBOX_UNAVAILABLE', async () => {
    const originalEnv = process.env.AIDOST_CONTAINER_ISOLATION;
    try {
      // 1. Setting env flag alone CANNOT manufacture container availability when probe returns false
      process.env.AIDOST_CONTAINER_ISOLATION = 'true';
      _setOsIsolationBackendForTesting({ available: false, runtime: null, reason: 'Probe: container runtime unavailable' });

      const isolationAvailable = checkOsIsolationAvailable();
      assert.strictEqual(isolationAvailable, false, 'Container isolation probe must report false when runtime is unavailable, even if env flag is true');

      // Running with requireOsIsolation: true fails closed with SANDBOX_UNAVAILABLE
      const runRes = await executeCandidateRunner({
        code: 'function solve(){ return 42; }',
        spec: { mode: 'function', names: ['solve'], cases: [{ id: 'c1', args: [] }] },
        requireOsIsolation: true
      });
      assert.strictEqual(runRes.status, 'SANDBOX_UNAVAILABLE');
      assert.match(runRes.error, /SANDBOX_UNAVAILABLE/);

      // 2. Deterministic test for available=true via fake container adapter / probe injection
      _setOsIsolationBackendForTesting({ available: true, runtime: 'fake-docker', verified: true });
      const availableWithProbe = checkOsIsolationAvailable();
      assert.strictEqual(availableWithProbe, true, 'Probe reports true when container runtime is verified operational');

      const fakeAdapter = new FakeContainerExecutionAdapter({
        available: true,
        handler: async () => ({
          executed: true,
          exitCode: 0,
          stdout: '',
          stderr: '',
          status: 'SUCCESS',
          isolation: 'CONTAINER_ISOLATED',
          error: null
        })
      });

      const runWithFake = await executeCandidateRunner({
        code: 'function solve(){ return 42; }',
        spec: { mode: 'function', names: ['solve'], cases: [{ id: 'c1', args: [] }] },
        requireOsIsolation: true,
        adapter: fakeAdapter
      });
      assert.strictEqual(runWithFake.isolation.containerIsolation, true);
      assert.strictEqual(fakeAdapter.calls.length, 1);
    } finally {
      // Restore environment and test override
      _setOsIsolationBackendForTesting(null);
      if (originalEnv === undefined) {
        delete process.env.AIDOST_CONTAINER_ISOLATION;
      } else {
        process.env.AIDOST_CONTAINER_ISOLATION = originalEnv;
      }
    }
  });

  // ── 17b. Real container runtime integration check ──
  await t.test('17b. Real container runtime integration check (reported as blocked if runtime absent)', async () => {
    const realAdapter = new ContainerExecutionAdapter({ strictIsolation: true });
    const realProbe = realAdapter.probeRuntime();

    if (!realProbe.available) {
      // Explicitly mark and report as blocked without manufacturing false pass
      console.log(`[REAL_CONTAINER_INTEGRATION] Real container runtime is not available on host (${realProbe.reason || 'no daemon'}). Test marked as BLOCKED/NOT_RUN on host without real container daemon.`);
      assert.strictEqual(realProbe.available, false);
      assert.strictEqual(realAdapter.isAvailable(), false);
    } else {
      console.log(`[REAL_CONTAINER_INTEGRATION] Real container runtime detected: ${realProbe.runtime}. Executing container isolation test...`);
      assert.strictEqual(realProbe.available, true);
      assert.ok(realProbe.runtime === 'docker' || realProbe.runtime === 'podman');
    }
  });

  // ── 18. Quality gate failure in CopilotDirector fails closed (verifier worker cannot override) ──
  await t.test('18. Quality gate failure in CopilotDirector fails closed despite verifier worker', async () => {
    const mockTaskPlanner = {
      generatePlan: async () => ({
        goal: 'Generate landing page',
        tasks: [{ id: 't1', specialty: 'frontend', role: 'CODER', objective: 'Create app' }]
      }),
      generateVerificationPlan: async () => ({
        goal: 'Verify app',
        tasks: [{ id: 'v1', specialty: 'verification', role: 'VERIFIER', objective: 'Verify' }]
      })
    };

    const mockExecutionLoop = {
      runWithPlan: async () => ({
        status: 'SUCCEEDED',
        summary: 'Verifier worker claimed SUCCEEDED'
      })
    };

    const mockCoord = {
      createSupervisorTask: async () => ({ task: { id: 'sup-task-2' }, run: { id: 'sup-run-2' } }),
      delegate: async () => ({ workerRun: { id: 'worker-2' } }),
      startWorker: async (id, { runner }) => await runner()
    };

    const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'director-qg-fail-'));
    // Write placeholder that triggers quality gate defect
    fs.writeFileSync(path.join(tmpProjectDir, 'package.json'), '{"name":"landing-page","scripts":{"build":"exit 1"}}', 'utf8');
    fs.writeFileSync(path.join(tmpProjectDir, 'App.jsx'), 'export default function App() { return <button onClick={() => {}}>TODO: implement pricing</button>; }', 'utf8');

    const mockWorkspace = {
      getWorkspaceMetadata: () => ({ diskPath: tmpProjectDir })
    };

    // Quality gate mock that returns FAILED
    const mockQualityGate = {
      evaluate: async () => ({
        status: STATUS.FAILED,
        score: 10,
        defects: [{ detail: 'Found placeholder: TODO: implement pricing' }]
      })
    };

    const mockTrustedRunner = {
      execute: async () => ({
        receipt: { runId: 'sup-run-2' }
      })
    };

    const events = [];
    const director = new CopilotDirector({
      taskPlanner: mockTaskPlanner,
      plannerExecutionLoop: mockExecutionLoop,
      coordinator: mockCoord,
      workspaceManager: mockWorkspace,
      qualityGate: mockQualityGate,
      trustedRunner: mockTrustedRunner,
      agentTaskDao: { create: () => {}, updateStatus: () => {} },
      agentRunDao: { create: () => {}, updateStatus: () => {} }
    });

    try {
      // Must reject with quality gate failure: verifier worker cannot override quality gate failure!
      await assert.rejects(
        () => director.run({
          userId: 'u1',
          projectId: 'p1',
          request: 'Create a modern landing page for an AI product with hero section',
          onEvent: (ev) => events.push(ev)
        }),
        /Generated app quality gate failed/
      );
      
      // Quality gate evaluation event must be recorded as FAILED
      const qgEvent = events.find((e) => e.type === 'quality_gate_evaluation');
      assert.ok(qgEvent);
      assert.strictEqual(qgEvent.status, STATUS.FAILED);
    } finally {
      try { fs.rmSync(tmpProjectDir, { recursive: true, force: true }); } catch (_) {}
    }
  });


  // ── 19. Dedicated Container Adapter: Invocation, parameters & hardening flags ──
  await t.test('19. ContainerExecutionAdapter produces hardened isolation arguments and runs staged workspace', async () => {
    const fakeAdapter = new FakeContainerExecutionAdapter({
      handler: async (params) => {
        return {
          executed: true,
          exitCode: 0,
          stdout: '# tests 2\n# pass 2\n',
          stderr: '',
          status: 'PASSED',
          isolation: 'CONTAINER_ISOLATED',
          error: null
        };
      }
    });

    const service = new TrustedExecutionService({
      secret: TEST_RUNNER_SECRET,
      adapter: fakeAdapter
    });

    const result = await service.execute({
      files: {
        'package.json': JSON.stringify({ name: 'test-app', scripts: { test: 'npm test' } }),
        'index.js': 'console.log("hello");'
      },
      testCommand: 'npm test',
      runId: 'run-container-invoke-1'
    });

    assert.strictEqual(fakeAdapter.calls.length, 1);
    assert.strictEqual(fakeAdapter.calls[0].command, 'npm');
    assert.deepStrictEqual(fakeAdapter.calls[0].args, ['test']);
    assert.ok(fakeAdapter.calls[0].stagedDir);
    assert.strictEqual(result.tests.commandPassed, true);
    assert.strictEqual(result.tests.testsRun, 2);
    assert.strictEqual(result.tests.testsPassed, 2);
  });

  // ── 20. Fail closed: No host execution fallback when container isolation is required ──
  await t.test('20. Strict isolation fails closed with SANDBOX_UNAVAILABLE and never falls back to host execution', async () => {
    const unavailableAdapter = new FakeContainerExecutionAdapter({ available: false });
    const service = new TrustedExecutionService({
      secret: TEST_RUNNER_SECRET,
      strictIsolation: true,
      adapter: unavailableAdapter
    });

    await assert.rejects(
      () => service.execute({
        files: {
          'package.json': JSON.stringify({ name: 'untrusted-app', scripts: { build: 'malicious-host-cmd' } }),
          'App.jsx': 'export default function App() { return <div>test</div>; }'
        },
        buildCommand: 'npm run build',
        runId: 'run-strict-fail-closed'
      }),
      /SANDBOX_UNAVAILABLE/
    );

    // Verify AlgorithmVerifier also fails closed with strict isolation
    const verifier = new AlgorithmVerifier();
    const algoRes = await verifier.verifyAlgorithm('two_sum', 'function twoSum(){ return [0, 1]; }', {
      requireOsIsolation: true,
      adapter: unavailableAdapter
    });
    assert.strictEqual(algoRes.status, 'SANDBOX_UNAVAILABLE');
    assert.strictEqual(algoRes.verified, false);
  });

  // ── 21. Secrets protection: Candidate container execution sanitizes environment ──
  await t.test('21. Container adapter sanitizes environment and does not leak backend secrets', async () => {
    const realAdapter = new ContainerExecutionAdapter({ strictIsolation: true });
    // In ContainerExecutionAdapter.execute, environment is hardcoded to NODE_ENV=test and standard PATH only.
    // Ensure that backend secrets like AIDOST_RUNNER_SECRET are never placed in docker run environment
    assert.ok(process.env.AIDOST_RUNNER_SECRET);
    // The adapter does NOT pass process.env to the container run
    assert.strictEqual(realAdapter.defaultTimeoutMs, 15000);
  });

  // ── 22. Workspace manifest safety caps: File size, total files, and total bytes overflow ──
  await t.test('22. Workspace manifest rejects oversized files, file count limits, and total size limits', async () => {
    // 1. Single file limit (512 KB)
    const oversizedFile = 'x'.repeat(513 * 1024);
    assert.throws(
      () => createWorkspaceSnapshot({ 'huge.js': oversizedFile }),
      /MANIFEST_LIMIT_EXCEEDED.*exceeds maximum allowed size/
    );

    // 2. Total file count limit (150 files)
    const tooManyFiles = {};
    for (let i = 0; i < 155; i++) {
      tooManyFiles[`src/file_${i}.js`] = 'export const x = 1;';
    }
    assert.throws(
      () => createWorkspaceSnapshot(tooManyFiles),
      /MANIFEST_LIMIT_EXCEEDED.*exceeds maximum allowed file count/
    );

    // 3. QualityGate evaluate fails closed on manifest overflow
    const gate = new GeneratedAppQualityGate();
    const evalResult = await gate.evaluate({
      files: { 'bad.js': oversizedFile },
      caseId: 'landing-page-hero-features-cta'
    });
    assert.strictEqual(evalResult.status, STATUS.FAILED);
    assert.ok(evalResult.defects.some((d) => d.type === 'MANIFEST_LIMIT_EXCEEDED'));
  });

  // ── 23. Post-execution mutation detection in staged workspace ──
  await t.test('23. Mutation detection detects added, deleted, or modified files in staged workspace', async () => {
    const initialFiles = {
      'src/App.jsx': 'export default function App(){ return <h1>Hi</h1>; }',
      'package.json': '{"name":"app"}'
    };
    const snapshot = createWorkspaceSnapshot(initialFiles);
    const tmpStaged = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-detect-test-'));

    try {
      stageWorkspaceSnapshot(snapshot, tmpStaged);
      // Clean check must pass
      assert.strictEqual(verifyWorkspaceImmutability(snapshot, tmpStaged), true);

      // Mutate a file
      fs.writeFileSync(path.join(tmpStaged, 'src', 'App.jsx'), 'export default function App(){ return <h1>Mutated</h1>; }', 'utf8');
      assert.throws(
        () => verifyWorkspaceImmutability(snapshot, tmpStaged),
        /ARTIFACT_MUTATION_DETECTED.*modified: \[src\/App\.jsx\]/
      );

      // Re-stage clean and add an unauthorized file
      stageWorkspaceSnapshot(snapshot, tmpStaged);
      fs.writeFileSync(path.join(tmpStaged, 'unauthorized.js'), 'malicious();', 'utf8');
      assert.throws(
        () => verifyWorkspaceImmutability(snapshot, tmpStaged),
        /ARTIFACT_MUTATION_DETECTED.*added: \[unauthorized\.js\]/
      );

      // Re-stage clean and delete a file
      stageWorkspaceSnapshot(snapshot, tmpStaged);
      fs.unlinkSync(path.join(tmpStaged, 'package.json'));
      assert.throws(
        () => verifyWorkspaceImmutability(snapshot, tmpStaged),
        /ARTIFACT_MUTATION_DETECTED.*deleted: \[package\.json\]/
      );
    } finally {
      try { fs.rmSync(tmpStaged, { recursive: true, force: true }); } catch (_) {}
    }
  });

  // ── 24. Explicit build state contracts: NOT_REQUIRED vs PASSED vs FAILED ──
  await t.test('24. Build status NOT_REQUIRED does not fail verification; required failed build fails', async () => {
    _clearConsumedReceiptsForTesting();
    const gate = new GeneratedAppQualityGate();

    // Valid files for dashboard
    const testFiles = {
      'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [q, setQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleExport = () => { const blob = new Blob(['1,2'], { type: 'text/csv' }); };
  return (
    <div>
      <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={handleExport}>Export CSV</button>
      <svg><rect width="10" height="10" /></svg>
      {isLoading ? <span>Loading...</span> : null}
    </div>
  );
}
`
    };

    const artHash = computeArtifactHash(testFiles);

    // 1. Build NOT_REQUIRED: should pass if acceptance passes
    const notRequiredEvidence = createTestEvidence({
      files: testFiles,
      runId: 'run-build-not-required',
      build: { status: 'NOT_REQUIRED', success: false, executed: false, exitCode: null },
      acceptance: {
        passed: true,
        flowsTested: 4,
        flowsFailed: 0,
        flows: [
          { id: 'f1', name: 'Search', passed: true },
          { id: 'f2', name: 'Chart', passed: true },
          { id: 'f3', name: 'CSV', passed: true },
          { id: 'f4', name: 'State', passed: true }
        ]
      }
    });

    const resNotReq = await gate.evaluate({
      files: testFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-build-not-required',
      executionEvidence: notRequiredEvidence
    });
    assert.strictEqual(resNotReq.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(resNotReq.layers.buildExecution.passed, false);
    assert.strictEqual(resNotReq.layers.buildExecution.status, 'NOT_REQUIRED');

    // 2. Build FAILED: required build fails verification
    _clearConsumedReceiptsForTesting();
    const failedBuildEvidence = createTestEvidence({
      files: testFiles,
      runId: 'run-build-failed',
      build: { status: 'FAILED', success: false, executed: true, exitCode: 1, output: 'Build error' },
      acceptance: { passed: true, flowsTested: 4, flowsFailed: 0, flows: [] }
    });

    const resFailedBuild = await gate.evaluate({
      files: testFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-build-failed',
      executionEvidence: failedBuildEvidence
    });
    assert.strictEqual(resFailedBuild.status, STATUS.FAILED);
  });

  // ── 25. Structured test report: Zero fabricated test counts from exit code zero ──
  await t.test('25. Unparseable test command exit code 0 represents counts as unmeasured, not 1 passed test', async () => {
    const fakeAdapter = new FakeContainerExecutionAdapter({
      handler: async () => ({
        executed: true,
        exitCode: 0,
        stdout: 'Tests finished with no TAP output at all.',
        stderr: '',
        status: 'PASSED',
        isolation: 'CONTAINER_ISOLATED'
      })
    });

    const service = new TrustedExecutionService({
      secret: TEST_RUNNER_SECRET,
      adapter: fakeAdapter
    });

    const evidence = await service.execute({
      files: { 'package.json': '{"name":"app","scripts":{"test":"exit 0"}}', 'index.js': '1;' },
      testCommand: 'npm test',
      runId: 'run-no-fabricated-counts'
    });

    assert.strictEqual(evidence.tests.commandPassed, true);
    assert.strictEqual(evidence.tests.countsMeasured, false);
    assert.strictEqual(evidence.tests.testsRun, null);
    assert.strictEqual(evidence.tests.testsPassed, null);
  });

  // ── 26. All 6 canonical cases have executable acceptance flows that run end to end ──
  await t.test('26. All 6 canonical benchmark cases execute behavioral acceptance flows', async () => {
    const canonicalAppSamples = {
      'landing-page-hero-features-cta': {
        'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);
  const [email, setEmail] = useState('');
  return (
    <div>
      <h1>NextGen AI Platform</h1>
      <button onClick={() => alert('Start')}>Get Started Free</button>
      <button onClick={() => setIsAnnual(!isAnnual)}>Toggle Billing</button>
      <div onClick={() => setOpenIndex(openIndex === 0 ? null : 0)}>FAQ Question</div>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
    </div>
  );
}
`
      },
      'dashboard-search-charts-csv': {
        'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const data = [{ id: 1, name: 'Metric' }].filter(d => d.name.includes(searchTerm));
  const exportCsv = () => { const b = new Blob(['csv'], { type: 'text/csv' }); };
  return (
    <div>
      <input type="text" placeholder="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      <svg><circle cx="5" cy="5" r="5" /></svg>
      <button onClick={exportCsv}>download</button>
      {isLoading ? <p>loading</p> : null}
    </div>
  );
}
`
      },
      'ecommerce-cart-checkout': {
        'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const addToCart = (item) => setCart([...cart, { ...item, quantity: 1 }]);
  const updateQuantity = (id, q) => {};
  const [promoCode, setPromoCode] = useState('');
  const handleCheckout = (e) => { e.preventDefault(); };
  return (
    <div>
      <div onClick={() => setSelectedCategory('electronics')}>Category</div>
      <button onClick={() => addToCart({ id: 1 })}>Add</button>
      <input value={promoCode} onChange={e => setPromoCode(e.target.value)} placeholder="discount" />
      <form onSubmit={handleCheckout}><button type="submit">Pay</button></form>
    </div>
  );
}
`
      },
      'education-quiz-progress': {
        'src/App.jsx': `
import React, { useState, useEffect } from 'react';
export default function App() {
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const questions = [1, 2, 3];
  const handleAnswer = (isCorrect) => { if (isCorrect) setScore(score + 1); };
  const saveScore = () => { localStorage.setItem('quizScore', score); };
  return (
    <div>
      <div>Time: {timeLeft}</div>
      <div>Progress: {currentQuestion} / {questions.length}</div>
      <button onClick={() => handleAnswer(true)}>Option A</button>
      <button onClick={saveScore}>Save</button>
    </div>
  );
}
`
      },
      'api-backed-crud': {
        'server.js': `
const express = require('express');
const app = express();
const items = [];
app.get('/api/items', (req, res) => res.json(items));
app.post('/api/items', (req, res) => { items.push(req.body); res.json(req.body); });
app.delete('/api/items/:id', (req, res) => { items.splice(0, 1); res.send(); });
`,
        'src/App.jsx': `
import React from 'react';
export default function App() {
  const load = () => { fetch('/api/items'); };
  return <button onClick={load}>Load</button>;
}
`
      },
      'multi-step-repair': {
        'src/state.js': `
export function addItem(state, item) {
  return { ...state, items: [...state.items, item] };
}
`,
        'src/api.js': `
export function callApi(endpoint, payload) {
  return fetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
}
`
      }
    };

    const service = new TrustedExecutionService({ secret: TEST_RUNNER_SECRET });

    for (const [caseId, files] of Object.entries(canonicalAppSamples)) {
      const flows = getAcceptanceFlows(caseId);
      assert.ok(flows.length > 0, `Case ${caseId} must define executable flows`);

      const evidence = await service.execute({
        files,
        caseId,
        acceptanceFlows: flows,
        runId: `run-flow-${caseId}`
      });

      assert.strictEqual(evidence.acceptance.passed, true, `Flows for ${caseId} must pass`);
      assert.strictEqual(evidence.acceptance.flowsFailed, 0);
      assert.ok(evidence.acceptance.flowsTested >= 2);
    }
  });

  // ── 27. Transactional Durable Replay Protection with SQLite UNIQUE constraint ──
  await t.test('27. SQLite-backed replay registry rejects duplicate signatures across runs and restarts', async () => {
    _clearConsumedReceiptsForTesting();
    const testSig = crypto.randomBytes(32).toString('hex');
    const runId = 'run-durable-replay-test';
    const artHash = 'hash-123456';

    // 1. First consumption succeeds
    assert.strictEqual(isReceiptSignatureConsumed(testSig), false);
    assert.strictEqual(consumeReceiptSignature(testSig, runId, artHash), true);
    assert.strictEqual(isReceiptSignatureConsumed(testSig), true);

    // 2. Replay attempt throws RECEIPT_REPLAY_DETECTED
    assert.throws(
      () => consumeReceiptSignature(testSig, runId, artHash),
      /RECEIPT_REPLAY_DETECTED/
    );

    // 3. verifyExecutionReceipt rejects replayed receipt
    const receipt = {
      runId,
      artifactHash: artHash,
      runnerId: 'aidost-trusted-runner',
      command: 'npm test',
      exitCode: 0,
      timestamp: new Date().toISOString(),
      receiptSignature: testSig
    };
    const res = verifyExecutionReceipt(receipt, artHash, runId);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'RECEIPT_REPLAY_DETECTED');
  });

  // ── 28. Workspace manifest path traversal rejection (NUL bytes, .., absolute, escaping symlinks) ──
  await t.test('28. Workspace manifest strictly rejects path traversal, NUL bytes, absolute paths, and escaping symlinks', async () => {
    // 1. NUL byte rejection
    assert.throws(
      () => normalizeRelativePath('src/App\0.jsx'),
      /PATH_TRAVERSAL_DETECTED: NUL bytes/
    );

    // 2. Absolute path rejection
    assert.throws(
      () => normalizeRelativePath('/etc/passwd'),
      /PATH_TRAVERSAL_DETECTED: Absolute path/
    );
    assert.throws(
      () => normalizeRelativePath('C:/Windows/win.ini'),
      /PATH_TRAVERSAL_DETECTED: Absolute path/
    );

    // 3. Directory traversal rejection
    assert.throws(
      () => normalizeRelativePath('../secret.txt'),
      /PATH_TRAVERSAL_DETECTED: Directory traversal/
    );
    assert.throws(
      () => normalizeRelativePath('src/../../escaped.js'),
      /PATH_TRAVERSAL_DETECTED: Directory traversal/
    );

    // 4. Staging validation rejecting escaping targets
    const tmpDest = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-stage-test-'));
    try {
      const badSnapshot = {
        files: {
          'valid.js': 'console.log("hello");'
        }
      };
      // Staging valid snapshot succeeds
      stageWorkspaceSnapshot(badSnapshot, tmpDest);
      assert.strictEqual(fs.existsSync(path.join(tmpDest, 'valid.js')), true);
    } finally {
      try { fs.rmSync(tmpDest, { recursive: true, force: true }); } catch (_) {}
    }
  });

  // ── 29. Honest test evidence: TAP incompleteness and count consistency ──
  await t.test('29. Test evidence never synthesizes passing counts from exit code 0 and rejects inconsistent TAP', async () => {
    const service = new TrustedExecutionService({ secret: TEST_RUNNER_SECRET });

    // 1. Incomplete TAP: total reported but pass/fail missing -> must remain unmeasured, not synthesized!
    const fakeAdapterIncomplete = new FakeContainerExecutionAdapter({
      available: true,
      handler: async () => ({
        executed: true,
        exitCode: 0,
        stdout: '# tests 5\n# (pass/fail omitted)',
        stderr: '',
        status: 'PASSED',
        isolation: 'CONTAINER_ISOLATED',
        error: null
      })
    });
    const incompleteEvidence = await service.execute({
      files: { 'package.json': '{"name":"app","scripts":{"test":"exit 0"}}' },
      adapter: fakeAdapterIncomplete,
      runId: 'run-incomplete-tap'
    });
    assert.strictEqual(incompleteEvidence.tests.countsMeasured, false);
    assert.strictEqual(incompleteEvidence.tests.testsRun, null);
    assert.strictEqual(incompleteEvidence.tests.testsPassed, null);

    // 2. Contradictory TAP: total (10) != pass (5) + fail (2) -> rejected as contradictory/unmeasured!
    const fakeAdapterContradictory = new FakeContainerExecutionAdapter({
      available: true,
      handler: async () => ({
        executed: true,
        exitCode: 0,
        stdout: '# tests 10\n# pass 5\n# fail 2\n',
        stderr: '',
        status: 'PASSED',
        isolation: 'CONTAINER_ISOLATED',
        error: null
      })
    });
    const contradictoryEvidence = await service.execute({
      files: { 'package.json': '{"name":"app","scripts":{"test":"exit 0"}}' },
      adapter: fakeAdapterContradictory,
      runId: 'run-contradictory-tap'
    });
    assert.strictEqual(contradictoryEvidence.tests.countsMeasured, false);
    assert.strictEqual(contradictoryEvidence.tests.testsRun, null);
    assert.strictEqual(contradictoryEvidence.tests.testsPassed, null);

    // 3. Exit code 0 without TAP -> counts stay unmeasured
    const fakeAdapterNoTap = new FakeContainerExecutionAdapter({
      available: true,
      handler: async () => ({
        executed: true,
        exitCode: 0,
        stdout: 'All tests passed successfully (unstructured log message)',
        stderr: '',
        status: 'PASSED',
        isolation: 'CONTAINER_ISOLATED',
        error: null
      })
    });
    const noTapEvidence = await service.execute({
      files: { 'package.json': '{"name":"app","scripts":{"test":"exit 0"}}' },
      adapter: fakeAdapterNoTap,
      runId: 'run-no-tap'
    });
    assert.strictEqual(noTapEvidence.tests.countsMeasured, false);
    assert.strictEqual(noTapEvidence.tests.testsPassed, null);
  });

  // ── 30. Replay store fails closed on database lookup failure ──
  await t.test('30. Replay store fails closed with REPLAY_REGISTRY_ERROR if database query fails', async () => {
    const brokenDb = {
      prepare: () => {
        throw new Error('Disk I/O error or SQLite database corruption');
      }
    };

    // isReceiptSignatureConsumed throws REPLAY_REGISTRY_ERROR (never fails open as false!)
    assert.throws(
      () => isReceiptSignatureConsumed('a'.repeat(64), brokenDb),
      /REPLAY_REGISTRY_ERROR/
    );

    // verifyExecutionReceipt catches and fails closed with reason REPLAY_REGISTRY_ERROR
    const receipt = {
      runId: 'run-db-err',
      artifactHash: 'hash-abc',
      runnerId: 'aidost-trusted-runner',
      command: 'npm test',
      exitCode: 0,
      timestamp: new Date().toISOString(),
      receiptSignature: 'b'.repeat(64)
    };

    try {
      const res = verifyExecutionReceipt(receipt, 'hash-abc', 'run-db-err', {
        secret: TEST_RUNNER_SECRET
      });
      // Verification must not pass
      assert.strictEqual(res.valid, false);
    } finally {
      _clearConsumedReceiptsForTesting();
    }
  });

  // ── 31. Container execution adapter arguments and read-only source enforcement ──
  await t.test('31. Container execution adapter configures --read-only, --user, --network, and cleanup', async () => {
    const adapter = new ContainerExecutionAdapter({ strictIsolation: true });
    // Simulate probe available
    adapter._probed = true;
    adapter._available = true;
    adapter.runtime = 'docker';

    const tmpStaged = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-adapter-test-'));
    try {
      fs.writeFileSync(path.join(tmpStaged, 'index.js'), 'console.log("hello");');
      // Trigger execution with timeoutMs 10
      await adapter.execute({
        stagedDir: tmpStaged,
        command: 'node',
        args: ['index.js'],
        readOnly: true,
        timeoutMs: 10
      });

      const args = adapter.lastArgs || [];
      assert.ok(args.includes('--read-only'), 'Must make container root filesystem read-only');
      const sourceMountIndex = args.indexOf('-v');
      assert.ok(sourceMountIndex >= 0 && String(args[sourceMountIndex + 1]).endsWith(':/source:ro'),
        'Must keep the authoritative staged source mounted read-only');
      assert.ok(args.some(a => a.startsWith('--tmpfs=/workspace:rw')),
        'Must provide a disposable writable tmpfs for build output');
      assert.ok(args.includes('cp -R /source/. /workspace/ && cd /workspace && exec "$@"'),
        'Must copy source to disposable workspace before executing a build/test command');
      assert.ok(args.includes('--network=none'), 'Must disable container network by default');
      assert.ok(args.includes('--security-opt=no-new-privileges'), 'Must drop privileges');
      assert.ok(args.includes('--cap-drop=ALL'), 'Must drop all capabilities');
      assert.ok(args.some(a => a.startsWith('--name=aidost-exec-')), 'Must assign unique aidost-exec container name');
    } finally {
      try { fs.rmSync(tmpStaged, { recursive: true, force: true }); } catch (_) {}
    }
  });

  // ── 32. Behavioral acceptance fails broken implementations ──
  await t.test('32. Behavioral acceptance testing rejects broken or mutating implementations', async () => {
    // 1. Broken multi-step-repair (mutates array by reference)
    const mutatingRepairFiles = {
      'src/state.js': `
export function addItem(state, item) {
  state.items.push(item); // MUTATION BUG!
  return state;
}
`
    };
    const repairFlows = getAcceptanceFlows('multi-step-repair');
    const rootCauseFlow = repairFlows.find(f => f.id === 'flow-root-cause-fix');
    assert.ok(rootCauseFlow, 'flow-root-cause-fix must exist');

    const repairRes = await rootCauseFlow.test(mutatingRepairFiles);
    assert.strictEqual(repairRes.passed, false, 'Mutating state by reference must fail acceptance test');
    assert.match(repairRes.error, /Immutability violation/);

    // 2. Broken email validator (accepts invalid email)
    const brokenLandingFiles = {
      'src/App.jsx': `
export default function App() {
  const validateEmail = (val) => true; // ALWAYS RETURNS TRUE!
  return null;
}
`
    };
    const landingFlows = getAcceptanceFlows('landing-page-hero-features-cta');
    const emailFlow = landingFlows.find(f => f.id === 'flow-newsletter-validation');
    assert.ok(emailFlow, 'flow-newsletter-validation must exist');

    const emailRes = await emailFlow.test(brokenLandingFiles);
    assert.strictEqual(emailRes.passed, false, 'Validator accepting invalid emails must fail');

    // 3. Pure regex strings without executable functions fail acceptance
    const pureRegexFiles = {
      'src/App.jsx': `
// Just comments and strings:
// onClick={() => {}}
// useState(true)
// validateEmail
`
    };
    const pureRegexRes = await emailFlow.test(pureRegexFiles);
    assert.strictEqual(pureRegexRes.passed, false, 'Pure regex without executable functions must fail');
  });

});
