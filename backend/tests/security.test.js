const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AgentOrchestrator = require('../agent/orchestrator');

test('Security & Reliability Test Suite', async (t) => {
  const o = new AgentOrchestrator({ apiKey: 'dummy' });
  const safeWs = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-ws-'));
  const outOfBoundsWs = fs.mkdtempSync(path.join(os.tmpdir(), 'out-of-bounds-'));
  fs.writeFileSync(path.join(safeWs, '.env'), 'SECRET_KEY=123');
  fs.writeFileSync(path.join(safeWs, 'app.js'), 'console.log("hello");');
  fs.writeFileSync(path.join(outOfBoundsWs, 'secret.txt'), 'OUT_OF_BOUNDS_SECRET');
  
  o.projectPath = safeWs;

  await t.test('1. Path Traversal Prevention (read_file)', async () => {
    const relativePathToOut = path.relative(safeWs, outOfBoundsWs);
    const attackPath = path.join(relativePathToOut, 'secret.txt');
    const res = await o.executeTool('read_file', { path: attackPath });
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Access denied/i);
  });

  await t.test('2. Absolute Path Escape Prevention (write_file)', async () => {
    const attackPath = path.join(outOfBoundsWs, 'hacked.txt');
    const res = await o.executeTool('write_file', { path: attackPath, content: 'hacked' });
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Access denied/i);
  });

  await t.test('3. Secret File Protection (.env)', async () => {
    const res = await o.executeTool('read_file', { path: '.env' });
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Access denied/i);
  });

  await t.test('4. Safe File Operations (read/write inside workspace)', async () => {
    const readRes = await o.executeTool('read_file', { path: 'app.js' });
    assert.strictEqual(readRes.success, true);
    const writeRes = await o.executeTool('write_file', { path: 'new.js', content: 'test' });
    assert.strictEqual(writeRes.success, true);
  });

  await t.test('5. Command Execution Blocklist', async () => {
    const res = await o.executeTool('execute_command', { command: 'rm -rf /' });
    assert.strictEqual(res.success, false);
    assert.match(res.error, /blocked for safety/i);
  });

  await t.test('6. list_directory blocks traversal', async () => {
    const relativePathToOut = path.relative(safeWs, outOfBoundsWs);
    const res = await o.executeTool('list_directory', { path: relativePathToOut });
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Access denied/i);
  });

  await t.test('7. apply_diff fails cleanly on missing search block', async () => {
    await o.executeTool('write_file', { path: 'diff-target.js', content: 'const a = 1;' });
    const res = await o.executeTool('apply_diff', { 
      path: 'diff-target.js', search_block: 'const a = 2;', new_code: 'const a = 3;' 
    });
    assert.strictEqual(res.success, false);
    assert.match(res.error, /not found in/i);
  });
});
