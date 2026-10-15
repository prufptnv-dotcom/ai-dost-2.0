'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildCommands } = require('./test');

test('root test command sends coverage only to frontend Jest', () => {
  assert.deepStrictEqual(buildCommands(['--coverage']), [
    {
      name: 'Frontend Jest',
      args: ['--prefix', 'frontend', 'test', '--', '--coverage']
    },
    {
      name: 'Backend test suite',
      args: ['--prefix', 'backend', 'run', 'test:all']
    }
  ]);
});

test('root test command runs both suites without adding empty forwarded arguments', () => {
  assert.deepStrictEqual(buildCommands([]), [
    {
      name: 'Frontend Jest',
      args: ['--prefix', 'frontend', 'test']
    },
    {
      name: 'Backend test suite',
      args: ['--prefix', 'backend', 'run', 'test:all']
    }
  ]);
});

test('root test command forwards multiple Jest flags as separate arguments', () => {
  assert.deepStrictEqual(buildCommands(['--coverage', '--runInBand']), [
    {
      name: 'Frontend Jest',
      args: ['--prefix', 'frontend', 'test', '--', '--coverage', '--runInBand']
    },
    {
      name: 'Backend test suite',
      args: ['--prefix', 'backend', 'run', 'test:all']
    }
  ]);
});
