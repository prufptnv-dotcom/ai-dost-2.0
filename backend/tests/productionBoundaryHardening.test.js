'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseBodyLimitBytes, parseOriginList } = require('../productionBoundaryHardening');

test('production boundary helpers parse JSON limits safely', () => {
  assert.equal(parseBodyLimitBytes('50mb', 20 * 1024 * 1024), 50 * 1024 * 1024);
  assert.equal(parseBodyLimitBytes('1.5mb', 20 * 1024 * 1024), Math.floor(1.5 * 1024 * 1024));
  assert.equal(parseBodyLimitBytes('bad-limit', 20 * 1024 * 1024), 20 * 1024 * 1024);
});

test('production boundary helpers normalize configured origin lists', () => {
  assert.deepEqual(
    [...parseOriginList(' https://app.example.com, https://admin.example.com ,,')],
    ['https://app.example.com', 'https://admin.example.com']
  );
});

test('production boundary does not mutate caller configuration helpers', () => {
  const fallback = 20 * 1024 * 1024;
  assert.equal(parseBodyLimitBytes(undefined, fallback), fallback);
  assert.equal(parseBodyLimitBytes(1024, fallback), 1024);
});
