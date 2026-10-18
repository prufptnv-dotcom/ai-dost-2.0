'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const {
  ensureLocalUrl,
  parseSseFrame,
  safeProjectFilePath,
  loadCanonicalCases,
  getSeedFiles,
  getGateEvidence,
  deriveRunResult
} = require('../scripts/run-canonical-app-benchmark');

test('canonical benchmark loads exactly six unique cases', () => {
  const cases = loadCanonicalCases();
  assert.equal(cases.length, 6);
  assert.equal(new Set(cases.map((item) => item.id)).size, 6);
});

test('loopback endpoint is accepted and remote backend URLs are rejected', () => {
  assert.equal(ensureLocalUrl('http://127.0.0.1:5000/'), 'http://127.0.0.1:5000');
  assert.equal(ensureLocalUrl('http://localhost:5000'), 'http://localhost:5000');
  assert.throws(() => ensureLocalUrl('https://example.com'), /loopback/);
  assert.throws(() => ensureLocalUrl('file:///tmp/backend'), /loopback/);
});

test('SSE event parser preserves type and JSON payload', () => {
  const parsed = parseSseFrame('event: quality_gate_evaluation\n' +
    'data: {"status":"VERIFIED_PASS","gateResult":{"score":92}}\n');
  assert.equal(parsed.type, 'quality_gate_evaluation');
  assert.equal(parsed.status, 'VERIFIED_PASS');
  assert.equal(parsed.gateResult.score, 92);
  assert.equal(parseSseFrame('data: [DONE]').type, 'done');
});

test('captured generated-file paths cannot escape the artifact workspace', () => {
  const root = path.join(os.tmpdir(), 'aidost-canonical-benchmark-test');
  assert.equal(safeProjectFilePath(root, 'src/App.jsx'), path.join(root, 'src', 'App.jsx'));
  assert.throws(() => safeProjectFilePath(root, '../outside.txt'), /Unsafe generated path/);
  assert.throws(() => safeProjectFilePath(root, path.resolve(root, 'outside.txt')), /Unsafe generated path/);
});

test('repair case seeds genuine failing immutability and projectId tests', () => {
  const seed = getSeedFiles('multi-step-repair');
  assert.ok(seed['src/taskService.js'].includes('state.tasks.push'));
  assert.ok(seed['src/taskService.js'].includes("return '/api/items'"));
  assert.ok(seed['tests/repair.test.js'].includes('original state'));
  assert.deepEqual(getSeedFiles('dashboard-search-charts-csv'), {});
});

test('missing runtime gate or trusted receipt never turns into a pass', () => {
  const missing = getGateEvidence([]);
  assert.equal(missing.status, 'NOT_EVALUATED');
  const events = [
    { type: 'director_start' },
    { type: 'quality_gate_evaluation', status: 'VERIFIED_PASS', gateResult: {
      status: 'VERIFIED_PASS',
      score: 90,
      coveragePercent: 100,
      artifactHash: 'artifact-hash',
      layers: {
        executionReceipt: { executed: true, verified: true },
        buildExecution: { executed: true, passed: true },
        unitTests: { executed: true, passed: true },
        acceptanceFlows: { executed: true, passed: true }
      }
    } },
    { type: 'director_complete', status: 'SUCCEEDED' }
  ];
  const pass = deriveRunResult(events, null, null, [], [{ path: 'src/App.jsx', bytes: 10 }], 1234);
  assert.equal(pass.generationCompleted, true);
  assert.equal(pass.caseStatus, 'VERIFIED_PASS');
  assert.equal(pass.acceptanceStatus, 'PASSED');

  events[1].gateResult.layers.executionReceipt.verified = false;
  const noReceipt = deriveRunResult(events, null, null, [], [{ path: 'src/App.jsx', bytes: 10 }], 1234);
  assert.equal(noReceipt.acceptanceStatus, 'FAILED_OR_PARTIAL');
});
