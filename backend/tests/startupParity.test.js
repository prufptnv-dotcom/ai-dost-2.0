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

// Match a `-r ./module` preload in either shell form (`node -r ./x server.js`)
// or JSON exec form (`CMD ["node", "-r", "./x", ...]` / pm2 arg arrays) by
// flattening quotes/commas first and regex-escaping the module path fully.
function assertPreloads(commandLine, label) {
  const flattened = normalizeCommand(commandLine).replace(/["',]+/g, ' ');
  for (const preload of requiredPreloads) {
    const escaped = preload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(flattened, new RegExp(`-r\\s+${escaped}`), `${label} must preload ${preload}`);
  }
  return flattened;
}

test('backend declares one supported production Node major', () => {
  assert.equal(nvmrc, REQUIRED_NODE_MAJOR, 'backend/.nvmrc must pin Node 22');
  assert.equal(packageJson.engines?.node, '22.x', 'backend package engines must pin Node 22.x');
});

test('production start preloads required runtime policy modules', () => {
  const start = packageJson.scripts?.start;
  assertPreloads(start, 'npm start');
  assert.match(normalizeCommand(start), /server\.js\s*$/);
});

test('Docker runtime matches production preload chain', () => {
  const cmdLine = dockerfile
    .split('\n')
    .find((line) => line.trim().startsWith('CMD '));

  assert.ok(cmdLine, 'Dockerfile must declare an explicit CMD');
  assertPreloads(cmdLine, 'Docker CMD');
  assert.match(cmdLine, /server\.js/);
});
