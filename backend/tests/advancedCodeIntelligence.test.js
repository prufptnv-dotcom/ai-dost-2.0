'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  classifyRequest,
  deriveAlgorithmTaskContract,
  validateTaskPlanSchema,
  evaluateAlgorithmVerification,
  ALGORITHM_FAMILIES
} = require('../agent/runtime/codeGenerationStrategy');

const {
  validateCrossFileContracts,
  checkTaskFileCollisions
} = require('../agent/runtime/crossFileContractValidator');

const {
  AlgorithmVerifier
} = require('../quality-evaluation/algorithmVerifier');

const {
  GeneratedAppQualityGate,
  STATUS,
  computeArtifactHash,
  verifyExecutionReceipt,
  _clearConsumedReceiptsForTesting
} = require('../quality-evaluation/generatedAppQualityGate');
const {
  TEST_RUNNER_SECRET,
  createTestEvidence: createTrustedExecutionEvidence
} = require('./helpers/receiptTestHelper');

process.env.AIDOST_RUNNER_SECRET = TEST_RUNNER_SECRET;

const {
  WorkspaceFrameworkIntelligence
} = require('../services/workspaceFrameworkIntelligence');

test('Advanced Code Intelligence v1: Acceptance & Regression Suite', async (t) => {

  // ── 1. Complex requirements become validated tasks with traceable IDs ──
  await t.test('1. Complex requirements become validated tasks with traceable IDs', () => {
    const request = 'Implement Dijkstra shortest path algorithm with priority queue in JavaScript';
    const classification = classifyRequest(request);
    assert.strictEqual(classification.category, 'ALGORITHMIC_PROBLEM');

    const contract = deriveAlgorithmTaskContract(request, classification);
    assert.ok(contract, 'Algorithm contract must be derived');
    assert.strictEqual(contract.algorithmFamily, 'graphs');
    assert.ok(contract.requirements.length >= 2, 'Must have traceable requirement IDs');
    assert.ok(contract.requirements.some((r) => r.id === 'REQ-ALG-01'));
    assert.ok(contract.requirements.some((r) => r.id === 'REQ-ALG-02'));

    // Check task traceability
    assert.strictEqual(contract.tasks.length, 2);
    const task1 = contract.tasks[0];
    const task2 = contract.tasks[1];

    assert.strictEqual(task1.id, 'task-1');
    assert.deepStrictEqual(task1.requirements, ['REQ-ALG-01']);
    assert.strictEqual(task2.id, 'task-2');
    assert.deepStrictEqual(task2.requirements, ['REQ-ALG-02']);
    assert.deepStrictEqual(task2.dependsOn, ['task-1']);

    // Schema validation passes
    const validation = validateTaskPlanSchema(contract.tasks);
    assert.strictEqual(validation.valid, true);
    assert.deepStrictEqual(validation.sortedTaskIds, ['task-1', 'task-2']);
  });

  // ── 2. Algorithm selection respects constraints and documented preconditions ──
  await t.test('2. Algorithm selection respects constraints and documented preconditions', () => {
    const graphFamily = ALGORITHM_FAMILIES.get('graphs');
    assert.ok(graphFamily, 'Graph algorithm family must exist');

    // Constraint 1: Unweighted graph -> BFS
    const unweightedChoice = graphFamily.selectAlgorithm({ isUnweighted: true });
    assert.strictEqual(unweightedChoice.algorithm, 'Breadth-First Search (BFS)');
    assert.ok(unweightedChoice.rationale.includes('shortest path'));

    // Constraint 2: Negative edge weights -> Bellman-Ford
    const negativeWeightsChoice = graphFamily.selectAlgorithm({ hasNegativeWeights: true });
    assert.strictEqual(negativeWeightsChoice.algorithm, 'Bellman-Ford Algorithm');
    assert.ok(negativeWeightsChoice.rationale.includes('negative cycles'));

    // Constraint 3: DAG -> Topological Sort
    const dagChoice = graphFamily.selectAlgorithm({ isDAG: true });
    assert.ok(dagChoice.algorithm.includes('Topological Sort'));

    // Preconditions and invariants
    assert.ok(graphFamily.invariants.some((inv) => inv.includes('non-negative edge weights')));
    assert.ok(graphFamily.edgeCases.includes('unreachable target node (must return -1 or infinity)'));

    // Complexity analysis does not claim fixed constant bounds without checked assumptions
    const complexity = graphFamily.complexityAnalysis({ hasKnownBounds: false });
    assert.strictEqual(complexity.isEstimate, true);
    assert.ok(complexity.assumptions.length > 0);
  });

  // ── 3. Incorrect edge-case implementations fail independent tests ──
  await t.test('3. Incorrect edge-case implementations fail independent tests', async () => {
    const verifier = new AlgorithmVerifier();

    // Buggy binary search that fails on empty array or single-element miss
    const buggyBinarySearch = `
function binarySearch(nums, target) {
  // Buggy: crashes on empty array and fails on single element
  let left = 0;
  let right = nums.length;
  while (left < right) {
    let mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid;
  }
  return 0; // Buggy: returns 0 instead of -1 on miss!
}
`;
    const res = await verifier.verifyAlgorithm('binary_search', buggyBinarySearch);
    assert.strictEqual(res.verified, false);
    assert.ok(res.status === 'TEST_FAILURE' || res.status === 'RUNTIME_ERROR');
  });

  // ── 4. Cross-file API/schema mismatches are detected ──
  await t.test('4. Cross-file API/schema mismatches are detected', () => {
    // Scenario A: Missing named export in imported file
    const filesWithMissingExport = {
      'src/App.jsx': `
import React from 'react';
import { fetchUserProfile, deleteUser } from './api/userApi';

export default function App() { return <div>User</div>; }
`,
      'src/api/userApi.js': `
export function fetchUserProfile(id) { return { id, name: 'Alice' }; }
// deleteUser is NOT exported!
`
    };

    const resA = validateCrossFileContracts(filesWithMissingExport);
    assert.strictEqual(resA.valid, false);
    assert.ok(resA.errors.some((e) => e.includes("imports 'deleteUser'") && e.includes('not exported')));

    // Scenario B: Frontend calls POST /api/items, but backend only defines GET /api/items
    const filesWithRouteMismatch = {
      'src/App.jsx': `
import React from 'react';

export default function App() {
  const save = () => {
    fetch('/api/items', { method: 'POST', body: JSON.stringify({ name: 'test' }) });
  };
  return <button onClick={save}>Save</button>;
}
`,
      'backend/server.js': `
const express = require('express');
const app = express();

app.get('/api/items', (req, res) => res.json([]));
// Missing app.post('/api/items')!
`
    };

    const resB = validateCrossFileContracts(filesWithRouteMismatch);
    assert.strictEqual(resB.valid, false);
    assert.ok(resB.errors.some((e) => e.includes('API_METHOD_MISMATCH') || e.includes('MISSING_API_ROUTE')));
  });

  // ── 5. Existing framework conventions survive modifications ──
  await t.test('5. Existing framework conventions survive modifications', () => {
    // Attempting to introduce Vue into an established React project without authorization
    const reactProjectFiles = {
      'src/App.jsx': `import React from 'react'; export default function App() {}`,
      'src/components/VueHeader.vue': `<template><header>Header</header></template>`,
      'package.json': JSON.stringify({
        dependencies: { react: '^18.0.0', vue: '^3.0.0' }
      })
    };

    const res = validateCrossFileContracts(reactProjectFiles, { existingFramework: 'react', allowFrameworkMigration: false });
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('FRAMEWORK_VIOLATION')));

    // Uncoordinated concurrent file writes are prevented
    const tasksWithCollision = [
      { id: 'task-1', files: ['src/App.jsx'], dependsOn: [] },
      { id: 'task-2', files: ['src/App.jsx'], dependsOn: [] } // Collides with task-1 without ordering
    ];
    const collisionCheck = checkTaskFileCollisions(tasksWithCollision);
    assert.strictEqual(collisionCheck.valid, false);
    assert.ok(collisionCheck.errors[0].includes('UNCOORDINATED_FILE_WRITE'));
  });

  // ── 6. Concrete build/runtime error triggers relevant repair, not unrelated rewrite ──
  await t.test('6. Concrete build/runtime error triggers relevant repair, not unrelated rewrite', () => {
    const errorDetails = 'TypeError: Cannot read property "map" of undefined in src/components/ItemList.jsx:14';
    const repairObjective = `REPAIR ATTEMPT 1: The previous implementation failed with error: ${errorDetails}. Please analyze the failure, read the relevant logs, and provide a corrected fix.`;

    // Preserves surgical fix focus
    assert.ok(repairObjective.includes('REPAIR ATTEMPT'));
    assert.ok(repairObjective.includes('src/components/ItemList.jsx'));
    assert.ok(!repairObjective.includes('REBUILD_PROJECT_FROM_SCRATCH'));
  });

  // ── 7. Static-only diagnostics cannot produce runtime-verified success ──
  await t.test('7. Static-only diagnostics cannot produce runtime-verified success', async () => {
    const gate = new GeneratedAppQualityGate();

    const sampleFiles = {
      'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [filter, setFilter] = useState('');
  return (
    <div>
      <input type="text" placeholder="Search..." onChange={e => setFilter(e.target.value)} />
      <button onClick={() => { const b = new Blob(['1,2'], {type: 'text/csv'}); }}>Export CSV</button>
      <svg><circle cx="10" cy="10" r="5" /></svg>
      <table><tbody><tr><td>Item</td></tr></tbody></table>
    </div>
  );
}
`
    };

    const evalResult = await gate.evaluate({
      files: sampleFiles,
      caseId: 'dashboard-search-charts-csv',
      executionEvidence: null // No execution evidence
    });

    // CRITICAL ACCEPTANCE GATE: Static tokens alone must NEVER yield VERIFIED_PASS
    assert.notStrictEqual(evalResult.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(evalResult.status, STATUS.STATIC_DIAGNOSTIC_PASS);
  });

  // ── 8. Genuine passing evidence still permits successful completion ──
  await t.test('8. Genuine passing evidence still permits successful completion', async () => {
    const gate = new GeneratedAppQualityGate();

    const validFiles = {
      'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [q, setQ] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  return (
    <div>
      <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={() => { const b = new Blob(['1,2'], {type: 'text/csv'}); }}>Export CSV</button>
      <svg><rect width="10" height="10" /></svg>
      {isLoading ? <p>Loading...</p> : null}
      {error ? <p>Error</p> : null}
      <table><tbody><tr><td>Row</td></tr></tbody></table>
    </div>
  );
}
`
    };

    _clearConsumedReceiptsForTesting();
    const evalResult = await gate.evaluate({
      files: validFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'trusted-test-8',
      executionEvidence: createTrustedExecutionEvidence({
        files: validFiles,
        runId: 'trusted-test-8',
        build: { success: true, exitCode: 0 },
        tests: { testsRun: 4, testsPassed: 4 },
        runtime: { started: true },
        acceptance: { passed: true, flowsTested: 2 }
      })
    });

    assert.strictEqual(evalResult.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(evalResult.layers.unitTests.passed, true);
    assert.strictEqual(evalResult.layers.buildExecution.passed, true);
  });

  // ── 9. Failed, empty or unavailable verification is reported honestly ──
  await t.test('9. Failed, empty or unavailable verification is reported honestly', () => {
    // Case A: Missing execution evidence
    const unverified = evaluateAlgorithmVerification(null);
    assert.strictEqual(unverified.verified, false);
    assert.strictEqual(unverified.status, 'UNVERIFIED');
    assert.strictEqual(unverified.reason, 'No execution evidence provided');

    // Case B: Partial / failing execution
    const failing = evaluateAlgorithmVerification({ testsRun: 5, testsPassed: 3, status: 'FAILED' });
    assert.strictEqual(failing.verified, false);
    assert.strictEqual(failing.status, 'FAILED');
    assert.ok(failing.reason.includes('3/5 passed'));

    // Case C: Empty test set reporting success
    const emptyTests = evaluateAlgorithmVerification({ testsRun: 0, testsPassed: 0, status: 'SUCCESS' });
    assert.strictEqual(emptyTests.verified, false);
    assert.strictEqual(emptyTests.status, 'SUCCESS');
    assert.ok(emptyTests.reason.includes('0/0 passed'));
  });

  // ── 10. Simple requests avoid unnecessary planning overhead ──
  await t.test('10. Simple requests avoid unnecessary planning overhead', () => {
    const simple1 = classifyRequest('Fix the typo in the Login button text');
    assert.strictEqual(simple1.category, 'ROUTINE_EDIT');
    assert.strictEqual(simple1.isRoutine, true);
    assert.strictEqual(simple1.multiTask, false);

    const simple2 = classifyRequest('Update copyright year in footer to 2026');
    assert.strictEqual(simple2.category, 'ROUTINE_EDIT');
    assert.strictEqual(simple2.isRoutine, true);
    assert.strictEqual(simple2.multiTask, false);

    // Algorithmic request requires deep contract
    const complexAlg = classifyRequest('Implement an LRU Cache with O(1) get and put');
    assert.strictEqual(complexAlg.category, 'ALGORITHMIC_PROBLEM');
    assert.strictEqual(complexAlg.multiTask, true);
  });

  // ── 11. Section 6 Proof: Eleven Specific Advanced Code Intelligence Regressions ──
  await t.test('11. Section 6: Missing local import is detected as error', () => {
    const files = {
      'src/App.jsx': `
import React from 'react';
import Navbar from './components/Navbar';

export default function App() { return <Navbar />; }
`
    };
    const res = validateCrossFileContracts(files);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('MISSING_LOCAL_FILE') && e.includes('./components/Navbar')));
  });

  await t.test('12. Section 6: Missing named export is detected as error', () => {
    const files = {
      'src/App.jsx': `
import React from 'react';
import { Button, IconButton } from './components/Button';

export default function App() { return <Button />; }
`,
      'src/components/Button.jsx': `
export function Button() { return <button>Click</button>; }
// IconButton is missing!
`
    };
    const res = validateCrossFileContracts(files);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('MISSING_NAMED_EXPORT') && e.includes('IconButton')));
  });

  await t.test('13. Section 6: Frontend/backend HTTP-method mismatch is detected as error', () => {
    const files = {
      'src/api/users.js': `
export async function deleteUser(id) {
  return fetch('/api/users/' + id, { method: 'DELETE' });
}
`,
      'server.js': `
const express = require('express');
const app = express();

app.get('/api/users/:id', (req, res) => res.json({ id: req.params.id }));
app.post('/api/users', (req, res) => res.json({ success: true }));
// DELETE /api/users/:id is NOT implemented!
`
    };
    const res = validateCrossFileContracts(files);
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('API_METHOD_MISMATCH')));
  });

  await t.test('14. Section 6: Conflicting concurrent file assignment is rejected as fatal error', () => {
    const concurrentTasks = [
      { id: 'task-1', title: 'Update styling', files: ['src/App.jsx'], dependsOn: [] },
      { id: 'task-2', title: 'Add auth header', files: ['src/App.jsx'], dependsOn: [] }
    ];

    const schemaRes = validateTaskPlanSchema(concurrentTasks);
    assert.strictEqual(schemaRes.valid, false, 'Uncoordinated concurrent file writes must not pass validation');
    assert.ok(schemaRes.errors.some((e) => e.includes('Uncoordinated concurrent file write conflict')));

    const collisionRes = checkTaskFileCollisions(concurrentTasks);
    assert.strictEqual(collisionRes.valid, false);
    assert.ok(collisionRes.errors.some((e) => e.includes('UNCOORDINATED_FILE_WRITE')));
  });

  await t.test('15. Section 6: Candidate attempts to mutate the test harness are rejected', async () => {
    const verifier = new AlgorithmVerifier();
    const maliciousCode = `
global.assert = {
  ok: () => true,
  strictEqual: () => true,
  deepStrictEqual: () => true
};
console.log('ALL_TESTS_PASSED');

function twoSum(nums, target) {
  return [999, 999]; // Wrong answers
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', maliciousCode);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TEST_FAILURE');
  });

  await t.test('16. Section 6: Incorrect algorithm output despite a success-looking message is rejected', async () => {
    const verifier = new AlgorithmVerifier();
    const deceptiveCode = `
console.log('ALL_TESTS_PASSED');
console.log('SUCCESS: All 10/10 test cases verified');

function twoSum(nums, target) {
  // Returns zero-length array
  return [];
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', deceptiveCode);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TEST_FAILURE');
  });

  await t.test('17. Section 6: Fabricated execution evidence is rejected with FAILED status', async () => {
    const gate = new GeneratedAppQualityGate();
    const dummyFiles = {
      'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [q, setQ] = useState('');
  return (
    <div>
      <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={() => {}}>Export CSV</button>
      <svg><circle cx="5" cy="5" r="4" /></svg>
      <table><tbody><tr><td>Row</td></tr></tbody></table>
    </div>
  );
}
`
    };

    const callerFabricatedEvidence = {
      build: { success: true },
      tests: { testsRun: 50, testsPassed: 50 },
      acceptance: { passed: true }
    };

    const res = await gate.evaluate({
      files: dummyFiles,
      caseId: 'dashboard-search-charts-csv',
      executionEvidence: callerFabricatedEvidence
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'FABRICATED_OR_UNTRUSTED_EVIDENCE'));
  });

  await t.test('18. Section 6: Evidence with the wrong artifact hash is rejected', async () => {
    const gate = new GeneratedAppQualityGate();
    const originalFiles = {
      'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [q, setQ] = useState('');
  return (
    <div>
      <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={() => {}}>Export CSV</button>
      <svg><circle cx="5" cy="5" r="4" /></svg>
      <table><tbody><tr><td>Row</td></tr></tbody></table>
    </div>
  );
}
`
    };

    const modifiedFiles = {
      ...originalFiles,
      'src/App.jsx': originalFiles['src/App.jsx'] + '\n// Tampered content'
    };

    _clearConsumedReceiptsForTesting();
    // Evidence minted for originalFiles
    const evidenceForOriginal = createTrustedExecutionEvidence({
      files: originalFiles,
      runId: 'run-hash-1',
      build: { success: true, exitCode: 0 },
      tests: { testsRun: 3, testsPassed: 3 },
      acceptance: { passed: true, flowsTested: 2 }
    });

    // Evaluated against modifiedFiles
    const res = await gate.evaluate({
      files: modifiedFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-hash-1',
      executionEvidence: evidenceForOriginal
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.executionReceipt.verified, false);
    assert.ok(res.defects.some((d) => d.type === 'ARTIFACT_HASH_MISMATCH'));
  });

  await t.test('19. Section 6: Build passing while an acceptance-critical flow fails is rejected', async () => {
    _clearConsumedReceiptsForTesting();
    const gate = new GeneratedAppQualityGate();
    const appFiles = {
      'src/App.jsx': `
import React, { useState } from 'react';
export default function App() {
  const [q, setQ] = useState('');
  return (
    <div>
      <input type="text" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={() => {}}>Export CSV</button>
      <svg><circle cx="5" cy="5" r="4" /></svg>
      <table><tbody><tr><td>Row</td></tr></tbody></table>
    </div>
  );
}
`
    };

    const evidenceWithFailedAcceptance = createTrustedExecutionEvidence({
      files: appFiles,
      runId: 'run-acc-fail-1',
      build: { success: true, exitCode: 0, output: 'Build successful' },
      tests: { testsRun: 5, testsPassed: 5, testsFailed: 0 },
      acceptance: { passed: false, flowsTested: 4, flowsFailed: 1 } // Flow failure!
    });

    const res = await gate.evaluate({
      files: appFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-acc-fail-1',
      executionEvidence: evidenceWithFailedAcceptance
    });

    assert.strictEqual(res.status, STATUS.FAILED);
    assert.strictEqual(res.layers.acceptanceFlows.passed, false);
  });

  await t.test('20. Section 6: Genuine trusted evidence still passes cleanly', async () => {
    _clearConsumedReceiptsForTesting();
    const gate = new GeneratedAppQualityGate();
    const appFiles = {
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

    const trustedEvidence = createTrustedExecutionEvidence({
      files: appFiles,
      runId: 'run-genuine-1',
      build: { success: true, exitCode: 0, output: 'Vite build complete in 210ms' },
      tests: { testsRun: 5, testsPassed: 5, testsFailed: 0 },
      runtime: { started: true, port: 3000 },
      acceptance: { passed: true, flowsTested: 3, flowsFailed: 0 }
    });

    const res = await gate.evaluate({
      files: appFiles,
      caseId: 'dashboard-search-charts-csv',
      runId: 'run-genuine-1',
      executionEvidence: trustedEvidence
    });

    assert.strictEqual(res.status, STATUS.VERIFIED_PASS);
    assert.strictEqual(res.layers.executionReceipt.verified, true);
    assert.strictEqual(res.layers.buildExecution.passed, true);
    assert.strictEqual(res.layers.acceptanceFlows.passed, true);
  });

  await t.test('21. Section 6: Targeted repair resolving a concrete contract failure', () => {
    // Initial broken state: missing named export
    const brokenFiles = {
      'src/App.jsx': `
import React from 'react';
import { exportToCSV } from './utils/export';

export default function App() {
  return <button onClick={exportToCSV}>Export</button>;
}
`,
      'src/utils/export.js': `
export function exportToJSON(data) { return JSON.stringify(data); }
// exportToCSV is missing!
`
    };

    const initialValidation = validateCrossFileContracts(brokenFiles);
    assert.strictEqual(initialValidation.valid, false);
    assert.ok(initialValidation.errors.some((e) => e.includes('MISSING_NAMED_EXPORT') && e.includes('exportToCSV')));

    // Bounded targeted repair applied ONLY to affected file 'src/utils/export.js'
    const repairedFiles = {
      ...brokenFiles,
      'src/utils/export.js': `
export function exportToJSON(data) { return JSON.stringify(data); }
export function exportToCSV(data) { return 'csv,content'; }
`
    };

    // Re-run validation on the actual files
    const recheckValidation = validateCrossFileContracts(repairedFiles);
    assert.strictEqual(recheckValidation.valid, true);
    assert.strictEqual(recheckValidation.errors.length, 0);
  });
});
