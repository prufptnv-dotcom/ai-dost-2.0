'use strict';

/**
 * AI-Dost Trusted Execution Service
 * Stages exact workspace snapshots into an isolated container runtime.
 * Executes build and test commands with strict isolation, verifies post-execution
 * immutability, evaluates executable acceptance flows, and mints signed evidence receipts.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
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

function parseTapOutput(combined, testRun, testResult) {
  const tapTotalMatch = /#\s*tests\s+(\d+)/i.exec(combined);
  const tapPassMatch = /#\s*pass\s+(\d+)/i.exec(combined);
  const tapFailMatch = /#\s*fail\s+(\d+)/i.exec(combined);

  if (!tapTotalMatch) {
    testResult.countsMeasured = false;
    testResult.testsRun = null;
    testResult.testsPassed = null;
    testResult.testsFailed = testRun.exitCode === 0 ? null : 1;
    return;
  }

  const total = Number.parseInt(tapTotalMatch[1], 10);
  const hasPass = Boolean(tapPassMatch);
  const hasFail = Boolean(tapFailMatch);

  if (!hasPass && !hasFail) {
    testResult.countsMeasured = false;
    testResult.testsRun = null;
    testResult.testsPassed = null;
    testResult.testsFailed = testRun.exitCode === 0 ? null : 1;
    testResult.malformed = 'TAP_INCOMPLETE_MISSING_PASS_AND_FAIL_COUNTS';
    return;
  }

  let passed = null;
  if (hasPass) {
    passed = Number.parseInt(tapPassMatch[1], 10);
  } else if (hasFail && testRun.exitCode !== 0) {
    passed = total - Number.parseInt(tapFailMatch[1], 10);
  }

  let failed = null;
  if (hasFail) {
    failed = Number.parseInt(tapFailMatch[1], 10);
  } else if (hasPass && passed === total) {
    failed = 0;
  }

  if (passed === null || failed === null) {
    testResult.countsMeasured = false;
    testResult.testsRun = null;
    testResult.testsPassed = null;
    testResult.testsFailed = testRun.exitCode === 0 ? null : 1;
    testResult.malformed = 'TAP_INCOMPLETE_INDETERMINATE_COUNTS';
    return;
  }

  const skippedMatch = /#\s*skip(?:ped)?\s+(\d+)/i.exec(combined);
  const todoMatch = /#\s*todo\s+(\d+)/i.exec(combined);
  const cancelledMatch = /#\s*cancelled\s+(\d+)/i.exec(combined);
  const skipped = skippedMatch ? Number.parseInt(skippedMatch[1], 10) : 0;
  const todo = todoMatch ? Number.parseInt(todoMatch[1], 10) : 0;
  const cancelled = cancelledMatch ? Number.parseInt(cancelledMatch[1], 10) : 0;

  const accounted = passed + failed + skipped + todo + cancelled;
  if (accounted !== total) {
    testResult.countsMeasured = false;
    testResult.testsRun = null;
    testResult.testsPassed = null;
    testResult.testsFailed = testRun.exitCode === 0 ? null : 1;
    testResult.malformed = `TAP_CONTRADICTORY_COUNTS: total (${total}) !== accounted (${accounted})`;
  } else {
    testResult.countsMeasured = true;
    testResult.testsRun = total;
    testResult.testsPassed = passed;
    testResult.testsFailed = failed;
    testResult.testsSkipped = skipped;
  }
}

async function executeSingleAcceptanceFlow(flow, files, stagedDir) {
  try {
    const fn = typeof flow.test === 'function' ? flow.test : (typeof flow.run === 'function' ? flow.run : null);
    if (!fn) {
      return {
        passed: false,
        flowError: 'STATIC_ASSERTION_REJECTED: Acceptance flow lacked executable test function or runner'
      };
    }
    const flowRes = await fn(files, stagedDir);
    const passed = typeof flowRes === 'object' && flowRes !== null ? Boolean(flowRes.passed) : Boolean(flowRes);
    const flowError = typeof flowRes === 'object' && flowRes?.error ? flowRes.error : null;
    return { passed, flowError };
  } catch (err) {
    return { passed: false, flowError: err.message };
  }
}

async function executeAcceptanceFlowsStep({ acceptanceFlows, caseId, snapshot, stagedDir }) {
  let flowsToRun = [];
  if (Array.isArray(acceptanceFlows) && acceptanceFlows.length > 0) {
    flowsToRun = acceptanceFlows;
  } else if (caseId) {
    flowsToRun = getAcceptanceFlows(caseId);
  }

  if (!Array.isArray(flowsToRun) || flowsToRun.length === 0) {
    return { passed: false, flowsTested: 0, flowsFailed: 0, flows: [] };
  }

  const flows = [];
  let allPassed = true;
  for (const flow of flowsToRun) {
    const { passed, flowError } = await executeSingleAcceptanceFlow(flow, snapshot.files, stagedDir);
    if (!passed) allPassed = false;
    flows.push({
      id: String(flow.id || flow.name || `flow-${flows.length}`),
      name: String(flow.name || flow.id || 'Acceptance Flow'),
      passed,
      error: flowError || undefined
    });
  }

  const flowsFailed = flows.filter((f) => !f.passed).length;
  return {
    passed: allPassed && flows.length > 0,
    flowsTested: flows.length,
    flowsFailed,
    flows
  };
}

async function executeBuildStep({ buildCommand, pkg, strictIsolation, effectiveAdapter, stagedDir, timeoutMs }) {
  const requiresBuild = Boolean(buildCommand || pkg?.scripts?.build);
  if (!requiresBuild) {
    return {
      executed: false,
      buildResult: {
        status: 'NOT_REQUIRED',
        executed: false,
        success: false,
        exitCode: null,
        output: 'No build required for this project'
      },
      exitCode: 0,
      command: null
    };
  }

  const bCmd = buildCommand || 'npm run build';
  if (strictIsolation && !effectiveAdapter.isAvailable()) {
    throw new Error('SANDBOX_UNAVAILABLE: OS container isolation required for build execution but unavailable.');
  }

  const buildRun = await effectiveAdapter.execute({
    stagedDir,
    command: bCmd.split(' ')[0],
    args: bCmd.split(' ').slice(1),
    timeoutMs
  });

  if (buildRun.status === 'SANDBOX_UNAVAILABLE') {
    throw new Error('SANDBOX_UNAVAILABLE: OS container isolation is required but unavailable.');
  }

  const passed = buildRun.exitCode === 0;
  return {
    executed: true,
    buildResult: {
      status: passed ? 'PASSED' : 'FAILED',
      executed: true,
      success: passed,
      exitCode: buildRun.exitCode,
      output: (buildRun.stdout + '\n' + buildRun.stderr).slice(0, 4000)
    },
    exitCode: buildRun.exitCode,
    command: bCmd
  };
}

async function executeTestStep({ testCommand, pkg, strictIsolation, effectiveAdapter, stagedDir, timeoutMs }) {
  const effectiveTestCmd = testCommand || (pkg?.scripts?.test ? 'npm test' : null);
  if (!effectiveTestCmd) {
    return {
      executed: false,
      testResult: {
        executed: false,
        commandPassed: false,
        countsMeasured: false,
        testsRun: null,
        testsPassed: null,
        testsFailed: null
      },
      exitCode: 0,
      command: null
    };
  }

  if (strictIsolation && !effectiveAdapter.isAvailable()) {
    throw new Error('SANDBOX_UNAVAILABLE: OS container isolation required for test execution but unavailable.');
  }

  const testRun = await effectiveAdapter.execute({
    stagedDir,
    command: effectiveTestCmd.split(' ')[0],
    args: effectiveTestCmd.split(' ').slice(1),
    timeoutMs
  });

  if (testRun.status === 'SANDBOX_UNAVAILABLE') {
    throw new Error('SANDBOX_UNAVAILABLE: OS container isolation is required but unavailable.');
  }

  const testResult = {
    executed: true,
    commandPassed: testRun.exitCode === 0,
    countsMeasured: false,
    testsRun: null,
    testsPassed: null,
    testsFailed: null
  };

  const combined = testRun.stdout + '\n' + testRun.stderr;
  parseTapOutput(combined, testRun, testResult);

  return {
    executed: true,
    testResult,
    exitCode: testRun.exitCode,
    command: effectiveTestCmd
  };
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
    caseDef = null,
    adapter = null
  }) {
    if (!this.secret) {
      throw new Error('TRUSTED_RUNNER_SECRET_UNAVAILABLE: Valid AIDOST_RUNNER_SECRET must be configured with at least 16 characters.');
    }
    if (!runId || typeof runId !== 'string' || !runId.trim()) {
      throw new Error('INVALID_RUN_ID: A non-empty runId string is required.');
    }

    const effectiveAdapter = adapter || this.adapter;

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

    const runtimeResult = { started: false, port: null };
    let acceptanceResult = { passed: false, flowsTested: 0, flowsFailed: 0, flows: [] };
    let finalExitCode = 0;
    let executedCommand = command || 'evaluation_gate';

    try {
      const pkgPath = path.join(stagedDir, 'package.json');
      let pkg = null;
      if (fs.existsSync(pkgPath)) {
        try {
          pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        } catch (_) {
          // Ignore invalid package.json in staged workspace
        }
      }

      // ── Build Execution ──
      const buildStep = await executeBuildStep({
        buildCommand,
        pkg,
        strictIsolation: this.strictIsolation,
        effectiveAdapter,
        stagedDir,
        timeoutMs: this.timeoutMs
      });
      if (buildStep.executed) {
        executedCommand = buildStep.command;
        buildResult = buildStep.buildResult;
        if (buildStep.exitCode !== 0) finalExitCode = buildStep.exitCode;
      }

      // ── Test Execution ──
      const testStep = await executeTestStep({
        testCommand,
        pkg,
        strictIsolation: this.strictIsolation,
        effectiveAdapter,
        stagedDir,
        timeoutMs: this.timeoutMs
      });
      if (testStep.executed) {
        executedCommand = executedCommand !== 'evaluation_gate' ? `${executedCommand}; ${testStep.command}` : testStep.command;
        testResult = testStep.testResult;
        if (testStep.exitCode !== 0) finalExitCode = testStep.exitCode;
      }

      // ── Executable Acceptance Flows ──
      acceptanceResult = await executeAcceptanceFlowsStep({
        acceptanceFlows,
        caseId,
        snapshot,
        stagedDir
      });

      // ── Immutability Validation ──
      verifyWorkspaceImmutability(snapshot, stagedDir);

    } finally {
      // Clean up staged workspace directory
      try {
        fs.rmSync(stagedDir, { recursive: true, force: true });
      } catch (_) {
        // Staged workspace directory cleanup failure ignored
      }
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
