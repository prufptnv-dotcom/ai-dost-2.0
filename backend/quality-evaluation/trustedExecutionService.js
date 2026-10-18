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

function validateRegistryUrl(rawUrl, label) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch (_) {
    throw new Error('UNTRUSTED_DEPENDENCY_SOURCE: Invalid URL in ' + label);
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'registry.npmjs.org') {
    throw new Error('UNTRUSTED_DEPENDENCY_SOURCE: ' + label + ' must resolve through https://registry.npmjs.org.');
  }
}

function inspectLockfileResolvedUrls(node, label = 'package-lock.json') {
  if (!node || typeof node !== 'object') return;
  if (typeof node.resolved === 'string') {
    if (!/^https?:\/\//i.test(node.resolved)) {
      throw new Error('UNTRUSTED_DEPENDENCY_SOURCE: Unsupported resolved URL scheme in ' + label);
    }
    validateRegistryUrl(node.resolved, label + ' resolved URL');
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') inspectLockfileResolvedUrls(value, label);
  }
}

function getNpmDependencyInstallPlan(stagedDir, pkg) {
  const dependencies = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.optionalDependencies || {})
  };
  if (Object.keys(dependencies).length === 0) {
    return { needed: false, command: null, args: [], reason: 'NO_DECLARED_DEPENDENCIES' };
  }

  for (const configFile of ['.npmrc', '.yarnrc', '.yarnrc.yml']) {
    if (fs.existsSync(path.join(stagedDir, configFile))) {
      throw new Error('UNTRUSTED_DEPENDENCY_SOURCE: Custom package-manager configuration is not allowed: ' + configFile);
    }
  }
  for (const lockFile of ['yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb']) {
    if (fs.existsSync(path.join(stagedDir, lockFile))) {
      throw new Error('UNSUPPORTED_PACKAGE_MANAGER: npm verifier cannot install a project that declares ' + lockFile);
    }
  }

  for (const [name, rawSpec] of Object.entries(dependencies)) {
    const spec = String(rawSpec || '').trim();
    if (!spec) throw new Error('INVALID_DEPENDENCY_SPEC: Empty version spec for ' + name);
    if (/^(git\+|git:|github:|file:|link:|workspace:|portal:|patch:)/i.test(spec)) {
      throw new Error('UNTRUSTED_DEPENDENCY_SOURCE: Non-registry dependency spec rejected for ' + name);
    }
    if (/^https?:\/\//i.test(spec)) {
      validateRegistryUrl(spec, 'dependency spec for ' + name);
      continue;
    }
    if (!/^(?:npm:|[~^<>=*v\d|])/.test(spec) &&
        !['latest', 'next', 'canary', 'beta', 'stable'].includes(spec.toLowerCase())) {
      throw new Error('UNTRUSTED_DEPENDENCY_SOURCE: Unsupported dependency spec for ' + name);
    }
  }

  const lockPath = path.join(stagedDir, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    let lock;
    try { lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')); }
    catch (_) { throw new Error('INVALID_NPM_LOCKFILE: package-lock.json is not valid JSON.'); }
    inspectLockfileResolvedUrls(lock);
    return { needed: true, command: 'npm', args: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], reason: 'LOCKFILE_PRESENT' };
  }
  return {
    needed: true,
    command: 'npm',
    args: ['install', '--ignore-scripts', '--package-lock=false', '--no-audit', '--no-fund'],
    reason: 'LOCKFILE_ABSENT'
  };
}

async function installNpmDependencies({
  stagedDir,
  pkg,
  adapter,
  allowNetworkedDependencyInstall,
  timeoutMs
}) {
  const dependencyCount = Object.keys({
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.optionalDependencies || {})
  }).length;
  if (!Boolean(pkg?.scripts?.build || pkg?.scripts?.test) || dependencyCount === 0) {
    return { needed: false, attempted: false, success: true, status: 'NOT_REQUIRED', command: null, args: [], exitCode: null, output: 'No dependency bootstrap required.' };
  }
  if (!allowNetworkedDependencyInstall) {
    return {
      needed: true, attempted: false, success: false, status: 'BLOCKED', command: null, args: [], exitCode: null,
      output: 'NETWORKED_DEPENDENCY_INSTALL_DISABLED: Set AIDOST_ALLOW_NETWORKED_DEP_INSTALL=true on the trusted backend to allow registry-only npm install in an isolated container. No install was attempted.'
    };
  }

  let plan;
  try { plan = getNpmDependencyInstallPlan(stagedDir, pkg); }
  catch (error) {
    return { needed: true, attempted: false, success: false, status: 'REJECTED', command: null, args: [], exitCode: null, output: error.message };
  }
  if (!plan.needed) {
    return { needed: false, attempted: false, success: true, status: 'NOT_REQUIRED', command: null, args: [], exitCode: null, output: plan.reason };
  }

  try {
    const result = await adapter.execute({
      stagedDir,
      command: plan.command,
      args: plan.args,
      timeoutMs,
      network: 'bridge',
      readOnly: false,
      memoryLimit: '512m',
      cpus: '1',
      pidsLimit: '128'
    });
    const success = result.exitCode === 0 && result.status !== 'SANDBOX_UNAVAILABLE';
    return {
      needed: true, attempted: true, success, status: success ? 'PASSED' : 'FAILED',
      command: plan.command, args: plan.args, exitCode: result.exitCode,
      output: (String(result.stdout || '') + '\n' + String(result.stderr || '')).slice(0, 2500)
    };
  } catch (error) {
    return {
      needed: true, attempted: true, success: false, status: 'FAILED',
      command: plan.command, args: plan.args, exitCode: null,
      output: String(error?.message || error).slice(0, 2500)
    };
  }
}

