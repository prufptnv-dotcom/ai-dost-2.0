'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  classifyRequest,
  deriveAlgorithmSpecification,
  buildAlgorithmGuidanceBlock,
  evaluateAlgorithmVerification,
  registerAlgorithmFamily,
  ALGORITHM_FAMILIES
} = require('../agent/runtime/codeGenerationStrategy');

test('Phase 2: Code Generation Strategy & Algorithm Intelligence', async (t) => {

  await t.test('1. Fast Path for routine edits and simple UI tweaks', () => {
    const edit1 = 'fix typo in header text';
    const cls1 = classifyRequest(edit1);
    assert.strictEqual(cls1.isRoutine, true);
    assert.strictEqual(cls1.strategy, 'FAST_PATH');

    const spec1 = deriveAlgorithmSpecification(edit1, cls1);
    assert.strictEqual(spec1.specificationNeeded, false);
    assert.strictEqual(spec1.strategy, 'FAST_PATH');

    const guidance = buildAlgorithmGuidanceBlock(spec1);
    assert.strictEqual(guidance, '');
  });

  await t.test('2. Algorithmic problem classification across diverse families', () => {
    const testCases = [
      { req: 'Find if a string is a palindrome without slicing', expectedFamily: 'arrays_strings' },
      { req: 'Implement two sum problem using hash map', expectedFamily: 'hashing_maps' },
      { req: 'Binary search on a sorted rotated array', expectedFamily: 'sorting_binary_search' },
      { req: 'Implement a stack using two queues with push and pop', expectedFamily: 'stacks_queues' },
      { req: 'Detect cycle in linked list with fast and slow pointers', expectedFamily: 'linked_lists' },
      { req: 'Lowest common ancestor in binary search tree', expectedFamily: 'trees_bst' },
      { req: 'Find top k frequent elements using min-heap', expectedFamily: 'heaps_priority_queues' },
      { req: 'Dijkstra shortest path algorithm with priority queue', expectedFamily: 'graphs_traversal_shortest_paths' },
      { req: '0/1 knapsack dynamic programming problem', expectedFamily: 'dynamic_programming' },
      { req: 'Implement an LRU Cache with get and put', expectedFamily: 'caching_optimization' },
      { req: 'Redundant connection in graph using union find', expectedFamily: 'union_find_disjoint_set' },
      { req: 'Implement a trie for autocomplete prefix search', expectedFamily: 'tries_string_matching' }
    ];

    for (const tc of testCases) {
      const cls = classifyRequest(tc.req);
      assert.strictEqual(cls.isRoutine, false, `Failed on: ${tc.req}`);
      assert.strictEqual(cls.kind, 'ALGORITHMIC_PROBLEM', `Failed on: ${tc.req}`);
      assert.strictEqual(cls.family, tc.expectedFamily, `Failed on: ${tc.req}`);
    }
  });

  await t.test('3. Derives explicit structured algorithm specification with contracts & edge cases', () => {
    const req = 'Solve 0/1 knapsack dynamic programming';
    const spec = deriveAlgorithmSpecification(req);
    assert.strictEqual(spec.specificationNeeded, true);
    assert.strictEqual(spec.family, 'dynamic_programming');
    assert.ok(spec.contract.expectedComplexity.time);
    assert.ok(spec.contract.expectedComplexity.space);
    assert.ok(spec.contract.edgeCasesAndInvariants.length > 0);
    assert.ok(spec.contract.edgeCasesAndInvariants.includes('zero capacity / zero target'));

    const guidance = buildAlgorithmGuidanceBlock(spec);
    assert.ok(guidance.includes('ALGORITHM DESIGN & EXECUTION PROTOCOL'));
    assert.ok(guidance.includes('DYNAMIC PROGRAMMING'));
    assert.ok(guidance.includes('ZERO PLACEHOLDERS'));
  });

  await t.test('4. Extensible family registration without touching existing code', () => {
    const initialSize = ALGORITHM_FAMILIES.size;
    registerAlgorithmFamily({
      id: 'computational_geometry',
      name: 'Computational Geometry & Convex Hull',
      matcher: (text) => /\b(convex hull|graham scan|line intersection|polygon area)\b/i.test(text),
      complexity: { time: 'O(N log N)', space: 'O(N)' },
      invariants: ['Cross product orientation test determines turn direction'],
      edgeCases: ['collinear points', 'fewer than 3 points', 'all identical points']
    });

    assert.strictEqual(ALGORITHM_FAMILIES.size, initialSize + 1);

    const cls = classifyRequest('Find the convex hull using Graham scan');
    assert.strictEqual(cls.family, 'computational_geometry');
    const spec = deriveAlgorithmSpecification('Find the convex hull', cls);
    assert.strictEqual(spec.familyName, 'Computational Geometry & Convex Hull');
    assert.ok(spec.contract.edgeCasesAndInvariants.includes('collinear points'));
  });

  await t.test('5. Completion rule: Algorithm is unverified without passing execution evidence', () => {
    // Merely having a complexity statement without execution
    const noExec = evaluateAlgorithmVerification(null);
    assert.strictEqual(noExec.verified, false);
    assert.strictEqual(noExec.status, 'UNVERIFIED');

    // Failed execution
    const failedExec = evaluateAlgorithmVerification({ status: 'TEST_FAILURE', error: 'AssertionError: expected 34 got 0' });
    assert.strictEqual(failedExec.verified, false);
    assert.strictEqual(failedExec.status, 'TEST_FAILURE');

    // Successful execution evidence
    const successExec = evaluateAlgorithmVerification({ status: 'SUCCESS', verified: true, testsPassed: 5, durationMs: 42 });
    assert.strictEqual(successExec.verified, true);
    assert.strictEqual(successExec.status, 'VERIFIED');
  });
});
