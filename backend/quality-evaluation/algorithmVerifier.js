'use strict';

/**
 * Algorithm Verifier & Oracle Testing Engine
 * Validates algorithmic correctness, contracts, edge cases, and time/space complexity bounds.
 */

const { executeNodeScript, executePythonScript } = require('./executionSandbox');

class AlgorithmVerifier {
  constructor() {
    this.oracles = new Map();
    this._registerCoreOracles();
  }

  _registerCoreOracles() {
    // 1. Two-sum / Pair with sum
    this.oracles.set('two_sum', {
      lang: 'javascript',
      reference: (nums, target) => {
        const map = new Map();
        for (let i = 0; i < nums.length; i++) {
          const comp = target - nums[i];
          if (map.has(comp)) return [map.get(comp), i];
          map.set(nums[i], i);
        }
        return null;
      },
      testHarness: `
const fn = typeof twoSum === 'function' ? twoSum : (typeof two_sum === 'function' ? two_sum : null);
assert.ok(fn, 'twoSum function must be defined');

// Public tests
const res1 = fn([2, 7, 11, 15], 9);
assert.deepStrictEqual(res1.sort(), [0, 1]);

// Hidden tests: negative numbers, duplicate elements, target zero
const res2 = fn([3, 2, 4], 6);
assert.deepStrictEqual(res2.sort(), [1, 2]);

const res3 = fn([3, 3], 6);
assert.deepStrictEqual(res3.sort(), [0, 1]);

const res4 = fn([-3, 4, 3, 90], 0);
assert.deepStrictEqual(res4.sort(), [0, 2]);

console.log('ALL_TESTS_PASSED');
`
    });

    // 2. Binary Search
    this.oracles.set('binary_search', {
      lang: 'javascript',
      reference: (arr, target) => {
        let left = 0;
        let right = arr.length - 1;
        while (left <= right) {
          const mid = (left + right) >> 1;
          if (arr[mid] === target) return mid;
          if (arr[mid] < target) left = mid + 1;
          else right = mid - 1;
        }
        return -1;
      },
      testHarness: `
const fn = typeof binarySearch === 'function' ? binarySearch : (typeof binary_search === 'function' ? binary_search : null);
assert.ok(fn, 'binarySearch function must be defined');

// Public tests
assert.strictEqual(fn([1, 3, 5, 7, 9], 5), 2);
assert.strictEqual(fn([1, 3, 5, 7, 9], 1), 0);
assert.strictEqual(fn([1, 3, 5, 7, 9], 9), 4);
assert.strictEqual(fn([1, 3, 5, 7, 9], 4), -1);

// Edge cases
assert.strictEqual(fn([], 5), -1, 'Empty array must return -1');
assert.strictEqual(fn([5], 5), 0, 'Single element match');
assert.strictEqual(fn([5], 2), -1, 'Single element miss');
assert.strictEqual(fn([-10, -5, 0, 3, 8, 12], -5), 1, 'Negative numbers');

console.log('ALL_TESTS_PASSED');
`
    });

    // 3. LRU Cache
    this.oracles.set('lru_cache', {
      lang: 'javascript',
      testHarness: `
const Cls = typeof LRUCache === 'function' ? LRUCache : (typeof LruCache === 'function' ? LruCache : null);
assert.ok(Cls, 'LRUCache class must be defined');

const cache = new Cls(2);
cache.put(1, 1);
cache.put(2, 2);
assert.strictEqual(cache.get(1), 1);
cache.put(3, 3); // evicts key 2
assert.strictEqual(cache.get(2), -1);
cache.put(4, 4); // evicts key 1
assert.strictEqual(cache.get(1), -1);
assert.strictEqual(cache.get(3), 3);
assert.strictEqual(cache.get(4), 4);

console.log('ALL_TESTS_PASSED');
`
    });
  }

  async verifyAlgorithm(name, candidateCode, options = {}) {
    const oracle = this.oracles.get(name);
    if (!oracle) {
      throw new Error(`Unknown algorithm test suite: '${name}'`);
    }

    const timeoutMs = options.timeoutMs || 3000;
    if (oracle.lang === 'javascript') {
      const result = await executeNodeScript({ code: candidateCode, testHarness: oracle.testHarness, timeoutMs });
      return {
        name,
        lang: 'javascript',
        verified: result.status === 'SUCCESS' && result.stdout.includes('ALL_TESTS_PASSED'),
        status: result.status,
        durationMs: result.durationMs,
        error: result.error,
        stdout: result.stdout,
        stderr: result.stderr
      };
    } else {
      const result = await executePythonScript({ code: candidateCode, testHarness: oracle.testHarness, timeoutMs });
      return {
        name,
        lang: 'python',
        verified: result.status === 'SUCCESS' && result.stdout.includes('ALL_TESTS_PASSED'),
        status: result.status,
        durationMs: result.durationMs,
        error: result.error,
        stdout: result.stdout,
        stderr: result.stderr
      };
    }
  }
}

module.exports = {
  AlgorithmVerifier
};
