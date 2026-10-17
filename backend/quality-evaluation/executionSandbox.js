'use strict';

/**
 * Isolated Subprocess Execution Sandbox for Quality Evaluation
 * Provides resource-bounded execution for Node.js and Python candidate solutions.
 *
 * Security & Isolation Architecture:
 * - Subprocess execution runs in a separate process with bounded memory, timeout, and output limits.
 * - VM context inside the runner contains zero host functions (no prototype constructor crawling).
 * - Result communication uses a private output file, rejecting candidate stdout manipulation.
 * - Subprocess restriction is explicitly distinguished from genuine OS container isolation (jail/cgroups).
 */

const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { ContainerExecutionAdapter } = require('./containerExecutionAdapter');

const DEFAULT_TIMEOUT_MS = 4000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB

const ISOLATION_LIMITATION =
  'Subprocess execution with memory separation and restricted VM context. OS container isolation (namespaces/cgroups/jail) is NOT active on this host; no full OS security sandbox guarantee is claimed.';

let _testContainerOverride = null;
function _setOsIsolationBackendForTesting(override) {
  _testContainerOverride = override;
}

/**
 * Checks whether true OS container isolation (Docker, Podman, or cgroups/nsjail) is operational.
 * Note: An environment variable AIDOST_CONTAINER_ISOLATION=true is NOT trusted on its own.
 * We actively probe for an operational container CLI responding to 'info'.
 */
function checkOsIsolationAvailable(options = {}) {
  if (_testContainerOverride !== null) {
    if (options && options.details) return _testContainerOverride;
    return Boolean(_testContainerOverride.available);
  }

  const adapter = new ContainerExecutionAdapter();
  const probe = adapter.probeRuntime();
  if (probe.available) {
    const details = { available: true, runtime: probe.runtime, verified: true };
    if (options && options.details) return details;
    return true;
  }

  const details = {
    available: false,
    runtime: null,
    verified: false,
    reason: probe.reason || 'No operational container runtime (Docker/Podman) is responding on this host'
  };
  if (options && options.details) return details;
  return false;
}

