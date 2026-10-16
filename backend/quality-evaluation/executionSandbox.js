'use strict';

/**
 * Isolated Subprocess Execution Sandbox for Quality Evaluation
 * Provides resource-bounded execution for Node.js and Python solutions.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_TIMEOUT_MS = 4000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const cwd = options.cwd || os.tmpdir();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(command, args, {
      cwd,
      env: {
        SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\Windows',
        PATH: process.env.PATH || '',
        NODE_ENV: 'test'
      },
      windowsHide: true
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch (_) {}
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += chunk.toString('utf8');
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += chunk.toString('utf8');
      }
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const durationMs = options.startTime ? Date.now() - options.startTime : 0;

      if (timedOut) {
        return resolve({
          status: 'TIMEOUT',
          exitCode: -1,
          stdout,
          stderr: `Execution timed out after ${timeoutMs}ms`,
          durationMs: timeoutMs,
          error: `TIMEOUT: Exceeded ${timeoutMs}ms limit`
        });
      }

      if (exitCode === 0) {
        return resolve({
          status: 'SUCCESS',
          exitCode: 0,
          stdout,
          stderr,
          durationMs,
          error: null
        });
      }

      let status = 'RUNTIME_ERROR';
      if (stderr.includes('AssertionError') || stderr.includes('ERR_ASSERTION') || stderr.includes('ASSERTION_FAILED')) {
        status = 'TEST_FAILURE';
      } else if (stderr.includes('SyntaxError') || stderr.includes('IndentationError')) {
        status = 'SYNTAX_ERROR';
      }

      resolve({
        status,
        exitCode,
        stdout,
        stderr,
        durationMs,
        error: stderr.trim().split('\n').pop() || `Process exited with code ${exitCode}`
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        status: 'SPAWN_ERROR',
        exitCode: -1,
        stdout,
        stderr: err.message,
        durationMs: 0,
        error: err.message
      });
    });
  });
}

const ISOLATION_LIMITATION = 'Subprocess execution without OS containerization (jail/cgroups). Filesystem access is bounded by process environment; no full security sandbox guarantee is claimed.';

async function executeCandidateRunner({ code, spec, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-eval-runner-'));
  const candidatePath = path.join(tmpDir, 'candidate.js');
  const specPath = path.join(tmpDir, 'spec.json');
  const runnerPath = path.join(tmpDir, 'runner.js');

  const runnerScript = `'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const originalWrite = process.stdout.write.bind(process.stdout);

function emitResult(payload) {
  originalWrite('\\n__AIDOST_RESULT__:' + JSON.stringify(payload) + '\\n');
}

try {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const candidateCode = fs.readFileSync(path.join(__dirname, 'candidate.js'), 'utf8');

  function ListNode(val, next = null) {
    this.val = val;
    this.next = next;
  }
  function TreeNode(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }

  function buildLinkedList(values, cycleIndex) {
    if (!values || values.length === 0) return null;
    const nodes = values.map((v) => new ListNode(v));
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].next = nodes[i + 1];
    }
    if (cycleIndex >= 0 && cycleIndex < nodes.length) {
      nodes[nodes.length - 1].next = nodes[cycleIndex];
    }
    return nodes[0];
  }

  function buildTree(nodeDef) {
    if (!nodeDef || typeof nodeDef !== 'object') return null;
    return new TreeNode(nodeDef.val, buildTree(nodeDef.left), buildTree(nodeDef.right));
  }

  const sandbox = {
    console: {
      log: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    },
    Math,
    Array,
    Object,
    Number,
    String,
    Boolean,
    Set,
    Map,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    ListNode,
    TreeNode,
    Node: ListNode
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  const exportCollector = (spec.names || []).map(function(n) {
    return 'if (typeof ' + n + ' !== "undefined") __aidost_exports["' + n + '"] = ' + n + ';';
  }).join('\\n');
  const wrappedCode = candidateCode + '\\n; const __aidost_exports = {};\\n' + exportCollector + '\\n; __aidost_exports;';

  // Execute candidate code in VM context with strict execution timeout
  const collectedExports = vm.runInContext(wrappedCode, context, { timeout: 3500 });

  const results = [];

  if (spec.mode === 'function') {
    let fn = null;
    for (const name of (spec.names || [])) {
      if (collectedExports && typeof collectedExports[name] === 'function') {
        fn = collectedExports[name];
        break;
      }
      if (typeof context[name] === 'function') {
        fn = context[name];
        break;
      }
    }
    if (!fn) {
      emitResult({ runnerStatus: 'TARGET_NOT_FOUND', error: 'Function [' + (spec.names || []).join(', ') + '] not defined by candidate.' });
      process.exit(0);
    }

    for (const testCase of (spec.cases || [])) {
      try {
        let args = testCase.args || [];
        if (testCase.customType === 'linked_list') {
          args = [buildLinkedList(testCase.listValues, testCase.cycleIndex)];
        } else if (testCase.customType === 'tree') {
          args = [buildTree(testCase.treeDef)];
        }
        const res = fn.apply(null, args);
        results.push({ id: testCase.id, status: 'SUCCESS', result: res });
      } catch (caseErr) {
        results.push({ id: testCase.id, status: 'ERROR', error: caseErr.message });
      }
    }
  } else if (spec.mode === 'class') {
    let Cls = null;
    for (const name of (spec.names || [])) {
      if (collectedExports && typeof collectedExports[name] === 'function') {
        Cls = collectedExports[name];
        break;
      }
      if (typeof context[name] === 'function') {
        Cls = context[name];
        break;
      }
    }
    if (!Cls) {
      emitResult({ runnerStatus: 'TARGET_NOT_FOUND', error: 'Class [' + (spec.names || []).join(', ') + '] not defined by candidate.' });
      process.exit(0);
    }

    let instance = null;
    for (const op of (spec.operations || [])) {
      try {
        if (op.op === 'new') {
          instance = new Cls(...(op.args || []));
          results.push({ id: op.id, status: 'SUCCESS', result: '__INSTANTIATED__' });
        } else {
          if (!instance || typeof instance[op.op] !== 'function') {
            results.push({ id: op.id, status: 'ERROR', error: 'Method ' + op.op + ' not found on instance' });
          } else {
            const res = instance[op.op](...(op.args || []));
            results.push({ id: op.id, status: 'SUCCESS', result: res });
          }
        }
      } catch (opErr) {
        results.push({ id: op.id, status: 'ERROR', error: opErr.message });
      }
    }
  }

  emitResult({ runnerStatus: 'EXECUTED', results });
  process.exit(0);
} catch (err) {
  const isSyntax = err.name === 'SyntaxError' || (err.message && err.message.includes('SyntaxError'));
  emitResult({ runnerStatus: isSyntax ? 'SYNTAX_ERROR' : 'RUNNER_EXCEPTION', error: err.message, stack: err.stack });
  process.exit(0);
}

`;

  try {
    fs.writeFileSync(candidatePath, code, 'utf8');
    fs.writeFileSync(specPath, JSON.stringify(spec), 'utf8');
    fs.writeFileSync(runnerPath, runnerScript, 'utf8');

    const startTime = Date.now();
    const runRes = await runProcess(process.execPath, ['--no-addons', runnerPath, specPath], {
      cwd: tmpDir,
      timeoutMs,
      startTime
    });

    let runnerOutput = null;
    const match = runRes.stdout.match(/__AIDOST_RESULT__:([^\r\n]+)/);
    if (match) {
      try {
        runnerOutput = JSON.parse(match[1]);
      } catch (_) {}
    }

    return {
      status: runRes.status,
      exitCode: runRes.exitCode,
      stdout: runRes.stdout,
      stderr: runRes.stderr,
      durationMs: runRes.durationMs,
      error: runRes.error,
      runnerOutput,
      isolation: {
        level: 'SUBPROCESS_RESTRICTED',
        securityGuarantee: false,
        limitation: ISOLATION_LIMITATION
      }
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

async function executeNodeScript({ code, testHarness = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-eval-node-'));
  const scriptPath = path.join(tmpDir, 'solution.js');
  const fullContent = `'use strict';
const assert = require('assert');

${code}

// ── Test Harness ──
${testHarness}
`;

  try {
    fs.writeFileSync(scriptPath, fullContent, 'utf8');
    const startTime = Date.now();
    return await runProcess(process.execPath, ['--no-addons', scriptPath], { cwd: tmpDir, timeoutMs, startTime });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

async function executePythonScript({ code, testHarness = '', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-eval-py-'));
  const scriptPath = path.join(tmpDir, 'solution.py');
  const fullContent = `# -*- coding: utf-8 -*-
import sys
import os

${code}

# ── Test Harness ──
${testHarness}
`;

  try {
    fs.writeFileSync(scriptPath, fullContent, 'utf8');
    const startTime = Date.now();
    return await runProcess('python', [scriptPath], { cwd: tmpDir, timeoutMs, startTime });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

module.exports = {
  executeCandidateRunner,
  executeNodeScript,
  executePythonScript,
  runProcess,
  ISOLATION_LIMITATION
};
