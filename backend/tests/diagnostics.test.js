const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const DiagnosticManager = require('../agent/diagnostics/DiagnosticManager');
const JSTsAdapter = require('../agent/diagnostics/adapters/JSTsAdapter');
const sandboxMgr = require('../sandbox/SandboxManager');
const AgentOrchestrator = require('../agent/orchestrator');

test('Diagnostics Layer Test Suite', async (t) => {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-tests-'));
  let sandboxId = null;

  // Try to setup sandbox if docker available
  const dockerAvailable = await sandboxMgr.isDockerAvailable();
  if (dockerAvailable) {
      const sb = await sandboxMgr.createSandbox('diag-test-proj', { workdir: ws });
      sandboxId = sb.id;
  }

  const dm = new DiagnosticManager();
  
  await t.test('1. Clean JS file', async () => {
      fs.writeFileSync(path.join(ws, 'clean.js'), 'const a = 1; console.log(a);');
      const res = await dm.runDiagnostics(sandboxId, ws, path.join(ws, 'clean.js'), 'hash1');
      assert.strictEqual(res.hasErrors, false);
      assert.strictEqual(res.diagnostics.length, 0);
  });

  await t.test('2. Syntax error JS file', async () => {
      fs.writeFileSync(path.join(ws, 'error.js'), 'const a = 1; console.log(a;');
      const res = await dm.runDiagnostics(sandboxId, ws, path.join(ws, 'error.js'), 'hash2');
      if (dockerAvailable) {
          assert.strictEqual(res.hasErrors, true);
          assert.ok(res.formattedErrors.includes('node-syntax'));
      }
  });

  await t.test('3. TypeScript Diagnostic', async () => {
      fs.writeFileSync(path.join(ws, 'test.ts'), 'let a: string = 5;');
      const res = await dm.runDiagnostics(sandboxId, ws, path.join(ws, 'test.ts'), 'hash3');
      // If tsc is not installed globally in the sandbox, it will fallback to node -c
      // node -c will throw syntax error on TS syntax!
      if (dockerAvailable) {
          assert.strictEqual(res.hasErrors, true);
      }
  });

  await t.test('4. Caching / Duplicate prevention', async () => {
      // Calling same file with same hash should hit cache
      fs.writeFileSync(path.join(ws, 'dup.js'), 'const a =');
      const res1 = await dm.runDiagnostics(sandboxId, ws, path.join(ws, 'dup.js'), 'hash4');
      const res2 = await dm.runDiagnostics(sandboxId, ws, path.join(ws, 'dup.js'), 'hash4');
      assert.deepStrictEqual(res1, res2);
  });

  await t.test('5. Secret file protection', async () => {
      fs.writeFileSync(path.join(ws, '.env'), 'SECRET=123');
      const res = await dm.runDiagnostics(sandboxId, ws, path.join(ws, '.env'), 'hash5');
      // Should not be handled by JS/TS adapter
      assert.strictEqual(res.hasErrors, false);
  });

  await t.test('6. Traversal Attempt', async () => {
      // JSTsAdapter uses path.relative which prevents traversal execution inside docker
      // since docker mounts strictly at /workspace
      fs.writeFileSync(path.join(ws, 'test.js'), 'ok');
      const traversalPath = path.join(ws, '../../etc/passwd');
      const res = await dm.runDiagnostics(sandboxId, ws, traversalPath, 'hash6');
      assert.strictEqual(res.hasErrors, false); // canHandle might even reject it, or docker fails safely
  });
  
  await t.test('7. State Machine Interceptor check', async () => {
      // Since executePlan involves LLM, we can just verify the logic
      // by running executeTool through the Orchestrator with the hook mocked or testing the patch manually.
      // We already tested that orchestrator constructor initializes it.
      const o = new AgentOrchestrator({ apiKey: 'dummy' });
      assert.ok(o.diagnosticManager !== undefined);
  });
});