function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const cwd = options.cwd || os.tmpdir();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputLimitExceeded = false;

    const child = spawn(command, args, {
      cwd,
      env: {
        SYSTEMROOT: process.env.SYSTEMROOT || String.raw`C:\Windows`,
        PATH: process.env.PATH || '',
        NODE_ENV: 'test'
      },
      windowsHide: true
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch (_) {
        // Child process may already have terminated
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > MAX_OUTPUT_BYTES) {
        outputLimitExceeded = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > MAX_OUTPUT_BYTES) {
        outputLimitExceeded = true;
        try {
          child.kill('SIGKILL');
        } catch (_) {}
      }
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      const durationMs = options.startTime ? Date.now() - options.startTime : 0;

      if (timedOut) {
        return resolve({
          status: 'TIMEOUT',
          exitCode: -1,
          stdout: stdout.slice(0, 1024),
          stderr: `Execution timed out after ${timeoutMs}ms`,
          durationMs: timeoutMs,
          error: `TIMEOUT: Exceeded ${timeoutMs}ms limit`
        });
      }

      if (outputLimitExceeded) {
        return resolve({
          status: 'OUTPUT_LIMIT_EXCEEDED',
          exitCode: -1,
          stdout: stdout.slice(0, 1024),
          stderr: `Process exceeded maximum output limit of ${MAX_OUTPUT_BYTES} bytes`,
          durationMs,
          error: `OUTPUT_LIMIT_EXCEEDED: Exceeded ${MAX_OUTPUT_BYTES} bytes limit`
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

function resolveContainerResultStatus(containerResult) {
  if (containerResult.status === 'TIMEOUT') return 'TIMEOUT';
  if (containerResult.exitCode === 0) return 'SUCCESS';
  return containerResult.status || 'FAILED';
}

async function dispatchRunnerExecution({
  requireOsIsolation,
  containerAdapter,
  tmpDir,
  runnerPath,
  specPath,
  outputPath,
  runNonce,
  timeoutMs,
  startTime
}) {
  if (requireOsIsolation && containerAdapter) {
    const containerResult = await containerAdapter.execute({
      stagedDir: tmpDir,
      command: 'node',
      args: ['runner.js', 'spec.json', `result_${runNonce}.json`],
      timeoutMs
    });
    return {
      runRes: {
        status: resolveContainerResultStatus(containerResult),
        exitCode: containerResult.exitCode,
        stdout: containerResult.stdout,
        stderr: containerResult.stderr,
        durationMs: Date.now() - startTime,
        error: containerResult.error
      },
      isolationInfo: {
        level: 'CONTAINER_ISOLATED',
        securityGuarantee: true,
        containerIsolation: true,
        limitation: null
      }
    };
  }

  const runRes = await runProcess(
    process.execPath,
    [
      '--no-addons',
      '--max-old-space-size=64',
      '--disallow-code-generation-from-strings',
      runnerPath,
      specPath,
      outputPath
    ],
    {
      cwd: tmpDir,
      timeoutMs,
      startTime
    }
  );
  return {
    runRes,
    isolationInfo: {
      level: 'SUBPROCESS_RESTRICTED',
      securityGuarantee: false,
      containerIsolation: false,
      limitation: ISOLATION_LIMITATION
    }
  };
}

function checkStrictIsolationAvailable(requireOsIsolation, containerAdapter) {
  if (!requireOsIsolation) return null;
  const isAvailable = containerAdapter ? containerAdapter.isAvailable() : checkOsIsolationAvailable();
  if (isAvailable) return null;
  return {
    status: 'SANDBOX_UNAVAILABLE',
    exitCode: -1,
    stdout: '',
    stderr: 'Required OS-level container isolation is unavailable on this host.',
    durationMs: 0,
    error: 'SANDBOX_UNAVAILABLE: Execution blocked because strict container isolation is required but unavailable.',
    runnerOutput: null,
    isolation: {
      level: 'NONE',
      securityGuarantee: false,
      containerIsolation: false,
      limitation: 'Host lacks container/jail isolation'
    }
  };
}

/**
 * Executes candidate code out-of-process in a strictly bounded runner.
 * Results are communicated strictly out-of-band via private output file.
 */
async function executeCandidateRunner({ code, spec, timeoutMs = DEFAULT_TIMEOUT_MS, requireOsIsolation = false, adapter = null }) {
  const containerAdapter = adapter || (requireOsIsolation ? new ContainerExecutionAdapter({ strictIsolation: true, timeoutMs }) : null);
  const isolationBlocked = checkStrictIsolationAvailable(requireOsIsolation, containerAdapter);
  if (isolationBlocked) return isolationBlocked;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-eval-runner-'));
  const candidatePath = path.join(tmpDir, 'candidate.js');
  const specPath = path.join(tmpDir, 'spec.json');
  const runnerPath = path.join(tmpDir, 'runner.js');
  const runNonce = crypto.randomBytes(16).toString('hex');
  const outputPath = path.join(tmpDir, `result_${runNonce}.json`);

  const runnerScript = `'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const specPath = process.argv[2];
const outputPath = process.argv[3];

function writeResult(payload) {
  try {
    fs.writeFileSync(outputPath, JSON.stringify(payload), 'utf8');
  } catch (_) {}
}

try {
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const candidateCode = fs.readFileSync(path.join(__dirname, 'candidate.js'), 'utf8');

  // Create isolated context with null prototype - NO host functions injected!
  const context = vm.createContext(Object.create(null));

  // Initialize environment INSIDE the context so constructors and prototypes belong to context
  vm.runInContext(\`
    'use strict';
    globalThis.console = {
      log: function() {},
      info: function() {},
      warn: function() {},
      error: function() {}
    };

    function ListNode(val, next) {
      this.val = val;
      this.next = next === undefined ? null : next;
    }
    function TreeNode(val, left, right) {
      this.val = val;
      this.left = left === undefined ? null : left;
      this.right = right === undefined ? null : right;
    }
    globalThis.ListNode = ListNode;
    globalThis.TreeNode = TreeNode;
    globalThis.Node = ListNode;
    globalThis.global = globalThis;

    globalThis.__buildLinkedList = function(values, cycleIndex) {
      if (!values || values.length === 0) return null;
      var nodes = values.map(function(v) { return new ListNode(v); });
      for (var i = 0; i < nodes.length - 1; i++) {
        nodes[i].next = nodes[i + 1];
      }
      if (cycleIndex >= 0 && cycleIndex < nodes.length) {
        nodes[nodes.length - 1].next = nodes[cycleIndex];
      }
      return nodes[0];
    };

    globalThis.__buildTree = function(nodeDef) {
      if (!nodeDef || typeof nodeDef !== 'object') return null;
      return new TreeNode(nodeDef.val, __buildTree(nodeDef.left), __buildTree(nodeDef.right));
    };

    // Deep freeze prototypes to prevent constructor crawling and prototype tampering
    Object.freeze(Object.prototype);
    Object.freeze(Function.prototype);
    Object.freeze(Array.prototype);
  \`, context);

  const exportCollector = (spec.names || []).map(function(n) {
    return 'if (typeof ' + n + ' !== "undefined") __aidost_exports["' + n + '"] = ' + n + ';';
  }).join('\\n');
  const wrappedCode = candidateCode + '\\n; const __aidost_exports = {};\\n' + exportCollector + '\\n; __aidost_exports;';

  // Execute candidate code in VM context with strict execution timeout
  const collectedExports = vm.runInContext(wrappedCode, context, { timeout: 3500 });

  function safeClone(val, seen) {
    seen = seen || new WeakSet();
    if (val === null || typeof val !== 'object') return val;
    if (seen.has(val)) return '[Circular]';
    seen.add(val);
    if (Array.isArray(val)) return val.map(function(x) { return safeClone(x, seen); });
    var res = {};
    for (var k of Object.keys(val)) {
      res[k] = safeClone(val[k], seen);
    }
    return res;
  }

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
      writeResult({ runnerStatus: 'TARGET_NOT_FOUND', error: 'Function [' + (spec.names || []).join(', ') + '] not defined by candidate.' });
      process.exit(0);
    }

    for (const testCase of (spec.cases || [])) {
      try {
        let args = testCase.args || [];
        if (testCase.customType === 'linked_list') {
          args = [context.__buildLinkedList(testCase.listValues, testCase.cycleIndex)];
        } else if (testCase.customType === 'tree') {
          args = [context.__buildTree(testCase.treeDef)];
        }
        const res = fn.apply(null, args);
        results.push({ id: testCase.id, status: 'SUCCESS', result: safeClone(res) });
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
      writeResult({ runnerStatus: 'TARGET_NOT_FOUND', error: 'Class [' + (spec.names || []).join(', ') + '] not defined by candidate.' });
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
            results.push({ id: op.id, status: 'SUCCESS', result: safeClone(res) });
          }
        }
      } catch (opErr) {
        results.push({ id: op.id, status: 'ERROR', error: opErr.message });
      }
    }
  }

  writeResult({ runnerStatus: 'EXECUTED', results });
  process.exit(0);
} catch (err) {
  const isSyntax = err.name === 'SyntaxError' || (err.message && err.message.includes('SyntaxError'));
  writeResult({ runnerStatus: isSyntax ? 'SYNTAX_ERROR' : 'RUNNER_EXCEPTION', error: err.message });
  process.exit(0);
}
`;

  try {
    fs.writeFileSync(candidatePath, code, 'utf8');
    fs.writeFileSync(specPath, JSON.stringify(spec), 'utf8');
    fs.writeFileSync(runnerPath, runnerScript, 'utf8');

    const startTime = Date.now();
    const { runRes, isolationInfo } = await dispatchRunnerExecution({
      requireOsIsolation,
      containerAdapter,
      tmpDir,
      runnerPath,
      specPath,
      outputPath,
      runNonce,
      timeoutMs,
      startTime
    });

    let runnerOutput = null;
    if (fs.existsSync(outputPath)) {
      try {
        const rawOutput = fs.readFileSync(outputPath, 'utf8');
        runnerOutput = JSON.parse(rawOutput);
      } catch (_) {
        // Output file was empty, corrupted, or invalid JSON
      }
    }

    return {
      status: runRes.status,
      exitCode: runRes.exitCode,
      stdout: runRes.stdout,
      stderr: runRes.stderr,
      durationMs: runRes.durationMs,
      error: runRes.error,
      runnerOutput,
      isolation: isolationInfo
    };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {
      // Temporary staging directory cleanup failure ignored
    }
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
  checkOsIsolationAvailable,
  _setOsIsolationBackendForTesting,
  ISOLATION_LIMITATION
};
