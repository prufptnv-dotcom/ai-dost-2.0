'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { AlgorithmVerifier } = require('./algorithmVerifier');
const { executeNodeScript, executePythonScript } = require('./executionSandbox');

test('Phase 1 Evaluator: Sandbox execution, timeouts, and failure classification', async (t) => {
  const verifier = new AlgorithmVerifier();

  await t.test('1. Correct algorithm code passes verification', async () => {
    const validBinarySearch = `
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
`;
    const result = await verifier.verifyAlgorithm('binary_search', validBinarySearch);
    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.status, 'SUCCESS');
  });

  await t.test('2. Plausible but incorrect code fails (off-by-one or missing boundary check)', async () => {
    const buggyBinarySearch = `
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  // BUG: < instead of <= misses single element or last element match!
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
`;
    const result = await verifier.verifyAlgorithm('binary_search', buggyBinarySearch);
    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, 'TEST_FAILURE');
  });

  await t.test('3. Incomplete code with syntax or runtime errors fails', async () => {
    const incompleteCode = `
function binarySearch(arr, target) {
  // TODO: implement logic
  throw new Error('Not implemented');
}
`;
    const result = await verifier.verifyAlgorithm('binary_search', incompleteCode);
    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, 'RUNTIME_ERROR');
  });

  await t.test('4. Infinite loop triggers hard timeout without hanging test runner', async () => {
    const infiniteLoop = `
function binarySearch(arr, target) {
  while (true) {}
}
`;
    const result = await verifier.verifyAlgorithm('binary_search', infiniteLoop, { timeoutMs: 800 });
    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, 'TIMEOUT');
  });

  await t.test('5. Faked implementation returning constant fails test suite', async () => {
    const fakedTwoSum = `
function twoSum(nums, target) {
  return [0, 1]; // Only works if answer happens to be [0, 1]
}
`;
    const result = await verifier.verifyAlgorithm('two_sum', fakedTwoSum);
    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.status, 'TEST_FAILURE');
  });
});
