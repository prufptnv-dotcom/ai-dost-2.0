'use strict';

/**
 * AI-Dost Algorithm Verifier & Oracle Testing Engine
 * Validates algorithmic correctness across all 12 algorithm families using
 * independent, out-of-process reference oracles, boundary cases, and adversarial checks.
 *
 * Security & Integrity Contract:
 * - Candidate code executes in an isolated, resource-bounded subprocess.
 * - Expected outputs and assertion logic are kept EXCLUSIVELY in the parent process.
 * - The candidate code cannot monkey-patch assertion methods, stdout markers, or oracles.
 * - Single solutions verify specific algorithms and do not award family-wide correctness guarantees.
 */

const assert = require('assert');
const { executeCandidateRunner } = require('./executionSandbox');

class AlgorithmVerifier {
  constructor() {
    this.oracles = new Map();
    this._registerAllFamilyOracles();
  }

  _registerAllFamilyOracles() {
    // 1. Arrays & Strings (Two Sum / Sliding Window)
    this.oracles.set('two_sum', {
      family: 'arrays_strings',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['twoSum', 'two_sum'],
        cases: [
          { id: 'std', args: [[2, 7, 11, 15], 9] },
          { id: 'neg', args: [[-3, 4, 3, 90], 0] },
          { id: 'dup', args: [[3, 3], 6] },
          { id: 'none', args: [[1, 2, 3], 100] },
          { id: 'empty', args: [[], 5] },
          { id: 'single', args: [[5], 5] }
        ]
      },
      verify(resultsMap) {
        const std = resultsMap.get('std');
        assert.ok(Array.isArray(std) && std.length === 2, 'Result must be a 2-element array');
        assert.deepStrictEqual(std.slice().sort((a, b) => a - b), [0, 1]);

        const neg = resultsMap.get('neg');
        assert.ok(Array.isArray(neg) && neg.length === 2);
        assert.deepStrictEqual(neg.slice().sort((a, b) => a - b), [0, 2]);

        const dup = resultsMap.get('dup');
        assert.ok(Array.isArray(dup) && dup.length === 2);
        assert.deepStrictEqual(dup.slice().sort((a, b) => a - b), [0, 1]);

        assert.strictEqual(resultsMap.get('none'), null, 'Must return null when no pair sums to target');
        assert.strictEqual(resultsMap.get('empty'), null, 'Empty array has no pair');
        assert.strictEqual(resultsMap.get('single'), null, 'Single element has no pair');
      }
    });

