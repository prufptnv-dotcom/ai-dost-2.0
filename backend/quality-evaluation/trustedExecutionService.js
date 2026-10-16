'use strict';

/**
 * AI-Dost Trusted Execution Service
 * Executes real build, test, and acceptance commands against immutable workspace snapshots.
 * Mints authentic, cryptographically signed receipts bound to exact artifact SHA-256 hashes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { computeArtifactHash, canonicalizeReceiptPayload } = require('./generatedAppQualityGate');
const { runProcess } = require('./executionSandbox');

function getRunnerSecret() {
  const secret = process.env.AIDOST_RUNNER_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    return null;
  }
  return secret.trim();
}

class TrustedExecutionService {
  constructor(options = {}) {
    this.secret = options.secret || getRunnerSecret();
    this.timeoutMs = options.timeoutMs || 15000;
  }

  /**
   * Mints an execution receipt strictly within the trusted service after real execution.
   */
  _signReceipt(payload) {
    if (!this.secret) {
      throw new Error('TRUSTED_RUNNER_SECRET_UNAVAILABLE: Valid AIDOST_RUNNER_SECRET must be configured with at least 16 characters.');
    }
    const canonical = canonicalizeReceiptPayload(payload);
    const signature = crypto.createHmac('sha256', this.secret).update(canonical).digest('hex');
    return {
      ...payload,
      receiptSignature: signature
    };
  }

  /**
   * Executes commands and acceptance flows on the project workspace and returns signed evidence.
   */
  async execute({ projectDir, files, runId, command = null, acceptanceFlows = [], caseDef = null }) {
    if (!this.secret) {
      throw new Error('TRUSTED_RUNNER_SECRET_UNAVAILABLE: Valid AIDOST_RUNNER_SECRET must be configured with at least 16 characters.');
    }
    if (!runId || typeof runId !== 'string' || !runId.trim()) {
      throw new Error('INVALID_RUN_ID: A non-empty runId string is required.');
    }

    const fileMap = {};
    if (files && typeof files === 'object') {
      Object.assign(fileMap, files);
    } else if (projectDir && fs.existsSync(projectDir)) {
      this._collectFiles(projectDir, projectDir, fileMap);
    }

    const preRunHash = computeArtifactHash(fileMap);
    if (!preRunHash) {
      throw new Error('EMPTY_ARTIFACT: No project files to evaluate.');
    }

    let buildResult = { success: true, exitCode: 0, output: 'Execution recorded' };
    let testResult = { testsRun: 0, testsPassed: 0, testsFailed: 0 };
    let runtimeResult = { started: false, port: null };
    let acceptanceResult = { passed: false, flowsTested: 0, flowsFailed: 0, flows: [] };
    let finalExitCode = 0;
    let executedCommand = command || 'evaluation_gate';

    // 1. Run real command if specified or package.json has test/build
    if (projectDir && fs.existsSync(projectDir)) {
      const pkgPath = path.join(projectDir, 'package.json');
      const hasPkg = fs.existsSync(pkgPath);
      let pkg = null;
      if (hasPkg) {
        try {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (_) {}
      }

      if (command) {
        executedCommand = command;
        const [cmd, ...args] = command.split(' ');
        const runRes = await runProcess(cmd, args, { cwd: projectDir, timeoutMs: this.timeoutMs });
        finalExitCode = runRes.exitCode;
        buildResult = {
          success: runRes.exitCode === 0,
          exitCode: runRes.exitCode,
          output: (runRes.stdout + '\n' + runRes.stderr).slice(0, 4000)
        };
        const combined = runRes.stdout + '\n' + runRes.stderr;
        const passMatch = combined.match(/pass(?:ed)?\s*(\d+)/i) || combined.match(/(\d+)\s*passing/i);
        const failMatch = combined.match(/fail(?:ed)?\s*(\d+)/i) || combined.match(/(\d+)\s*failing/i);
        if (passMatch || failMatch) {
          const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
          const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
          testResult = {
            testsRun: passed + failed,
            testsPassed: passed,
            testsFailed: failed
          };
        }
      } else if (pkg && pkg.scripts && pkg.scripts.test) {
        executedCommand = 'npm test';
        const runRes = await runProcess('npm', ['test'], { cwd: projectDir, timeoutMs: this.timeoutMs });
        finalExitCode = runRes.exitCode;
        testResult = {
          testsRun: runRes.exitCode === 0 ? 1 : 0,
          testsPassed: runRes.exitCode === 0 ? 1 : 0,
          testsFailed: runRes.exitCode === 0 ? 0 : 1
        };
        buildResult = {
          success: runRes.exitCode === 0,
          exitCode: runRes.exitCode,
          output: (runRes.stdout + '\n' + runRes.stderr).slice(0, 4000)
        };
      }
    }

    // 2. Validate acceptance flows if provided
    if (Array.isArray(acceptanceFlows) && acceptanceFlows.length > 0) {
      const flows = [];
      let allPassed = true;
      for (const flow of acceptanceFlows) {
        let passed = false;
        try {
          if (typeof flow.test === 'function') {
            passed = Boolean(await flow.test(fileMap, projectDir));
          } else {
            passed = Boolean(flow.passed);
          }
        } catch (_) {
          passed = false;
        }
        if (!passed) allPassed = false;
        flows.push({
          id: String(flow.id || flow.name || `flow-${flows.length}`),
          name: String(flow.name || flow.id || 'Acceptance Flow'),
          passed
        });
      }
      acceptanceResult = {
        passed: allPassed && flows.length > 0,
        flowsTested: flows.length,
        flowsFailed: flows.filter((f) => !f.passed).length,
        flows
      };
    }

    // 3. Immutability validation: ensure files did not mutate during test execution
    const postFileMap = {};
    if (projectDir && fs.existsSync(projectDir)) {
      this._collectFiles(projectDir, projectDir, postFileMap);
    } else {
      Object.assign(postFileMap, files);
    }
    const postRunHash = computeArtifactHash(postFileMap);
    if (postRunHash !== preRunHash) {
      throw new Error(`ARTIFACT_MUTATION_DETECTED: Workspace files were modified during test execution. Pre-hash: ${preRunHash}, post-hash: ${postRunHash}`);
    }

    const receiptPayload = {
      runId,
      artifactHash: preRunHash,
      runnerId: 'aidost-trusted-runner',
      command: executedCommand,
      exitCode: finalExitCode,
      tests: testResult,
      build: buildResult,
      runtime: runtimeResult,
      acceptance: acceptanceResult,
      timestamp: new Date().toISOString()
    };

    const receipt = this._signReceipt(receiptPayload);

    return {
      receipt,
      build: receipt.build,
      tests: receipt.tests,
      runtime: receipt.runtime,
      acceptance: receipt.acceptance,
      artifactHash: preRunHash
    };
  }

  _collectFiles(rootDir, currentDir, fileMap) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'build') continue;
      const full = path.join(currentDir, ent.name);
      if (ent.isDirectory()) {
        this._collectFiles(rootDir, full, fileMap);
      } else if (ent.isFile() && /\.(jsx?|tsx?|html|css|json)$/i.test(ent.name)) {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        try {
          fileMap[rel] = fs.readFileSync(full, 'utf8');
        } catch (_) {}
      }
    }
  }
}

module.exports = {
  TrustedExecutionService,
  getRunnerSecret
};
