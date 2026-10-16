'use strict';

/**
 * AI-Dost Trusted Execution Service
 * Executes real build, test, and acceptance commands against immutable workspace snapshots.
 * Mints authentic, cryptographically signed receipts bound to exact artifact SHA-256 hashes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  collectCanonicalWorkspaceFiles,
  computeArtifactHash,
  canonicalizeReceiptPayload
} = require('./generatedAppQualityGate');
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
  async execute({
    projectDir,
    files,
    runId,
    command = null,
    buildCommand = null,
    testCommand = null,
    acceptanceFlows = [],
    caseDef = null
  }) {
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
      collectCanonicalWorkspaceFiles(projectDir, projectDir, fileMap);
    }

    const preRunHash = computeArtifactHash(fileMap);
    if (!preRunHash) {
      throw new Error('EMPTY_ARTIFACT: No project files to evaluate.');
    }

    // Strict default: build is NOT passed until an actual build executes with exit code 0
    let buildResult = {
      executed: false,
      success: false,
      exitCode: null,
      output: 'No build command executed'
    };
    let testResult = {
      executed: false,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0
    };
    let runtimeResult = { started: false, port: null };
    let acceptanceResult = { passed: false, flowsTested: 0, flowsFailed: 0, flows: [] };
    let finalExitCode = 0;
    let executedCommand = command || 'evaluation_gate';

    if (projectDir && fs.existsSync(projectDir)) {
      const pkgPath = path.join(projectDir, 'package.json');
      const hasPkg = fs.existsSync(pkgPath);
      let pkg = null;
      if (hasPkg) {
        try {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (_) {}
      }

      // 1. Execute Build command if requested or package has build script
      const effectiveBuildCmd = buildCommand || (pkg?.scripts?.build ? 'npm run build' : null);
      if (effectiveBuildCmd) {
        executedCommand = effectiveBuildCmd;
        const [bCmd, ...bArgs] = effectiveBuildCmd.split(' ');
        const buildRun = await runProcess(bCmd, bArgs, { cwd: projectDir, timeoutMs: this.timeoutMs });
        finalExitCode = buildRun.exitCode;
        buildResult = {
          executed: true,
          success: buildRun.exitCode === 0,
          exitCode: buildRun.exitCode,
          output: (buildRun.stdout + '\n' + buildRun.stderr).slice(0, 4000)
        };
      }

      // 2. Execute Test command if requested or package has test script (distinct from build!)
      const effectiveTestCmd = testCommand || command || (pkg?.scripts?.test ? 'npm test' : null);
      if (effectiveTestCmd && effectiveTestCmd !== effectiveBuildCmd) {
        executedCommand = executedCommand ? `${executedCommand}; ${effectiveTestCmd}` : effectiveTestCmd;
        const [tCmd, ...tArgs] = effectiveTestCmd.split(' ');
        const testRun = await runProcess(tCmd, tArgs, { cwd: projectDir, timeoutMs: this.timeoutMs });
        if (testRun.exitCode !== 0) {
          finalExitCode = testRun.exitCode;
        }

        const combined = testRun.stdout + '\n' + testRun.stderr;
        const tapTotalMatch = combined.match(/#\s*tests\s+(\d+)/i);
        const tapPassMatch = combined.match(/#\s*pass\s+(\d+)/i);
        const tapFailMatch = combined.match(/#\s*fail\s+(\d+)/i);

        if (tapTotalMatch) {
          const total = parseInt(tapTotalMatch[1], 10);
          const passed = tapPassMatch ? parseInt(tapPassMatch[1], 10) : (testRun.exitCode === 0 ? total : 0);
          const failed = tapFailMatch ? parseInt(tapFailMatch[1], 10) : (total - passed);
          testResult = {
            executed: true,
            testsRun: total,
            testsPassed: passed,
            testsFailed: failed
          };
        } else {
          // Fallback based on test command exit code (never inventing fake counts)
          const passed = testRun.exitCode === 0 ? 1 : 0;
          const failed = testRun.exitCode === 0 ? 0 : 1;
          testResult = {
            executed: true,
            testsRun: passed + failed,
            testsPassed: passed,
            testsFailed: failed
          };
        }
      }
    }

    // 3. Validate acceptance flows with mandatory executable verification
    if (Array.isArray(acceptanceFlows) && acceptanceFlows.length > 0) {
      const flows = [];
      let allPassed = true;
      for (const flow of acceptanceFlows) {
        let passed = false;
        let flowError = null;
        try {
          if (typeof flow.test === 'function') {
            passed = Boolean(await flow.test(fileMap, projectDir));
          } else if (typeof flow.run === 'function') {
            passed = Boolean(await flow.run(fileMap, projectDir));
          } else {
            // Rejection of fabricated/static caller booleans without executable code
            passed = false;
            flowError = 'STATIC_ASSERTION_REJECTED: Acceptance flow lacked executable test function or runner';
          }
        } catch (err) {
          passed = false;
          flowError = err.message;
        }
        if (!passed) allPassed = false;
        flows.push({
          id: String(flow.id || flow.name || `flow-${flows.length}`),
          name: String(flow.name || flow.id || 'Acceptance Flow'),
          passed,
          error: flowError || undefined
        });
      }
      acceptanceResult = {
        passed: allPassed && flows.length > 0,
        flowsTested: flows.length,
        flowsFailed: flows.filter((f) => !f.passed).length,
        flows
      };
    }

    // 4. Immutability validation: ensure files did not mutate during test execution
    const postFileMap = {};
    if (projectDir && fs.existsSync(projectDir)) {
      collectCanonicalWorkspaceFiles(projectDir, projectDir, postFileMap);
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
}

module.exports = {
  TrustedExecutionService,
  getRunnerSecret
};
