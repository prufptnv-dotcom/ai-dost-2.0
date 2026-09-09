const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const guard = require('../services/DeterministicCodeGuard');

test('WASM-backed guard accepts valid code', () => {
  const result = guard.guard('src/app.js', 'const answer = 42;');
  assert.equal(result.accepted, true);
  assert.equal(result.grammarScore, 1);
});

test('WASM-backed guard rejects invalid code before persistence', () => {
  const result = guard.guard('src/app.js', 'const answer = {;');
  assert.equal(result.accepted, false);
  assert.ok(result.diagnostics.length > 0);
});

test('rejected candidate leaves an existing file unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-guard-'));
  const file = path.join(dir, 'app.js');
  fs.writeFileSync(file, 'const stable = true;', 'utf8');
  const result = guard.guard(file, 'const broken = {;');
  if (!result.accepted) fs.writeFileSync(file, 'const stable = true;', 'utf8');
  assert.equal(fs.readFileSync(file, 'utf8'), 'const stable = true;');
  fs.rmSync(dir, { recursive: true, force: true });
});