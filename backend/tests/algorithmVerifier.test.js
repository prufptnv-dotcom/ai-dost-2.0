'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { AlgorithmVerifier } = require('../quality-evaluation/algorithmVerifier');

test('AlgorithmVerifier and Independent Oracles Suite', async (t) => {
  const verifier = new AlgorithmVerifier();

  await t.test('1. Valid Two Sum implementation passes all public and hidden adversarial cases', async () => {
    const validCode = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return null;
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', validCode);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.status, 'VERIFIED');
    assert.strictEqual(res.family, 'arrays_strings');
    assert.ok(res.durationMs >= 0);
  });

  await t.test('2. Buggy Two Sum implementation (fails on negative numbers) is rejected by oracle', async () => {
    // Buggy: ignores negative numbers
    const buggyCode = `
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target && nums[i] > 0 && nums[j] > 0) return [i, j];
    }
  }
  return null;
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', buggyCode);
    assert.strictEqual(res.verified, false);
    assert.ok(res.status === 'TEST_FAILURE' || res.status === 'RUNTIME_ERROR' || res.status === 'FAILED');
  });

  await t.test('3. Valid LRU Cache implementation passes capacity, eviction, and get/put invariants', async () => {
    const validLRU = `
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }
  put(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
}
`;
    const res = await verifier.verifyAlgorithm('lru_cache', validLRU);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.status, 'VERIFIED');
    assert.strictEqual(res.family, 'caching');
  });

  await t.test('4. Valid Binary Search handles bounds and returns -1 on misses', async () => {
    const validBinarySearch = `
function binarySearch(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
`;
    const res = await verifier.verifyAlgorithm('binary_search', validBinarySearch);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.status, 'VERIFIED');
  });

  await t.test('5. Infinite loop is bounded by execution sandbox timeout', async () => {
    const infiniteLoopCode = `
function twoSum(nums, target) {
  while (true) {}
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', infiniteLoopCode, { timeoutMs: 800 });
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TIMEOUT');
    assert.ok(res.error.includes('TIMEOUT'));
  });

  await t.test('6. Syntax error in candidate code is reported distinctly', async () => {
    const syntaxErrorCode = `
function twoSum(nums, target) {
  return [1, 2
`;
    const res = await verifier.verifyAlgorithm('two_sum', syntaxErrorCode);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'SYNTAX_ERROR');
  });

  await t.test('7. Adversarial candidate attempts to monkey-patch assert and print ALL_TESTS_PASSED', async () => {
    const adversarialBypassAttempt = `
// Attempt to subvert the test harness by patching global assert and printing pass token
global.assert = {
  ok: () => true,
  strictEqual: () => true,
  deepStrictEqual: () => true
};
console.log('ALL_TESTS_PASSED');

function twoSum(nums, target) {
  // Returns bogus results
  return [999, 999];
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', adversarialBypassAttempt);
    // Verifier MUST reject the attempt because parent process oracle independently checks results
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TEST_FAILURE');
    assert.strictEqual(res.familyWideClaim, false);
  });

  await t.test('8. Candidate throwing uncaught runtime exception is rejected with RUNTIME_ERROR', async () => {
    const throwingCode = `
function twoSum(nums, target) {
  throw new Error('Fatal memory allocation failure');
}
`;
    const res = await verifier.verifyAlgorithm('two_sum', throwingCode);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'RUNTIME_ERROR');
    assert.ok(res.error.includes('Fatal memory allocation failure'));
  });

  await t.test('9. Missing required function entrypoint is rejected with TARGET_NOT_FOUND', async () => {
    const emptyCode = `
// No twoSum or two_sum declared
const irrelevantHelper = () => 42;
`;
    const res = await verifier.verifyAlgorithm('two_sum', emptyCode);
    assert.strictEqual(res.verified, false);
    assert.strictEqual(res.status, 'TARGET_NOT_FOUND');
  });

  await t.test('10. Verified algorithm produces bounded scope and does not award family-wide claim', async () => {
    const validBinarySearch = `
function binarySearch(nums, target) {
  let left = 0, right = nums.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
`;
    const res = await verifier.verifyAlgorithm('binary_search', validBinarySearch);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.status, 'VERIFIED');
    assert.strictEqual(res.scope, 'specific_problem');
    assert.strictEqual(res.familyWideClaim, false);
    assert.strictEqual(res.isolation.securityGuarantee, false);
  });
});