    // 2. Hashing (Hash Map / Frequency Counter)
    this.oracles.set('hash_map', {
      family: 'hashing',
      lang: 'javascript',
      spec: {
        mode: 'class',
        names: ['MyHashMap', 'HashMap'],
        operations: [
          { id: 'init', op: 'new', args: [] },
          { id: 'p1', op: 'put', args: [1, 1] },
          { id: 'p2', op: 'put', args: [2, 2] },
          { id: 'g1', op: 'get', args: [1] },
          { id: 'g3', op: 'get', args: [3] },
          { id: 'p2_up', op: 'put', args: [2, 1] },
          { id: 'g2_up', op: 'get', args: [2] },
          { id: 'r2', op: 'remove', args: [2] },
          { id: 'g2_rem', op: 'get', args: [2] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('g1'), 1);
        assert.strictEqual(resultsMap.get('g3'), -1, 'Missing key should return -1');
        assert.strictEqual(resultsMap.get('g2_up'), 1, 'Updated key should reflect new value');
        assert.strictEqual(resultsMap.get('g2_rem'), -1, 'Removed key should return -1');
      }
    });

    // 3. Sorting & Searching (Binary Search)
    this.oracles.set('binary_search', {
      family: 'sorting_searching',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['binarySearch', 'search'],
        cases: [
          { id: 'mid', args: [[1, 3, 5, 7, 9], 5] },
          { id: 'first', args: [[1, 3, 5, 7, 9], 1] },
          { id: 'last', args: [[1, 3, 5, 7, 9], 9] },
          { id: 'miss', args: [[1, 3, 5, 7, 9], 4] },
          { id: 'empty', args: [[], 5] },
          { id: 'single_hit', args: [[5], 5] },
          { id: 'single_miss', args: [[5], 2] },
          { id: 'neg', args: [[-10, -5, 0, 3, 8, 12], -5] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('mid'), 2);
        assert.strictEqual(resultsMap.get('first'), 0);
        assert.strictEqual(resultsMap.get('last'), 4);
        assert.strictEqual(resultsMap.get('miss'), -1);
        assert.strictEqual(resultsMap.get('empty'), -1, 'Empty array returns -1');
        assert.strictEqual(resultsMap.get('single_hit'), 0, 'Single element hit');
        assert.strictEqual(resultsMap.get('single_miss'), -1, 'Single element miss');
        assert.strictEqual(resultsMap.get('neg'), 1, 'Negative number index');
      }
    });

    // 4. Stacks & Queues (Valid Parentheses)
    this.oracles.set('valid_parentheses', {
      family: 'stacks_queues',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['isValidParentheses', 'isValid'],
        cases: [
          { id: 'simple', args: ['()'] },
          { id: 'multi', args: ['()[]{}'] },
          { id: 'mismatch', args: ['(]'] },
          { id: 'cross', args: ['([)]'] },
          { id: 'nested', args: ['{[]}'] },
          { id: 'empty', args: [''] },
          { id: 'unclosed', args: ['('] },
          { id: 'unopened', args: [']'] },
          { id: 'all_open', args: ['(((((((('] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('simple'), true);
        assert.strictEqual(resultsMap.get('multi'), true);
        assert.strictEqual(resultsMap.get('mismatch'), false);
        assert.strictEqual(resultsMap.get('cross'), false);
        assert.strictEqual(resultsMap.get('nested'), true);
        assert.strictEqual(resultsMap.get('empty'), true, 'Empty string is valid');
        assert.strictEqual(resultsMap.get('unclosed'), false, 'Unclosed opening bracket');
        assert.strictEqual(resultsMap.get('unopened'), false, 'Unmatched closing bracket');
        assert.strictEqual(resultsMap.get('all_open'), false, 'All opens');
      }
    });

    // 5. Linked Lists (Detect Cycle)
    this.oracles.set('linked_list_cycle', {
      family: 'linked_lists',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['hasCycle'],
        cases: [
          { id: 'no_cycle', customType: 'linked_list', listValues: [1, 2, 3], cycleIndex: -1 },
          { id: 'cycle', customType: 'linked_list', listValues: [1, 2, 3], cycleIndex: 1 },
          { id: 'self_loop', customType: 'linked_list', listValues: [10], cycleIndex: 0 },
          { id: 'empty', customType: 'linked_list', listValues: [], cycleIndex: -1 }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('no_cycle'), false);
        assert.strictEqual(resultsMap.get('cycle'), true);
        assert.strictEqual(resultsMap.get('self_loop'), true);
        assert.strictEqual(resultsMap.get('empty'), false);
      }
    });

