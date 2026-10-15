'use strict';

/**
 * Isolated Subprocess Execution Sandbox for Quality Evaluation
 * Provides resource-bounded execution for Python and Node.js solutions.
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
    let killed = false;

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
      killed = true;
      child.kill('SIGKILL');
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

      const durationMs = options.startTime ? Date.now() - options.startTime : 0;
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
    return await runProcess('node', ['--no-addons', scriptPath], { cwd: tmpDir, timeoutMs, startTime });
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
  executeNodeScript,
  executePythonScript
};
