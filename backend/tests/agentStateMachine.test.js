const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AgentOrchestrator = require('../agent/orchestrator');

test('Agent State Machine Test Suite', async (t) => {
  
  // Create a base orchestrator that we can mock callModel for
  function createOrchestrator(mockResponses) {
    const o = new AgentOrchestrator({ apiKey: 'dummy' });
    let idx = 0;
    o.callModel = async () => {
       if (idx < mockResponses.length) {
         return mockResponses[idx++];
       }
       return '{"action": "FINAL_ANSWER"}';
    };
    // Mock tools to prevent actual execution affecting state drastically
    o.executeTool = async (action, params) => {
       if (action === 'verify_project') {
          return { success: true, checks: [{ name: 'test', command: 'npm test', success: true }] };
       }
       if (action === 'write_file' && params.path) {
          const fs = require('fs');
          const path = require('path');
          const full = path.join(params.projectPath || tempDir, params.path);
          if (params.path.includes('../') || path.isAbsolute(params.path)) return { success: false, error: 'invalid' };
          fs.writeFileSync(full, params.content || '');
          return { success: true };
       }
       return { success: true };
    };
    return o;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sm-'));

  await t.test('1. INIT -> INSPECT to 5. VERIFY success -> REVIEW to 9. REVIEW success -> DONE', async () => {
    const o = createOrchestrator([
      '{"action": "FINAL_ANSWER"}', // INSPECT -> PLAN
      '{"action": "FINAL_ANSWER"}', // PLAN -> IMPLEMENT
      '{"action": "FINAL_ANSWER"}', // IMPLEMENT -> VERIFY
      '{"action": "verify_project"}', // VERIFY runs tool
      '{"action": "FINAL_ANSWER"}', // VERIFY -> REVIEW
      '{"action": "FINAL_ANSWER", "answer": "Acceptable"}' // REVIEW -> DONE
    ]);

    const states = [];
    const onStep = (step) => {
       if (step.type === 'state') states.push(step.state);
       if (step.type === 'verification') states.push('VERIFICATION_EVENT');
    };

    const res = await o.executePlan('task', tempDir, onStep);
    
    // 1-5, 9, 12. DONE terminal, 24. successful executePlan result
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.completed, true);
    assert.strictEqual(res.state, 'DONE');
    assert.ok(states.includes('INSPECT'), '1. INIT -> INSPECT');
    assert.ok(states.includes('PLAN'), '2. INSPECT -> PLAN');
    assert.ok(states.includes('IMPLEMENT'), '3. PLAN -> IMPLEMENT');
    assert.ok(states.includes('VERIFY'), '4. IMPLEMENT -> VERIFY');
    assert.ok(states.includes('REVIEW'), '5. VERIFY success -> REVIEW');
    assert.ok(states.includes('VERIFICATION_EVENT'), 'SSE verification event emitted');
  });

  await t.test('6. VERIFY failure -> DIAGNOSE -> 7. DIAGNOSE -> REPAIR -> 8. REPAIR -> VERIFY', async () => {
    const o = createOrchestrator([
      '{"action": "FINAL_ANSWER"}', // INSPECT -> PLAN
      '{"action": "FINAL_ANSWER"}', // PLAN -> IMPLEMENT
      '{"action": "FINAL_ANSWER"}', // IMPLEMENT -> VERIFY
      '{"action": "verify_project"}', // VERIFY runs tool (mocked to fail below)
      '{"action": "FINAL_ANSWER"}', // VERIFY -> DIAGNOSE
      '{"action": "FINAL_ANSWER"}', // DIAGNOSE -> REPAIR
      '{"action": "FINAL_ANSWER"}', // REPAIR -> VERIFY
      '{"action": "verify_project"}', // VERIFY runs tool (now succeeds)
      '{"action": "FINAL_ANSWER"}', // VERIFY -> REVIEW
      '{"action": "FINAL_ANSWER", "answer": "Acceptable"}' // REVIEW -> DONE
    ]);

    let attempt = 0;
    o.executeTool = async (action, params) => {
       if (action === 'verify_project') {
          attempt++;
          if (attempt === 1) return { success: false, checks: [{ name: 'test', success: false }] };
          return { success: true, checks: [{ name: 'test', success: true }] };
       }
       return { success: true };
    };

    const states = [];
    const res = await o.executePlan('task', tempDir, (step) => {
       if (step.type === 'state') states.push(step.state);
    });

    assert.ok(states.includes('DIAGNOSE'), '6. VERIFY failure -> DIAGNOSE');
    assert.ok(states.includes('REPAIR'), '7. DIAGNOSE -> REPAIR');
    assert.strictEqual(states.filter(s => s === 'VERIFY').length, 2, '8. REPAIR -> VERIFY');
  });

  await t.test('10. REVIEW failure -> REPAIR', async () => {
    const o = createOrchestrator([
      '{"action": "FINAL_ANSWER"}', // INSPECT -> PLAN
      '{"action": "FINAL_ANSWER"}', // PLAN -> IMPLEMENT
      '{"action": "FINAL_ANSWER"}', // IMPLEMENT -> VERIFY
      '{"action": "verify_project"}', // VERIFY runs tool (success)
      '{"action": "FINAL_ANSWER"}', // VERIFY -> REVIEW
      '{"action": "FINAL_ANSWER", "answer": "Problem detected"}', // REVIEW -> REPAIR
      '{"action": "FINAL_ANSWER"}', // REPAIR -> VERIFY
      '{"action": "verify_project"}', // VERIFY runs tool (success)
      '{"action": "FINAL_ANSWER"}', // VERIFY -> REVIEW
      '{"action": "FINAL_ANSWER", "answer": "Acceptable"}' // REVIEW -> DONE
    ]);

    const states = [];
    await o.executePlan('task', tempDir, (step) => {
       if (step.type === 'state') states.push(step.state);
    });

    assert.strictEqual(states.filter(s => s === 'REPAIR').length, 1, '10. REVIEW failure -> REPAIR');
  });

  await t.test('11. invalid transition rejected, 13. FAILED terminal', async () => {
    const o2 = createOrchestrator([
      '{"action": "FINAL_ANSWER"}', // INSPECT -> PLAN
      '{"action": "FINAL_ANSWER"}', // PLAN -> IMPLEMENT
      '{"action": "FINAL_ANSWER"}', // IMPLEMENT -> VERIFY
      '{"action": "FINAL_ANSWER"}', // bypassed verify_project
    ]);
    
    const states = [];
    const res = await o2.executePlan('task', tempDir, (step) => {
      if (step.type === 'state') states.push(step.state);
    });
    
    assert.strictEqual(res.state, 'FAILED', '13. FAILED terminal');
    assert.ok(res.failures[0].includes('Verification bypassed'), 'Verification failure added');
  });

  await t.test('14. maximum 5 repairs', async () => {
    const o = createOrchestrator(Array(50).fill('{"action": "FINAL_ANSWER"}'));
    o.executeTool = async (action, params) => {
       if (action === 'verify_project') {
          return { success: false, checks: [{ name: 'test', success: false }] };
       }
       return { success: true };
    };

    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.state, 'FAILED');
    assert.strictEqual(res.repairs, 5, 'Maximum repairs limit hit');
    assert.strictEqual(res.completed, false);
  });

  await t.test('15. maximum 50 total steps', async () => {
    const o = createOrchestrator(Array(60).fill('{"action": "search_codebase"}'));
    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.state, 'FAILED');
    assert.ok(res.failures[0].includes('maximum execution limit of 50 steps'));
  });

  
  await t.test('22. successful existing-file modification -> beforeHash != afterHash', async () => {
    const filePath = path.join(tempDir, 'existing.js');
    fs.writeFileSync(filePath, 'old content');
    
    const o = createOrchestrator([
      '{"action": "write_file", "parameters": {"path": "existing.js", "content": "new content"}}',
      '{"action": "FINAL_ANSWER"}' 
    ]);
    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.changedFiles.length, 1);
    assert.strictEqual(res.changedFiles[0].path, 'existing.js');
    assert.strictEqual(res.changedFiles[0].operation, 'write_file');
    assert.ok(res.changedFiles[0].beforeHash);
    assert.ok(res.changedFiles[0].afterHash);
    assert.notStrictEqual(res.changedFiles[0].beforeHash, res.changedFiles[0].afterHash);
  });

  await t.test('24. successful new-file write -> beforeHash null + valid afterHash', async () => {
    const o = createOrchestrator([
      '{"action": "write_file", "parameters": {"path": "newfile.js", "content": "content"}}',
      '{"action": "FINAL_ANSWER"}' 
    ]);
    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.changedFiles.length, 1);
    assert.strictEqual(res.changedFiles[0].path, 'newfile.js');
    assert.strictEqual(res.changedFiles[0].beforeHash, null);
    assert.ok(res.changedFiles[0].afterHash);
  });

  await t.test('25. failed write -> changedFiles unchanged', async () => {
    const o = createOrchestrator([
      '{"action": "write_file", "parameters": {"path": "fail.js", "content": "content"}}',
      '{"action": "FINAL_ANSWER"}' 
    ]);
    // Mock tool to fail
    o.executeTool = async () => ({ success: false });
    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.changedFiles.length, 0);
  });

  await t.test('26. traversal attempt -> changedFiles unchanged', async () => {
    const o = createOrchestrator([
      '{"action": "write_file", "parameters": {"path": "../escaped.js", "content": "content"}}',
      '{"action": "FINAL_ANSWER"}' 
    ]);
    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.changedFiles.length, 0);
  });

  await t.test('27. absolute/out-of-workspace path -> changedFiles unchanged', async () => {
    const o = createOrchestrator([
      '{"action": "write_file", "parameters": {"path": "/etc/passwd", "content": "content"}}',
      '{"action": "FINAL_ANSWER"}' 
    ]);
    const res = await o.executePlan('task', tempDir);
    assert.strictEqual(res.changedFiles.length, 0);
  });


  await t.test('23. no chain-of-thought in SSE', async () => {
    const o = createOrchestrator([
      '{"action": "FINAL_ANSWER"}'
    ]);
    const events = [];
    await o.executePlan('task', tempDir, (step) => events.push(step));
    for (const e of events) {
       assert.strictEqual(e.thought, undefined, 'Thought should not be in SSE');
    }
  });

  await t.test('16-20. Verification command discovery via real executeTool', async () => {
      const sandboxMgr = require('../sandbox/SandboxManager');
      sandboxMgr.createSandbox = async () => ({ id: 'mock-sb-id' });
      sandboxMgr.exec = async (id, cmd) => ({ success: true, exitCode: 0, stdout: cmd.includes('test') || cmd === 'pytest' || cmd.includes('unittest') ? 'test_passed' : cmd.includes('build') ? 'build_passed' : 'lint_passed' });
    const o = new AgentOrchestrator({ apiKey: 'dummy' });
    const verifyWs = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-'));
    
    // Create package.json with scripts
    fs.writeFileSync(path.join(verifyWs, 'package.json'), JSON.stringify({
      scripts: {
        test: 'echo test_passed',
        build: 'echo build_passed',
        lint: 'echo lint_passed'
      }
    }));

    const res = await o.executeTool('verify_project', { workspacePath: verifyWs });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.checks.length, 3);
    const commands = res.checks.map(c => c.name).sort();
    assert.deepStrictEqual(commands, ['build', 'lint', 'test']);

    // Pytest fallback detection
    const pyWs = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-py-'));
    fs.writeFileSync(path.join(pyWs, 'pytest.ini'), '');
    const res2 = await o.executeTool('verify_project', { workspacePath: pyWs });
    assert.strictEqual(res2.checks[0].command, 'pytest');
    
    // Unittest fallback detection
    const pyWs2 = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-py2-'));
    const res3 = await o.executeTool('verify_project', { workspacePath: pyWs2 });
    assert.strictEqual(res3.checks[0].command, 'python -m unittest discover');
  });

});