    // 6. Trees (Validate BST)
    this.oracles.set('bst_validation', {
      family: 'trees',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['isValidBST'],
        cases: [
          { id: 'valid', customType: 'tree', treeDef: { val: 2, left: { val: 1 }, right: { val: 3 } } },
          { id: 'invalid', customType: 'tree', treeDef: { val: 5, left: { val: 1 }, right: { val: 4, left: { val: 3 }, right: { val: 6 } } } },
          { id: 'empty', customType: 'tree', treeDef: null },
          { id: 'single', customType: 'tree', treeDef: { val: 42 } },
          { id: 'dup', customType: 'tree', treeDef: { val: 2, left: { val: 2 } } }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('valid'), true);
        assert.strictEqual(resultsMap.get('invalid'), false);
        assert.strictEqual(resultsMap.get('empty'), true, 'Empty tree is valid BST');
        assert.strictEqual(resultsMap.get('single'), true, 'Single node is valid BST');
        assert.strictEqual(resultsMap.get('dup'), false, 'Duplicates violate strict BST');
      }
    });

    // 7. Heaps (Min Heap)
    this.oracles.set('min_heap', {
      family: 'heaps',
      lang: 'javascript',
      spec: {
        mode: 'class',
        names: ['MinHeap'],
        operations: [
          { id: 'init', op: 'new', args: [] },
          { id: 'i5', op: 'insert', args: [5] },
          { id: 'i3', op: 'insert', args: [3] },
          { id: 'i8', op: 'insert', args: [8] },
          { id: 'i1', op: 'insert', args: [1] },
          { id: 'peek', op: 'peek', args: [] },
          { id: 'e1', op: 'extractMin', args: [] },
          { id: 'e2', op: 'extractMin', args: [] },
          { id: 'e3', op: 'extractMin', args: [] },
          { id: 'e4', op: 'extractMin', args: [] },
          { id: 'e5', op: 'extractMin', args: [] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('peek'), 1, 'Peek must be minimum element');
        assert.strictEqual(resultsMap.get('e1'), 1);
        assert.strictEqual(resultsMap.get('e2'), 3);
        assert.strictEqual(resultsMap.get('e3'), 5);
        assert.strictEqual(resultsMap.get('e4'), 8);
        assert.strictEqual(resultsMap.get('e5'), null, 'Extracting from empty heap returns null');
      }
    });

    // 8. Graphs (BFS Shortest Path)
    this.oracles.set('graph_bfs', {
      family: 'graphs',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['shortestPathBFS', 'shortestPath'],
        cases: [
          {
            id: 'path_af',
            args: [
              {
                A: ['B', 'C'],
                B: ['A', 'D', 'E'],
                C: ['A', 'F'],
                D: ['B'],
                E: ['B', 'F'],
                F: ['C', 'E']
              },
              'A',
              'F'
            ]
          },
          {
            id: 'self',
            args: [{ A: ['B', 'C'], B: ['A'] }, 'A', 'A']
          },
          {
            id: 'unreachable',
            args: [{ A: ['B'] }, 'A', 'NON_EXISTENT']
          }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('path_af'), 2, 'Path A -> C -> F length is 2');
        assert.strictEqual(resultsMap.get('self'), 0, 'Distance to self is 0');
        assert.strictEqual(resultsMap.get('unreachable'), -1, 'Unreachable node distance is -1');
      }
    });

    // 9. Dynamic Programming (Climbing Stairs)
    this.oracles.set('climbing_stairs', {
      family: 'dynamic_programming',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['climbStairs'],
        cases: [
          { id: 'c1', args: [1] },
          { id: 'c2', args: [2] },
          { id: 'c3', args: [3] },
          { id: 'c4', args: [4] },
          { id: 'c5', args: [5] },
          { id: 'c10', args: [10] },
          { id: 'c0', args: [0] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('c1'), 1);
        assert.strictEqual(resultsMap.get('c2'), 2);
        assert.strictEqual(resultsMap.get('c3'), 3);
        assert.strictEqual(resultsMap.get('c4'), 5);
        assert.strictEqual(resultsMap.get('c5'), 8);
        assert.strictEqual(resultsMap.get('c10'), 89);
        assert.strictEqual(resultsMap.get('c0'), 1, '0 stairs has 1 way');
      }
    });

    // 10. Caching (LRU Cache)
    this.oracles.set('lru_cache', {
      family: 'caching',
      lang: 'javascript',
      spec: {
        mode: 'class',
        names: ['LRUCache', 'LruCache'],
        operations: [
          { id: 'init', op: 'new', args: [2] },
          { id: 'p1', op: 'put', args: [1, 1] },
          { id: 'p2', op: 'put', args: [2, 2] },
          { id: 'g1', op: 'get', args: [1] },
          { id: 'p3', op: 'put', args: [3, 3] }, // evicts 2
          { id: 'g2', op: 'get', args: [2] },
          { id: 'p4', op: 'put', args: [4, 4] }, // evicts 1
          { id: 'g1_evicted', op: 'get', args: [1] },
          { id: 'g3', op: 'get', args: [3] },
          { id: 'g4', op: 'get', args: [4] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('g1'), 1);
        assert.strictEqual(resultsMap.get('g2'), -1, 'Key 2 should have been evicted');
        assert.strictEqual(resultsMap.get('g1_evicted'), -1, 'Key 1 should have been evicted');
        assert.strictEqual(resultsMap.get('g3'), 3);
        assert.strictEqual(resultsMap.get('g4'), 4);
      }
    });

    // 11. Union-Find (Disjoint Set)
    this.oracles.set('union_find', {
      family: 'union_find',
      lang: 'javascript',
      spec: {
        mode: 'class',
        names: ['UnionFind', 'DisjointSet'],
        operations: [
          { id: 'init', op: 'new', args: [5] },
          { id: 'c01_before', op: 'connected', args: [0, 1] },
          { id: 'u01', op: 'union', args: [0, 1] },
          { id: 'c01_after', op: 'connected', args: [0, 1] },
          { id: 'u12', op: 'union', args: [1, 2] },
          { id: 'c02', op: 'connected', args: [0, 2] },
          { id: 'c03', op: 'connected', args: [0, 3] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('c01_before'), false);
        assert.strictEqual(resultsMap.get('c01_after'), true);
        assert.strictEqual(resultsMap.get('c02'), true, 'Transitive connectivity');
        assert.strictEqual(resultsMap.get('c03'), false);
      }
    });

    // 12. String Matching (KMP / Substring Search)
    this.oracles.set('string_matching', {
      family: 'string_matching',
      lang: 'javascript',
      spec: {
        mode: 'function',
        names: ['strStr', 'kmpSearch'],
        cases: [
          { id: 'sub', args: ['hello', 'll'] },
          { id: 'none', args: ['aaaaa', 'bba'] },
          { id: 'single', args: ['a', 'a'] },
          { id: 'multi', args: ['mississippi', 'issip'] },
          { id: 'empty_both', args: ['', ''] },
          { id: 'empty_pat', args: ['abc', ''] },
          { id: 'empty_text', args: ['', 'a'] }
        ]
      },
      verify(resultsMap) {
        assert.strictEqual(resultsMap.get('sub'), 2);
        assert.strictEqual(resultsMap.get('none'), -1);
        assert.strictEqual(resultsMap.get('single'), 0);
        assert.strictEqual(resultsMap.get('multi'), 4);
        assert.strictEqual(resultsMap.get('empty_both'), 0, 'Empty pattern in empty text is at 0');
        assert.strictEqual(resultsMap.get('empty_pat'), 0, 'Empty pattern is at 0');
        assert.strictEqual(resultsMap.get('empty_text'), -1, 'Non-empty pattern in empty text is -1');
      }
    });
  }

  /**
   * Verifies an algorithm candidate implementation against independent tests and oracles.
   * Execution is fully out-of-process; assertions and expected results run strictly in parent process.
   */
  async verifyAlgorithm(name, candidateCode, options = {}) {
    const oracle = this.oracles.get(name);
    if (!oracle) {
      throw new Error(`Unknown algorithm test suite: '${name}'`);
    }

    const timeoutMs = options.timeoutMs || 4000;
    const runResult = await executeCandidateRunner({
      code: candidateCode,
      spec: oracle.spec,
      timeoutMs,
      requireOsIsolation: Boolean(options.requireOsIsolation || options.strictIsolation || process.env.AIDOST_STRICT_ISOLATION === 'true'),
      adapter: options.adapter || null
    });

    if (runResult.status === 'SANDBOX_UNAVAILABLE') {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'SANDBOX_UNAVAILABLE',
        durationMs: 0,
        error: runResult.error || 'Required OS-level container isolation is unavailable on this host.',
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    if (runResult.status === 'TIMEOUT') {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'TIMEOUT',
        durationMs: runResult.durationMs,
        error: runResult.error || `Execution timed out after ${timeoutMs}ms`,
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    if (runResult.status === 'OUTPUT_LIMIT_EXCEEDED') {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'OUTPUT_LIMIT_EXCEEDED',
        durationMs: runResult.durationMs,
        error: runResult.error || 'Candidate output exceeded maximum allowable buffer limit',
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    const runnerOutput = runResult.runnerOutput;
    if (!runnerOutput || runnerOutput.runnerStatus !== 'EXECUTED') {
      const errDetail = runnerOutput?.error || runResult.error || runResult.stderr || 'Candidate runner failed to produce execution protocol output';
      let status = 'MALFORMED_OUTPUT';
      if (runnerOutput?.runnerStatus === 'SYNTAX_ERROR' || (typeof errDetail === 'string' && errDetail.includes('SyntaxError'))) {
        status = 'SYNTAX_ERROR';
      } else if (runnerOutput?.runnerStatus === 'TARGET_NOT_FOUND') {
        status = 'TARGET_NOT_FOUND';
      } else if (runnerOutput?.runnerStatus === 'RUNNER_EXCEPTION') {
        status = 'RUNTIME_ERROR';
      }

      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status,
        durationMs: runResult.durationMs,
        error: errDetail,
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    // Independently validate complete expected test-case set and result schema
    const expectedIds = (oracle.spec.mode === 'class' ? oracle.spec.operations : oracle.spec.cases).map((c) => c.id);
    const expectedSet = new Set(expectedIds);

    if (!Array.isArray(runnerOutput.results)) {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'MALFORMED_OUTPUT',
        durationMs: runResult.durationMs,
        error: 'Runner output results must be an array of test case outcomes',
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    if (runnerOutput.results.length !== expectedIds.length) {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'MALFORMED_OUTPUT',
        durationMs: runResult.durationMs,
        error: `Test case count mismatch: expected ${expectedIds.length} cases, got ${runnerOutput.results.length}`,
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    const seenIds = new Set();
    const resultsMap = new Map();

    for (const item of runnerOutput.results) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
        return {
          name,
          family: oracle.family,
          lang: oracle.lang,
          verified: false,
          status: 'MALFORMED_OUTPUT',
          durationMs: runResult.durationMs,
          error: 'Invalid test case outcome schema: missing id or status',
          isolation: runResult.isolation,
          scope: 'specific_problem',
          familyWideClaim: false
        };
      }

      if (!expectedSet.has(item.id)) {
        return {
          name,
          family: oracle.family,
          lang: oracle.lang,
          verified: false,
          status: 'MALFORMED_OUTPUT',
          durationMs: runResult.durationMs,
          error: `Unexpected test case ID returned by runner: ${item.id}`,
          isolation: runResult.isolation,
          scope: 'specific_problem',
          familyWideClaim: false
        };
      }

      if (seenIds.has(item.id)) {
        return {
          name,
          family: oracle.family,
          lang: oracle.lang,
          verified: false,
          status: 'MALFORMED_OUTPUT',
          durationMs: runResult.durationMs,
          error: `Duplicate test case ID returned by runner: ${item.id}`,
          isolation: runResult.isolation,
          scope: 'specific_problem',
          familyWideClaim: false
        };
      }

      seenIds.add(item.id);

      if (item.status === 'ERROR') {
        return {
          name,
          family: oracle.family,
          lang: oracle.lang,
          verified: false,
          status: 'RUNTIME_ERROR',
          durationMs: runResult.durationMs,
          error: `Test case [${item.id}] raised an uncaught error: ${item.error}`,
          isolation: runResult.isolation,
          scope: 'specific_problem',
          familyWideClaim: false
        };
      }

      resultsMap.set(item.id, item.result);
    }

    if (seenIds.size !== expectedSet.size) {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'MALFORMED_OUTPUT',
        durationMs: runResult.durationMs,
        error: 'Omitted required test cases from verification set',
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    // Independent parent-process oracle assertion
    try {
      oracle.verify(resultsMap);
    } catch (assertionErr) {
      return {
        name,
        family: oracle.family,
        lang: oracle.lang,
        verified: false,
        status: 'TEST_FAILURE',
        assertionFailure: true,
        durationMs: runResult.durationMs,
        error: assertionErr.message,
        isolation: runResult.isolation,
        scope: 'specific_problem',
        familyWideClaim: false
      };
    }

    return {
      name,
      family: oracle.family,
      lang: oracle.lang,
      verified: true,
      status: 'VERIFIED',
      durationMs: runResult.durationMs,
      error: null,
      isolation: runResult.isolation,
      scope: 'specific_problem',
      familyWideClaim: false
    };
  }
}

module.exports = {
  AlgorithmVerifier
};
