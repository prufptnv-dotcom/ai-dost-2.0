'use strict';

/**
 * AI-Dost Algorithm Verifier & Oracle Testing Engine
 * Validates algorithmic correctness across all 12 algorithm families using
 * independent reference oracles, boundary cases, and adversarial inputs.
 */

const { executeNodeScript, executePythonScript } = require('./executionSandbox');

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
      testHarness: `
const fn = typeof twoSum === 'function' ? twoSum : (typeof two_sum === 'function' ? two_sum : null);
assert.ok(fn, 'twoSum function must be defined');

// Standard cases
let res = fn([2, 7, 11, 15], 9);
assert.ok(Array.isArray(res) && res.length === 2, 'Result must be a 2-element array');
assert.deepStrictEqual(res.slice().sort((a,b)=>a-b), [0, 1]);

// Negative numbers and zeros
res = fn([-3, 4, 3, 90], 0);
assert.deepStrictEqual(res.slice().sort((a,b)=>a-b), [0, 2]);

// Duplicates
res = fn([3, 3], 6);
assert.deepStrictEqual(res.slice().sort((a,b)=>a-b), [0, 1]);

// No solution
assert.strictEqual(fn([1, 2, 3], 100), null, 'Must return null when no pair sums to target');

// Empty or single element
assert.strictEqual(fn([], 5), null, 'Empty array has no pair');
assert.strictEqual(fn([5], 5), null, 'Single element has no pair');

console.log('ALL_TESTS_PASSED');
`
    });

    // 2. Hashing (Hash Map / Frequency Counter)
    this.oracles.set('hash_map', {
      family: 'hashing',
      lang: 'javascript',
      testHarness: `
const Cls = typeof MyHashMap === 'function' ? MyHashMap : (typeof HashMap === 'function' ? HashMap : null);
assert.ok(Cls, 'MyHashMap class must be defined');

const map = new Cls();
map.put(1, 1);
map.put(2, 2);
assert.strictEqual(map.get(1), 1);
assert.strictEqual(map.get(3), -1, 'Missing key should return -1');
map.put(2, 1); // update existing key
assert.strictEqual(map.get(2), 1);
map.remove(2);
assert.strictEqual(map.get(2), -1);

// Adversarial: Hash collisions (large number of keys)
for (let i = 100; i < 200; i++) map.put(i, i * 2);
for (let i = 100; i < 200; i++) assert.strictEqual(map.get(i), i * 2);

console.log('ALL_TESTS_PASSED');
`
    });

    // 3. Sorting & Searching (Binary Search)
    this.oracles.set('binary_search', {
      family: 'sorting_searching',
      lang: 'javascript',
      testHarness: `
const fn = typeof binarySearch === 'function' ? binarySearch : (typeof search === 'function' ? search : null);
assert.ok(fn, 'binarySearch function must be defined');

assert.strictEqual(fn([1, 3, 5, 7, 9], 5), 2);
assert.strictEqual(fn([1, 3, 5, 7, 9], 1), 0);
assert.strictEqual(fn([1, 3, 5, 7, 9], 9), 4);
assert.strictEqual(fn([1, 3, 5, 7, 9], 4), -1);

// Edge cases
assert.strictEqual(fn([], 5), -1, 'Empty array returns -1');
assert.strictEqual(fn([5], 5), 0, 'Single element hit');
assert.strictEqual(fn([5], 2), -1, 'Single element miss');
assert.strictEqual(fn([-10, -5, 0, 3, 8, 12], -5), 1, 'Negative numbers');

console.log('ALL_TESTS_PASSED');
`
    });

    // 4. Stacks & Queues (Valid Parentheses)
    this.oracles.set('valid_parentheses', {
      family: 'stacks_queues',
      lang: 'javascript',
      testHarness: `
const fn = typeof isValidParentheses === 'function' ? isValidParentheses : (typeof isValid === 'function' ? isValid : null);
assert.ok(fn, 'isValidParentheses function must be defined');

assert.strictEqual(fn('()'), true);
assert.strictEqual(fn('()[]{}'), true);
assert.strictEqual(fn('(]'), false);
assert.strictEqual(fn('([)]'), false);
assert.strictEqual(fn('{[]}'), true);

// Boundary & adversarial cases
assert.strictEqual(fn(''), true, 'Empty string is valid');
assert.strictEqual(fn('('), false, 'Unclosed opening bracket');
assert.strictEqual(fn(']'), false, 'Unmatched closing bracket');
assert.strictEqual(fn('(((((((('), false, 'All opens');

console.log('ALL_TESTS_PASSED');
`
    });

    // 5. Linked Lists (Detect Cycle)
    this.oracles.set('linked_list_cycle', {
      family: 'linked_lists',
      lang: 'javascript',
      testHarness: `
const fn = typeof hasCycle === 'function' ? hasCycle : null;
assert.ok(fn, 'hasCycle function must be defined');

function Node(val, next = null) { this.val = val; this.next = next; }

// A -> B -> C -> null (no cycle)
const n3 = new Node(3);
const n2 = new Node(2, n3);
const n1 = new Node(1, n2);
assert.strictEqual(fn(n1), false);

// A -> B -> C -> B (cycle)
n3.next = n2;
assert.strictEqual(fn(n1), true);

// Single node self-loop
const single = new Node(10);
single.next = single;
assert.strictEqual(fn(single), true);

// Empty list
assert.strictEqual(fn(null), false);

console.log('ALL_TESTS_PASSED');
`
    });

    // 6. Trees (Validate BST)
    this.oracles.set('bst_validation', {
      family: 'trees',
      lang: 'javascript',
      testHarness: `
const fn = typeof isValidBST === 'function' ? isValidBST : null;
assert.ok(fn, 'isValidBST function must be defined');

function TreeNode(val, left = null, right = null) {
  this.val = val; this.left = left; this.right = right;
}

// Valid: 2 with left 1 and right 3
assert.strictEqual(fn(new TreeNode(2, new TreeNode(1), new TreeNode(3))), true);

// Invalid: 5 with left 1, right 4 (where right has left 3, right 6)
const badTree = new TreeNode(5, new TreeNode(1), new TreeNode(4, new TreeNode(3), new TreeNode(6)));
assert.strictEqual(fn(badTree), false);

// Empty tree and single node
assert.strictEqual(fn(null), true, 'Empty tree is valid BST');
assert.strictEqual(fn(new TreeNode(42)), true, 'Single node is valid BST');

// Duplicate values (BST forbids duplicates in strict order)
assert.strictEqual(fn(new TreeNode(2, new TreeNode(2), null)), false, 'Duplicates violate strict BST');

console.log('ALL_TESTS_PASSED');
`
    });

    // 7. Heaps (Min Heap)
    this.oracles.set('min_heap', {
      family: 'heaps',
      lang: 'javascript',
      testHarness: `
const Cls = typeof MinHeap === 'function' ? MinHeap : null;
assert.ok(Cls, 'MinHeap class must be defined');

const heap = new Cls();
heap.insert(5);
heap.insert(3);
heap.insert(8);
heap.insert(1);

assert.strictEqual(heap.peek(), 1, 'Peek must be minimum element');
assert.strictEqual(heap.extractMin(), 1);
assert.strictEqual(heap.extractMin(), 3);
assert.strictEqual(heap.extractMin(), 5);
assert.strictEqual(heap.extractMin(), 8);
assert.strictEqual(heap.extractMin(), null, 'Extracting from empty heap returns null');

console.log('ALL_TESTS_PASSED');
`
    });

    // 8. Graphs (BFS Shortest Path)
    this.oracles.set('graph_bfs', {
      family: 'graphs',
      lang: 'javascript',
      testHarness: `
const fn = typeof shortestPathBFS === 'function' ? shortestPathBFS : (typeof shortestPath === 'function' ? shortestPath : null);
assert.ok(fn, 'shortestPathBFS function must be defined');

const graph = {
  A: ['B', 'C'],
  B: ['A', 'D', 'E'],
  C: ['A', 'F'],
  D: ['B'],
  E: ['B', 'F'],
  F: ['C', 'E']
};

assert.strictEqual(fn(graph, 'A', 'F'), 2, 'Path A -> C -> F length is 2');
assert.strictEqual(fn(graph, 'A', 'A'), 0, 'Distance to self is 0');
assert.strictEqual(fn(graph, 'A', 'NON_EXISTENT'), -1, 'Unreachable node distance is -1');

console.log('ALL_TESTS_PASSED');
`
    });

    // 9. Dynamic Programming (Climbing Stairs)
    this.oracles.set('climbing_stairs', {
      family: 'dynamic_programming',
      lang: 'javascript',
      testHarness: `
const fn = typeof climbStairs === 'function' ? climbStairs : null;
assert.ok(fn, 'climbStairs function must be defined');

assert.strictEqual(fn(1), 1);
assert.strictEqual(fn(2), 2);
assert.strictEqual(fn(3), 3);
assert.strictEqual(fn(4), 5);
assert.strictEqual(fn(5), 8);
assert.strictEqual(fn(10), 89);

// Boundary
assert.strictEqual(fn(0), 1, '0 stairs has 1 way (do nothing)');

console.log('ALL_TESTS_PASSED');
`
    });

    // 10. Caching (LRU Cache)
    this.oracles.set('lru_cache', {
      family: 'caching',
      lang: 'javascript',
      testHarness: `
const Cls = typeof LRUCache === 'function' ? LRUCache : (typeof LruCache === 'function' ? LruCache : null);
assert.ok(Cls, 'LRUCache class must be defined');

const cache = new Cls(2);
cache.put(1, 1);
cache.put(2, 2);
assert.strictEqual(cache.get(1), 1);
cache.put(3, 3); // evicts key 2
assert.strictEqual(cache.get(2), -1, 'Key 2 should have been evicted');
cache.put(4, 4); // evicts key 1
assert.strictEqual(cache.get(1), -1, 'Key 1 should have been evicted');
assert.strictEqual(cache.get(3), 3);
assert.strictEqual(cache.get(4), 4);

console.log('ALL_TESTS_PASSED');
`
    });

    // 11. Union-Find (Disjoint Set)
    this.oracles.set('union_find', {
      family: 'union_find',
      lang: 'javascript',
      testHarness: `
const Cls = typeof UnionFind === 'function' ? UnionFind : (typeof DisjointSet === 'function' ? DisjointSet : null);
assert.ok(Cls, 'UnionFind class must be defined');

const uf = new Cls(5);
assert.strictEqual(uf.connected(0, 1), false);
uf.union(0, 1);
assert.strictEqual(uf.connected(0, 1), true);
uf.union(1, 2);
assert.strictEqual(uf.connected(0, 2), true, 'Transitive connectivity');
assert.strictEqual(uf.connected(0, 3), false);

console.log('ALL_TESTS_PASSED');
`
    });

    // 12. String Matching (KMP / Substring Search)
    this.oracles.set('string_matching', {
      family: 'string_matching',
      lang: 'javascript',
      testHarness: `
const fn = typeof strStr === 'function' ? strStr : (typeof kmpSearch === 'function' ? kmpSearch : null);
assert.ok(fn, 'strStr or kmpSearch function must be defined');

assert.strictEqual(fn('hello', 'll'), 2);
assert.strictEqual(fn('aaaaa', 'bba'), -1);
assert.strictEqual(fn('a', 'a'), 0);
assert.strictEqual(fn('mississippi', 'issip'), 4);

// Boundary cases
assert.strictEqual(fn('', ''), 0, 'Empty pattern in empty text is at index 0');
assert.strictEqual(fn('abc', ''), 0, 'Empty pattern is at index 0');
assert.strictEqual(fn('', 'a'), -1, 'Non-empty pattern in empty text returns -1');

console.log('ALL_TESTS_PASSED');
`
    });
  }

  /**
   * Verifies an algorithm candidate implementation against independent tests and oracles.
   */
  async verifyAlgorithm(name, candidateCode, options = {}) {
    const oracle = this.oracles.get(name);
    if (!oracle) {
      throw new Error(`Unknown algorithm test suite: '${name}'`);
    }

    const timeoutMs = options.timeoutMs || 4000;
    const result = await executeNodeScript({ code: candidateCode, testHarness: oracle.testHarness, timeoutMs });

    const verified = result.status === 'SUCCESS' && result.stdout.includes('ALL_TESTS_PASSED');

    return {
      name,
      family: oracle.family,
      lang: oracle.lang,
      verified,
      status: verified ? 'VERIFIED' : (result.status || 'FAILED'),
      durationMs: result.durationMs,
      error: result.error,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }
}

module.exports = {
  AlgorithmVerifier
};
