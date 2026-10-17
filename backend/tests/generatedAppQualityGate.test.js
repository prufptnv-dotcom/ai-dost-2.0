'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  GeneratedAppQualityGate,
  STATUS,
  computeArtifactHash,
  verifyExecutionReceipt,
  _clearConsumedReceiptsForTesting
} = require('../quality-evaluation/generatedAppQualityGate');
const {
  TEST_RUNNER_SECRET,
  createTestEvidence: createTrustedExecutionEvidence,
  mintTestReceipt: mintExecutionReceipt
} = require('./helpers/receiptTestHelper');

process.env.AIDOST_RUNNER_SECRET = TEST_RUNNER_SECRET;

test('GeneratedAppQualityGate: Execution-Backed Evidence Gate', async (t) => {
  const gate = new GeneratedAppQualityGate();

  const validDashboardFiles = {
    'src/App.jsx': `
import React, { useState } from 'react';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const data = [
    { id: 1, name: 'Alice', role: 'Engineer' },
    { id: 2, name: 'Bob', role: 'Designer' }
  ];

  const filtered = data.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const exportCsv = () => {
    const csv = 'id,name,role\\n1,Alice,Engineer';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
  };

  return (
    <div className="dashboard-container">
      <header>
        <h1>SaaS Dashboard</h1>
      </header>
      <div className="controls">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search items..."
        />
        <button onClick={exportCsv}>Export CSV</button>
      </div>
      <svg className="chart-preview" width="200" height="100">
        <rect width="50" height="80" fill="blue" />
      </svg>
      <table>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}><td>{row.name}</td><td>{row.role}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`
  };

  await t.test('1. Static analysis alone yields STATIC_DIAGNOSTIC_PASS, never false VERIFIED_PASS', async () => {
    _clearConsumedReceiptsForTesting();
    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      executionEvidence: null
    });

    assert.strictEqual(res.status, STATUS.STATIC_DIAGNOSTIC_PASS, 'Static-only tokens must produce STATIC_DIAGNOSTIC_PASS, not VERIFIED_PASS');
    assert.notStrictEqual(res.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(res.layers.staticDiagnostics.passed, true);
    assert.strictEqual(res.layers.buildExecution.executed, false);
    assert.strictEqual(res.layers.unitTests.executed, false);
  });

  await t.test('2. Real passing execution evidence with valid receipt elevates status to VERIFIED_PASS', async () => {
    _clearConsumedReceiptsForTesting();
    const evidence = createTrustedExecutionEvidence({
      files: validDashboardFiles,
      runId: 'run-valid-1',
      build: { success: true, exitCode: 0, output: 'Vite v5.0 built in 320ms' },
      tests: { testsRun: 5, testsPassed: 5, testsFailed: 0 },
      runtime: { started: true, port: 3000 },
      acceptance: { passed: true, flowsTested: 3, flowsFailed: 0 }
    });

    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-valid-1',
      executionEvidence: evidence
    });

    assert.strictEqual(res.status, STATUS.VERIFIED_PASS, 'Real passing tests and build must produce VERIFIED_PASS');
    assert.strictEqual(res.layers.executionReceipt.verified, true);
    assert.strictEqual(res.layers.buildExecution.passed, true);
    assert.strictEqual(res.layers.unitTests.passed, true);
    assert.strictEqual(res.layers.acceptanceFlows.passed, true);
  });

  await t.test('3. Fabricated or caller-supplied execution evidence without receipt is rejected', async () => {
    _clearConsumedReceiptsForTesting();
    const fabricatedEvidence = {
      build: { success: true, exitCode: 0 },
      tests: { testsRun: 10, testsPassed: 10, testsFailed: 0 },
      acceptance: { passed: true }
    };

    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-fabricated-1',
      executionEvidence: fabricatedEvidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'FABRICATED_OR_UNTRUSTED_EVIDENCE'));
  });

  await t.test('4. Evidence with mismatched artifact hash is rejected with ARTIFACT_HASH_MISMATCH', async () => {
    _clearConsumedReceiptsForTesting();
    const otherFiles = {
      'src/App.jsx': 'export default function Other() { return <div>Other</div>; }'
    };
    const otherEvidence = createTrustedExecutionEvidence({
      files: otherFiles,
      runId: 'run-other-1',
      build: { success: true, exitCode: 0 },
      acceptance: { passed: true, flowsTested: 2 }
    });

    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-other-1',
      executionEvidence: otherEvidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'ARTIFACT_HASH_MISMATCH'));
  });

  await t.test('5. Complex application with build passing but acceptance flow failing yields FAILED', async () => {
    _clearConsumedReceiptsForTesting();
    const evidenceWithFailingAcceptance = createTrustedExecutionEvidence({
      files: validDashboardFiles,
      runId: 'run-fail-acceptance-1',
      build: { success: true, exitCode: 0, output: 'Build succeeded' },
      tests: { testsRun: 5, testsPassed: 5, testsFailed: 0 },
      acceptance: { passed: false, flowsTested: 3, flowsFailed: 1 } // Critical flow failed
    });

    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-fail-acceptance-1',
      executionEvidence: evidenceWithFailingAcceptance
    });

    assert.strictEqual(res.status, STATUS.FAILED, 'Acceptance flow failure on complex app must fail the quality gate');
    assert.strictEqual(res.layers.acceptanceFlows.passed, false);
  });

  await t.test('6. Complex application with build passing but unexecuted acceptance flow yields PARTIAL', async () => {
    _clearConsumedReceiptsForTesting();
    const evidenceWithoutAcceptance = createTrustedExecutionEvidence({
      files: validDashboardFiles,
      runId: 'run-no-acceptance-1',
      build: { success: true, exitCode: 0, output: 'Build succeeded' },
      tests: { testsRun: 4, testsPassed: 4, testsFailed: 0 },
      acceptance: { passed: false, flowsTested: 0, flowsFailed: 0 } // No acceptance flows run
    });

    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-no-acceptance-1',
      executionEvidence: evidenceWithoutAcceptance
    });

    // Build alone on complex application does not prove interactions work
    assert.strictEqual(res.status, STATUS.PARTIAL);
    assert.notStrictEqual(res.status, STATUS.VERIFIED_PASS);
  });

  await t.test('7. Forbidden placeholder anti-pattern yields FAILED status', async () => {
    _clearConsumedReceiptsForTesting();
    const antiPatternFiles = {
      'src/App.jsx': `
export default function App() {
  return (
    <div>
      <input type="text" placeholder="search" />
      <button onClick={() => {}}>Export</button>
      <div>TODO: implement export</div>
    </div>
  );
}
`
    };

    const res = await gate.evaluate({
      files: antiPatternFiles,
      caseId: 'dashboard-search-charts-csv'
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.ok(res.defects.some((d) => d.type === 'ANTI_PATTERN_DETECTED' || d.type === 'EMPTY_EVENT_HANDLER'));
  });

  await t.test('8. Missing or unknown canonical case ID returns NOT_EVALUATED cleanly', async () => {
    _clearConsumedReceiptsForTesting();
    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'non-existent-case-id'
    });

    assert.strictEqual(res.status, STATUS.NOT_EVALUATED);
    assert.ok(res.errors[0].includes('Unknown canonical case ID'));
    assert.match(res.reason, /Unknown or unsupported canonical case ID/);
  });
});
