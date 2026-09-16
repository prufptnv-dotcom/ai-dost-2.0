'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
const dockerfile = fs.readFileSync(path.join(backendRoot, 'Dockerfile'), 'utf8');
const nvmrc = fs.readFileSync(path.join(backendRoot, '.nvmrc'), 'utf8').trim();
const requiredPreloads = [
  './security-hardening.js',
  './taskCancellation.js',
  './chatAgentRouteBridge.js',
];
const REQUIRED_NODE_MAJOR = '22';

function normalizeCommand(command) {
  return String(command || '').replace(/\\/g, '/');
}

test('backend declares one supported production Node major', () => {
  assert.equal(nvmrc, REQUIRED_NODE_MAJOR, 'backend/.nvmrc must pin Node 22');
  assert.equal(packageJson.engines?.node, '22.x', 'backend package engines must pin Node 22.x');
});

test('production start preloads required runtime policy modules', () => {
  const start = normalizeCommand(packageJson.scripts?.start);
  for (const preload of requiredPreloads) {
    assert.match(start, new RegExp(`-r\\s+${preload.replace('.', '\\.')}`), `npm start must preload ${preload}`);
  }
  assert.match(start, /server\.js\s*$/);
});

test('Docker runtime matches production preload chain', () => {
  const cmdLine = dockerfile
    .split('\n')
    .find((line) => line.trim().startsWith('CMD '));

  assert.ok(cmdLine, 'Dockerfile must declare an explicit CMD');
  for (const preload of requiredPreloads) {
    assert.match(cmdLine, new RegExp(`-r\\s+['\"]?${preload.replace('.', '\\.')}`), `Docker CMD must preload ${preload}`);
  }
  assert.match(cmdLine, /server\.js/);
});
