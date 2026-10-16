'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  GeneratedAppQualityGate,
  STATUS,
  createTrustedExecutionEvidence,
  mintExecutionReceipt,
  computeArtifactHash
} = require('../quality-evaluation/generatedAppQualityGate');

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

  const handleExportCSV = () => {
    const csvContent = 'data:text/csv;charset=utf-8,id,name,amount\\n1,salary,5000';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'export.csv');
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="dashboard-container">
      <h1>Financial Analytics Dashboard</h1>
      <input 
        type="text" 
        placeholder="Search transactions..." 
        value={searchQuery} 
        onChange={(e) => setSearchQuery(e.target.value)} 
      />
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All</option>
        <option value="income">Income</option>
      </select>
      <button onClick={handleExportCSV}>Export CSV</button>
      <div className="chart-container">
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Name</th></tr></thead>
        <tbody><tr><td>1</td><td>Salary</td></tr></tbody>
      </table>
    </div>
  );
}
`,
    'package.json': JSON.stringify({ name: 'finance-dashboard', dependencies: { react: '^18.0.0' } })
  };

  await t.test('1. Static analysis alone yields STATIC_DIAGNOSTIC_PASS, never false VERIFIED_PASS', async () => {
    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      executionEvidence: null // No execution evidence
    });

    assert.strictEqual(res.status, STATUS.STATIC_DIAGNOSTIC_PASS, 'Static-only tokens must produce STATIC_DIAGNOSTIC_PASS, not VERIFIED_PASS');
    assert.notStrictEqual(res.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(res.layers.staticDiagnostics.passed, true);
    assert.strictEqual(res.layers.buildExecution.executed, false);
    assert.strictEqual(res.layers.unitTests.executed, false);
  });

  await t.test('2. Real passing execution evidence with valid receipt elevates status to VERIFIED_PASS', async () => {
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
      executionEvidence: evidence
    });

    assert.strictEqual(res.status, STATUS.VERIFIED_PASS, 'Real passing tests and build must produce VERIFIED_PASS');
    assert.strictEqual(res.layers.executionReceipt.verified, true);
    assert.strictEqual(res.layers.buildExecution.passed, true);
    assert.strictEqual(res.layers.unitTests.passed, true);
    assert.strictEqual(res.layers.acceptanceFlows.passed, true);
  });

  await t.test('3. Fabricated or caller-supplied execution evidence without receipt is rejected', async () => {
    const fabricatedEvidence = {
      build: { success: true, exitCode: 0 },
      tests: { testsRun: 10, testsPassed: 10, testsFailed: 0 },
      acceptance: { passed: true }
    };

    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'dashboard-search-charts-csv',
      executionEvidence: fabricatedEvidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'FABRICATED_OR_UNTRUSTED_EVIDENCE'));
  });

  await t.test('4. Evidence with mismatched artifact hash is rejected with ARTIFACT_HASH_MISMATCH', async () => {
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
      executionEvidence: otherEvidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'ARTIFACT_HASH_MISMATCH'));
  });

  await t.test('5. Complex application with build passing but acceptance flow failing yields FAILED', async () => {
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
      executionEvidence: evidenceWithFailingAcceptance
    });

    assert.strictEqual(res.status, STATUS.FAILED, 'Acceptance flow failure on complex app must fail the quality gate');
    assert.strictEqual(res.layers.acceptanceFlows.passed, false);
  });

  await t.test('6. Complex application with build passing but unexecuted acceptance flow yields PARTIAL', async () => {
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
      executionEvidence: evidenceWithoutAcceptance
    });

    // Build alone on complex application does not prove interactions work
    assert.strictEqual(res.status, STATUS.PARTIAL);
    assert.notStrictEqual(res.status, STATUS.VERIFIED_PASS);
  });

  await t.test('7. Forbidden placeholder anti-pattern yields FAILED status', async () => {
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

  await t.test('8. Missing or unknown canonical case ID returns FAILED cleanly', async () => {
    const res = await gate.evaluate({
      files: validDashboardFiles,
      caseId: 'non-existent-case-id'
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.ok(res.errors[0].includes('Unknown canonical case ID'));
  });
});
