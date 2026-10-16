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
  CANONICAL_CASE_IDS
} = require('../quality-evaluation/generatedAppQualityGate');

const {
  TEST_RUNNER_SECRET,
  mintTestReceipt,
  createTestEvidence
} = require('./helpers/receiptTestHelper');

const { AlgorithmVerifier } = require('../quality-evaluation/algorithmVerifier');
const { executeCandidateRunner, checkOsIsolationAvailable } = require('../quality-evaluation/executionSandbox');
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
    process.env.AIDOST_CONTAINER_ISOLATION = 'true';
    
    // checkOsIsolationAvailable actively probes CLI and returns false if daemon is not operational
    const isolationAvailable = checkOsIsolationAvailable();
    assert.strictEqual(isolationAvailable, false);

    // Running with requireOsIsolation: true fails closed
    const runRes = await executeCandidateRunner({
      code: 'function solve(){ return 42; }',
      spec: { mode: 'function', names: ['solve'], cases: [{ id: 'c1', args: [] }] },
      requireOsIsolation: true
    });
    assert.strictEqual(runRes.status, 'SANDBOX_UNAVAILABLE');
    assert.match(runRes.error, /SANDBOX_UNAVAILABLE/);
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

});
