'use strict';

/**
 * AI-Dost Trusted Execution Service
 * Stages exact workspace snapshots into an isolated container runtime.
 * Executes build and test commands with strict isolation, verifies post-execution
 * immutability, evaluates executable acceptance flows, and mints signed evidence receipts.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  createWorkspaceSnapshot,
  stageWorkspaceSnapshot,
  verifyWorkspaceImmutability
} = require('./workspaceManifest');
const { canonicalizeReceiptPayload } = require('./generatedAppQualityGate');
const { ContainerExecutionAdapter } = require('./containerExecutionAdapter');
const { getAcceptanceFlows } = require('./canonicalAcceptanceFlows');

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
    this.strictIsolation = options.strictIsolation ?? false;
    this.adapter = options.adapter || new ContainerExecutionAdapter({
      timeoutMs: this.timeoutMs,
      strictIsolation: this.strictIsolation
    });
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
    caseId = null,
    caseDef = null
  }) {
    if (!this.secret) {
      throw new Error('TRUSTED_RUNNER_SECRET_UNAVAILABLE: Valid AIDOST_RUNNER_SECRET must be configured with at least 16 characters.');
    }
    if (!runId || typeof runId !== 'string' || !runId.trim()) {
      throw new Error('INVALID_RUN_ID: A non-empty runId string is required.');
    }

    // 1. Create authoritative workspace snapshot (enforcing size & manifest limits)
    const source = files || projectDir;
    const snapshot = createWorkspaceSnapshot(source);
    if (!snapshot || snapshot.fileCount === 0) {
      throw new Error('EMPTY_ARTIFACT: No project files to evaluate.');
    }
    const preRunHash = snapshot.hash;

    // 2. Stage snapshot into an isolated temporary workspace directory
    const runNonce = crypto.randomBytes(8).toString('hex');
    const stagedDir = path.join(os.tmpdir(), `aidost-exec-${runNonce}`);
    stageWorkspaceSnapshot(snapshot, stagedDir);

    let buildResult = {
      status: 'NOT_REQUIRED',
      executed: false,
      success: false,
      exitCode: null,
      output: 'No build required for this project'
    };

    let testResult = {
      executed: false,
      commandPassed: false,
      countsMeasured: false,
      testsRun: null,
      testsPassed: null,
      testsFailed: null
    };

    let runtimeResult = { started: false, port: null };
    let acceptanceResult = { passed: false, flowsTested: 0, flowsFailed: 0, flows: [] };
    let finalExitCode = 0;
    let executedCommand = command || 'evaluation_gate';

    try {
      const pkgPath = path.join(stagedDir, 'package.json');
      let pkg = null;
      if (fs.existsSync(pkgPath)) {
        try {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (_) {}
      }

      // ── Build Execution ──
      const requiresBuild = Boolean(buildCommand || pkg?.scripts?.build);
      if (requiresBuild) {
        const bCmd = buildCommand || 'npm run build';
        executedCommand = bCmd;
        buildResult.executed = true;

        if (this.strictIsolation && !this.adapter.isAvailable()) {
          throw new Error('SANDBOX_UNAVAILABLE: OS container isolation required for build execution but unavailable.');
        }

        const buildRun = await this.adapter.execute({
          stagedDir,
          command: bCmd.split(' ')[0],
          args: bCmd.split(' ').slice(1),
          timeoutMs: this.timeoutMs
        });

        if (buildRun.status === 'SANDBOX_UNAVAILABLE') {
          throw new Error('SANDBOX_UNAVAILABLE: OS container isolation is required but unavailable.');
        }

        finalExitCode = buildRun.exitCode;
        const passed = buildRun.exitCode === 0;
        buildResult = {
          status: passed ? 'PASSED' : 'FAILED',
          executed: true,
          success: passed,
          exitCode: buildRun.exitCode,
          output: (buildRun.stdout + '\n' + buildRun.stderr).slice(0, 4000)
        };
      }

      // ── Test Execution (Separated from Build!) ──
      const effectiveTestCmd = testCommand || (pkg?.scripts?.test ? 'npm test' : null);
      if (effectiveTestCmd) {
        executedCommand = executedCommand !== 'evaluation_gate' ? `${executedCommand}; ${effectiveTestCmd}` : effectiveTestCmd;
        testResult.executed = true;

        if (this.strictIsolation && !this.adapter.isAvailable()) {
          throw new Error('SANDBOX_UNAVAILABLE: OS container isolation required for test execution but unavailable.');
        }

        const testRun = await this.adapter.execute({
          stagedDir,
          command: effectiveTestCmd.split(' ')[0],
          args: effectiveTestCmd.split(' ').slice(1),
          timeoutMs: this.timeoutMs
        });

        if (testRun.status === 'SANDBOX_UNAVAILABLE') {
          throw new Error('SANDBOX_UNAVAILABLE: OS container isolation is required but unavailable.');
        }

        if (testRun.exitCode !== 0) {
          finalExitCode = testRun.exitCode;
        }

        testResult.commandPassed = testRun.exitCode === 0;

        // Parse structured machine-readable test output (TAP / spec / summary)
        const combined = testRun.stdout + '\n' + testRun.stderr;
        const tapTotalMatch = combined.match(/#\s*tests\s+(\d+)/i);
        const tapPassMatch = combined.match(/#\s*pass\s+(\d+)/i);
        const tapFailMatch = combined.match(/#\s*fail\s+(\d+)/i);

        if (tapTotalMatch) {
          const total = parseInt(tapTotalMatch[1], 10);
          const passed = tapPassMatch ? parseInt(tapPassMatch[1], 10) : (testRun.exitCode === 0 ? total : 0);
          const failed = tapFailMatch ? parseInt(tapFailMatch[1], 10) : (total - passed);
          testResult.countsMeasured = true;
          testResult.testsRun = total;
          testResult.testsPassed = passed;
          testResult.testsFailed = failed;
        } else {
          // Do NOT fabricate test counts from exit code zero!
          testResult.countsMeasured = false;
          testResult.testsRun = null;
          testResult.testsPassed = null;
          testResult.testsFailed = testRun.exitCode === 0 ? null : 1;
        }
      }

      // ── Executable Acceptance Flows ──
      const flowsToRun = Array.isArray(acceptanceFlows) && acceptanceFlows.length > 0
        ? acceptanceFlows
        : (caseId ? getAcceptanceFlows(caseId) : []);

      if (Array.isArray(flowsToRun) && flowsToRun.length > 0) {
        const flows = [];
        let allPassed = true;
        for (const flow of flowsToRun) {
          let passed = false;
          let flowError = null;
          try {
            if (typeof flow.test === 'function') {
              passed = Boolean(await flow.test(snapshot.files, stagedDir));
            } else if (typeof flow.run === 'function') {
              passed = Boolean(await flow.run(snapshot.files, stagedDir));
            } else {
              // Strict rejection of caller-supplied booleans without an executable function
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

      // ── Immutability Validation ──
      verifyWorkspaceImmutability(snapshot, stagedDir);

    } finally {
      // Clean up staged workspace directory
      try {
        fs.rmSync(stagedDir, { recursive: true, force: true });
      } catch (_) {}
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