class TrustedExecutionService {
  constructor(options = {}) {
    this.secret = options.secret || getRunnerSecret();
    const configuredTimeout = Number(options.timeoutMs ?? process.env.AIDOST_TRUSTED_EXECUTION_TIMEOUT_MS ?? 120000);
    this.timeoutMs = Number.isInteger(configuredTimeout) && configuredTimeout >= 1000
      ? Math.min(configuredTimeout, 600000)
      : 120000;
    this.strictIsolation = options.strictIsolation ?? false;
    const networkedInstallSetting = options.allowNetworkedDependencyInstall ?? process.env.AIDOST_ALLOW_NETWORKED_DEP_INSTALL;
    this.allowNetworkedDependencyInstall = networkedInstallSetting === true ||
      String(networkedInstallSetting || '').trim().toLowerCase() === 'true';
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

      // ── Dependency Bootstrap (explicit opt-in; lifecycle scripts are disabled) ──
      const dependencyInstall = await installNpmDependencies({
        stagedDir,
        pkg,
        adapter: effectiveAdapter,
        allowNetworkedDependencyInstall: this.allowNetworkedDependencyInstall,
        timeoutMs: Math.max(this.timeoutMs, 180000)
      });
      const skipBuildAndTest = dependencyInstall.needed && !dependencyInstall.success;
      if (dependencyInstall.attempted && dependencyInstall.success) {
        const installCommand = dependencyInstall.command + ' ' + dependencyInstall.args.join(' ');
        executedCommand = executedCommand !== 'evaluation_gate' ? executedCommand + '; ' + installCommand : installCommand;
      }
      if (skipBuildAndTest) {
        const setupFailure = String(dependencyInstall.output || ('Dependency install status: ' + dependencyInstall.status));
        if (buildCommand || pkg?.scripts?.build) {
          buildResult = { status: 'FAILED', executed: false, success: false, exitCode: 1, output: setupFailure };
        }
        if (testCommand || pkg?.scripts?.test) {
          testResult = {
            executed: false, commandPassed: false, countsMeasured: false,
            testsRun: null, testsPassed: null, testsFailed: null
          };
        }
        finalExitCode = dependencyInstall.exitCode || 1;
      }

      if (!skipBuildAndTest) {
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
          executedCommand = executedCommand !== 'evaluation_gate' ? executedCommand + '; ' + buildStep.command : buildStep.command;
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
          executedCommand = executedCommand !== 'evaluation_gate' ? executedCommand + '; ' + testStep.command : testStep.command;
          testResult = testStep.testResult;
          if (testStep.exitCode !== 0) finalExitCode = testStep.exitCode;
        }
      }      // ── Executable Acceptance Flows ──
      acceptanceResult = await executeAcceptanceFlowsStep({
        acceptanceFlows,
        caseId,
        snapshot,
        stagedDir
      });

      // Include dependency setup provenance in the HMAC-signed build payload.
      if (dependencyInstall.status !== 'NOT_REQUIRED') {
        const installSummary = 'DEPENDENCY_INSTALL_STATUS=' + dependencyInstall.status +
          '; command=' + (dependencyInstall.command ? dependencyInstall.command + ' ' + dependencyInstall.args.join(' ') : 'none') +
          '; exitCode=' + (dependencyInstall.exitCode == null ? 'n/a' : dependencyInstall.exitCode) +
          '\n' + String(dependencyInstall.output || '');
        buildResult.output = (installSummary + '\n' + String(buildResult.output || '')).slice(0, 4000);
      }

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
  getRunnerSecret,
  getNpmDependencyInstallPlan,
  installNpmDependencies
};
