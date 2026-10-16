'use strict';

/**
 * AI-Dost Generated-Application Quality Evaluation Gate
 * Replaces misleading static claims with multi-layered, execution-backed evidence.
 *
 * Strict Principles:
 * 1. Static source analysis produces a diagnostic result, NEVER a claim of runtime verification.
 * 2. Real execution evidence MUST be bound to the exact artifact SHA-256 hash and run ID.
 * 3. Caller-supplied booleans or self-reported result objects without trusted runner receipts are rejected.
 * 4. For complex applications, a successful build alone is not sufficient without verified acceptance flows.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUS = {
  VERIFIED_PASS: 'VERIFIED_PASS',
  STATIC_DIAGNOSTIC_PASS: 'STATIC_DIAGNOSTIC_PASS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  UNVERIFIED: 'UNVERIFIED',
  NOT_EVALUATED: 'NOT_EVALUATED'
};

const TRUSTED_RUNNER_SECRET = process.env.AIDOST_RUNNER_SECRET || 'aidost-trusted-runner-internal-2026';

/**
 * Computes canonical SHA-256 artifact hash across all evaluated project files.
 */
function computeArtifactHash(fileMap = {}) {
  if (!fileMap || typeof fileMap !== 'object') return '';
  const sortedKeys = Object.keys(fileMap).sort();
  const hash = crypto.createHash('sha256');
  for (const key of sortedKeys) {
    const content = typeof fileMap[key] === 'string' ? fileMap[key] : '';
    const fileHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    hash.update(`${key}:${fileHash}\n`);
  }
  return hash.digest('hex');
}

/**
 * Mints an authentic server-side execution receipt signed by a trusted test runner.
 */
function mintExecutionReceipt({
  runId,
  artifactHash,
  runnerId = 'aidost-trusted-runner',
  command = 'npm test',
  exitCode = 0,
  tests = { testsRun: 0, testsPassed: 0, testsFailed: 0 },
  build = { success: true, exitCode: 0, output: '' },
  runtime = { started: false, port: null },
  acceptance = { passed: false, flowsTested: 0, flowsFailed: 0, flows: [] }
}) {
  const timestamp = new Date().toISOString();
  const payload = {
    runId: String(runId || `run-${Date.now()}`),
    artifactHash: String(artifactHash || ''),
    runnerId: String(runnerId),
    command: String(command),
    exitCode: Number(exitCode),
    tests: {
      testsRun: Number(tests?.testsRun || 0),
      testsPassed: Number(tests?.testsPassed || 0),
      testsFailed: Number(tests?.testsFailed || 0)
    },
    build: {
      success: Boolean(build?.success),
      exitCode: Number(build?.exitCode || 0),
      output: String(build?.output || '')
    },
    runtime: {
      started: Boolean(runtime?.started),
      port: runtime?.port ? Number(runtime.port) : null
    },
    acceptance: {
      passed: Boolean(acceptance?.passed),
      flowsTested: Number(acceptance?.flowsTested || acceptance?.flowsChecked || 0),
      flowsFailed: Number(acceptance?.flowsFailed || 0),
      flows: Array.isArray(acceptance?.flows) ? acceptance.flows : []
    },
    timestamp
  };

  const signature = crypto
    .createHmac('sha256', TRUSTED_RUNNER_SECRET)
    .update(`${payload.runId}:${payload.artifactHash}:${payload.runnerId}:${payload.exitCode}:${payload.timestamp}`)
    .digest('hex');

  return {
    ...payload,
    receiptSignature: signature
  };
}

/**
 * Creates a complete trusted execution evidence wrapper including artifact hash and signed receipt.
 */
function createTrustedExecutionEvidence({ files, runId = 'trusted-run-1', ...details }) {
  const artifactHash = computeArtifactHash(files);
  const receipt = mintExecutionReceipt({
    runId,
    artifactHash,
    ...details
  });
  return {
    receipt,
    build: receipt.build,
    tests: receipt.tests,
    runtime: receipt.runtime,
    acceptance: receipt.acceptance
  };
}

/**
 * Verifies that an execution receipt was minted by a trusted runner for the exact artifact evaluated.
 */
function verifyExecutionReceipt(receipt, expectedArtifactHash, expectedRunId = null) {
  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, reason: 'MISSING_RECEIPT' };
  }
  if (!receipt.receiptSignature || !receipt.artifactHash || !receipt.runId) {
    return { valid: false, reason: 'UNTRUSTED_OR_MALFORMED_RECEIPT' };
  }

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', TRUSTED_RUNNER_SECRET)
    .update(`${receipt.runId}:${receipt.artifactHash}:${receipt.runnerId}:${receipt.exitCode}:${receipt.timestamp}`)
    .digest('hex');

  if (expectedSig !== receipt.receiptSignature) {
    return { valid: false, reason: 'FABRICATED_RECEIPT_SIGNATURE' };
  }

  // Validate exact artifact hash match
  if (expectedArtifactHash && receipt.artifactHash !== expectedArtifactHash) {
    return {
      valid: false,
      reason: 'ARTIFACT_HASH_MISMATCH',
      detail: `Receipt artifact hash (${receipt.artifactHash}) does not match current files artifact hash (${expectedArtifactHash})`
    };
  }

  // Validate run ID match if provided
  if (expectedRunId && receipt.runId !== expectedRunId) {
    return {
      valid: false,
      reason: 'RUN_ID_MISMATCH',
      detail: `Receipt run ID (${receipt.runId}) does not match expected run ID (${expectedRunId})`
    };
  }

  return { valid: true, receipt };
}

class GeneratedAppQualityGate {
  constructor(options = {}) {
    this.version = '2.1.0-trusted-evidence';
    const casesPath = options.casesPath || path.join(__dirname, 'canonicalCases.json');
    this.cases = this._loadCases(casesPath);
  }

  _loadCases(casesPath) {
    try {
      if (fs.existsSync(casesPath)) {
        const raw = fs.readFileSync(casesPath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed.cases || [];
      }
    } catch (_) {}
    return [];
  }

  getCase(caseId) {
    return this.cases.find((c) => c.id === caseId) || null;
  }

  /**
   * Evaluates a project using multi-layer evidence.
   */
  async evaluate({
    projectDir,
    files,
    caseId,
    model = 'unknown',
    executionEvidence = null,
    runId = null,
    startTime = Date.now()
  }) {
    const caseDef = this.getCase(caseId);
    if (!caseDef) {
      return {
        evaluatorVersion: this.version,
        status: STATUS.FAILED,
        caseId,
        score: 0,
        errors: [`Unknown canonical case ID: ${caseId}`],
        layers: {
          staticDiagnostics: { passed: false, score: 0 },
          syntaxCheck: { executed: false, passed: false },
          executionReceipt: { verified: false },
          buildExecution: { executed: false, passed: false },
          unitTests: { executed: false, passed: false },
          runtimeStartup: { executed: false, passed: false },
          acceptanceFlows: { executed: false, passed: false }
        },
        evaluatedAt: new Date().toISOString()
      };
    }

    const fileMap = {};
    if (files && typeof files === 'object') {
      Object.assign(fileMap, files);
    } else if (projectDir && fs.existsSync(projectDir)) {
      this._collectFiles(projectDir, projectDir, fileMap);
    }

    const filePaths = Object.keys(fileMap);
    if (filePaths.length === 0) {
      return {
        evaluatorVersion: this.version,
        status: STATUS.FAILED,
        caseId,
        score: 0,
        coveragePercent: 0,
        errors: ['No project files found to evaluate'],
        layers: {
          staticDiagnostics: { passed: false, score: 0 },
          syntaxCheck: { executed: false, passed: false },
          executionReceipt: { verified: false },
          buildExecution: { executed: false, passed: false },
          unitTests: { executed: false, passed: false },
          runtimeStartup: { executed: false, passed: false },
          acceptanceFlows: { executed: false, passed: false }
        },
        evaluatedAt: new Date().toISOString()
      };
    }

    const artifactHash = computeArtifactHash(fileMap);

    // ── Layer 1: Static Diagnostics ──
    const defects = [];
    const detectedCapabilities = new Set();
    const detectedElements = new Set();
    let staticScore = 0;

    const combinedSource = Object.values(fileMap).join('\n');

    // Anti-pattern checks
    for (const anti of caseDef.antiPatterns || []) {
      if (combinedSource.includes(anti)) {
        defects.push({
          type: 'ANTI_PATTERN_DETECTED',
          severity: 'HIGH',
          detail: `Found placeholder or dead-end construct: "${anti}"`
        });
      }
    }

    // Check empty event handlers
    const emptyHandlerMatch = combinedSource.match(/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g);
    if (emptyHandlerMatch) {
      defects.push({
        type: 'EMPTY_EVENT_HANDLER',
        severity: 'HIGH',
        detail: `Found ${emptyHandlerMatch.length} empty event callback(s) with no implementation`
      });
    }

    // Capability patterns
    const capChecks = {
      hero_presentation: /(hero|headline|cta|get\s*started|tagline)/i,
      feature_grid: /(features|grid|card|highlight|icon)/i,
      pricing_toggle: /(pricing|tier|monthly|annual|plan|toggle)/i,
      faq_accordion: /(faq|accordion|question|answer|collapse)/i,
      newsletter_validation: /(newsletter|subscribe|email|validate|pattern)/i,
      search_filtering: /(filter|searchQuery|searchTerm|toLowerCase\(\)\.includes)/i,
      data_visualization: /(chart|svg|canvas|bar|line|pie|recharts|chartjs|<svg)/i,
      csv_export: /(csv|export|blob|text\/csv|download|createobjecturl)/i,
      state_management: /(usestate|usereducer|createcontext|usecontext|zustand|redux)/i,
      loading_error_states: /(isloading|loading|error|seterror|try\s*\{)/i,
      timer_countdown: /(setinterval|timer|countdown|timeleft|time_remaining)/i,
      category_selection: /(category|difficulty|select|options|filter)/i,
      feedback_system: /(iscorrect|feedback|score|correctanswer|result)/i,
      progress_tracking: /(progress|currentindex|currentquestion|progress-bar)/i,
      score_persistence: /(localstorage\.(setitem|getitem)|sessionstorage|indexeddb)/i,
      product_catalog: /(products|items|catalog|card|list|price)/i,
      cart_management: /(cart|addtocart|removefromcart|items\.reduce|checkout)/i,
      badge_counter: /(badge|count|itemcount|cart\.length)/i,
      modal_cart: /(modal|drawer|dialog|open|close|isopen)/i,
      checkout_flow: /(checkout|order|payment|shipping|complete)/i,
      resource_list: /(table|tbody|rows|items\.map|list)/i,
      create_form: /(form|onsubmit|handlesubmit|add|create|input)/i,
      update_action: /(edit|update|onedit|save)/i,
      delete_confirmation: /(delete|remove|confirm|dialog|warning)/i,
      pagination_controls: /(page|next|prev|currentpage|totalpages)/i,
      diagnostic_identification: /(error|bug|fix|issue|log)/i,
      isolated_reproduction: /(test|reproduce|expect|assert)/i,
      minimal_targeted_fix: /(diff|patch|fix|update)/i,
      regression_prevention: /(regression|verify|assert|passed)/i,
      verification_log: /(report|log|summary|result)/i
    };

    for (const cap of caseDef.requiredCapabilities || []) {
      const checker = capChecks[cap];
      if (checker && checker.test(combinedSource)) {
        detectedCapabilities.add(cap);
        staticScore += 10;
      } else {
        defects.push({
          type: 'MISSING_CAPABILITY',
          severity: 'MEDIUM',
          capability: cap,
          detail: `Required capability "${cap}" was not identified in generated files`
        });
      }
    }

    for (const elem of caseDef.requiredElements || []) {
      const elemName = elem.name.toLowerCase();
      let found = false;
      if (elemName.includes('button') && /<button|type="submit"/i.test(combinedSource)) found = true;
      else if (elemName.includes('input') && /<input|<textarea/i.test(combinedSource)) found = true;
      else if (elemName.includes('table') && /<table|<table>/i.test(combinedSource)) found = true;
      else if (elemName.includes('chart') && /<svg|<canvas|recharts|chart/i.test(combinedSource)) found = true;
      else if (elemName.includes('modal') && /modal|dialog|drawer/i.test(combinedSource)) found = true;
      else if (elemName.includes('pricing') && /pricing|tier|plan/i.test(combinedSource)) found = true;
      else if (elemName.includes('faq') && /faq|question|answer/i.test(combinedSource)) found = true;
      else if (elemName.includes('email') && /email|subscribe|input/i.test(combinedSource)) found = true;
      else if (/input|button|select/i.test(combinedSource)) found = true;

      if (found) {
        detectedElements.add(elem.name);
      } else {
        defects.push({
          type: 'MISSING_ELEMENT',
          severity: 'LOW',
          element: elem.name,
          detail: `Required element "${elem.name}" was not observed`
        });
      }
    }

    const totalCaps = (caseDef.requiredCapabilities || []).length || 1;
    const coveragePercent = Math.round((detectedCapabilities.size / totalCaps) * 100);
    const criticalDefects = defects.filter((d) => d.severity === 'HIGH');
    const staticPass = criticalDefects.length === 0 && coveragePercent >= 80;

    // ── Layer 2: Syntax Validation ──
    let syntaxPassed = true;
    const syntaxErrors = [];
    for (const [relPath, content] of Object.entries(fileMap)) {
      if (/\.json$/i.test(relPath)) {
        try {
          JSON.parse(content);
        } catch (err) {
          syntaxPassed = false;
          syntaxErrors.push(`JSON syntax error in ${relPath}: ${err.message}`);
        }
      }
    }

    // ── Layer 3: Trusted Server-Side Execution Receipt Verification ──
    let receiptVerification = { valid: false, reason: 'NO_EVIDENCE_PROVIDED' };
    let buildPassed = false;
    let buildFailed = false;
    let unitTestsRun = 0;
    let unitTestsPassed = 0;
    let unitTestsFailed = 0;
    let testsConfirmed = false;
    let runtimeStarted = false;
    let acceptancePassed = false;
    let acceptanceFailed = false;
    let receipt = null;

    if (executionEvidence) {
      receipt = executionEvidence.receipt || (executionEvidence.receiptSignature ? executionEvidence : null);

      if (!receipt) {
        // Caller-supplied self-reported booleans without trusted receipt are rejected
        defects.push({
          type: 'FABRICATED_OR_UNTRUSTED_EVIDENCE',
          severity: 'HIGH',
          detail: 'Caller-supplied execution evidence lacks a trusted runner receipt and artifact hash binding.'
        });
        receiptVerification = {
          valid: false,
          reason: 'FABRICATED_OR_UNTRUSTED_EVIDENCE'
        };
      } else {
        receiptVerification = verifyExecutionReceipt(receipt, artifactHash, runId);
        if (!receiptVerification.valid) {
          defects.push({
            type: receiptVerification.reason,
            severity: 'HIGH',
            detail: receiptVerification.detail || `Receipt verification failed with reason: ${receiptVerification.reason}`
          });
        } else {
          // Trusted runner evidence confirmed
          const verifiedReceipt = receiptVerification.receipt;
          buildPassed = Boolean(
            verifiedReceipt.build &&
            verifiedReceipt.build.success === true &&
            (verifiedReceipt.build.exitCode === 0 || verifiedReceipt.build.exitCode === undefined)
          );
          buildFailed = Boolean(
            verifiedReceipt.build &&
            (verifiedReceipt.build.success === false || (verifiedReceipt.build.exitCode !== undefined && verifiedReceipt.build.exitCode > 0))
          );

          unitTestsRun = Number(verifiedReceipt.tests?.testsRun || 0);
          unitTestsPassed = Number(verifiedReceipt.tests?.testsPassed || 0);
          unitTestsFailed = Number(verifiedReceipt.tests?.testsFailed || 0);
          testsConfirmed = unitTestsRun > 0 && unitTestsPassed === unitTestsRun && unitTestsFailed === 0;

          runtimeStarted = Boolean(verifiedReceipt.runtime?.started === true);

          acceptancePassed = Boolean(
            verifiedReceipt.acceptance &&
            verifiedReceipt.acceptance.passed === true &&
            (verifiedReceipt.acceptance.flowsFailed || 0) === 0 &&
            (verifiedReceipt.acceptance.flowsTested || 0) > 0
          );
          acceptanceFailed = Boolean(
            verifiedReceipt.acceptance &&
            (verifiedReceipt.acceptance.flowsFailed > 0 ||
              ((verifiedReceipt.acceptance.flowsTested || 0) > 0 && verifiedReceipt.acceptance.passed === false))
          );
        }
      }
    }

    // ── Decision Matrix with Strict Trusted Evidence Enforcement ──
    const isComplexApp = Boolean(caseDef.requiredCapabilities && caseDef.requiredCapabilities.length > 2);
    let status;

    if (!syntaxPassed || criticalDefects.length > 2 || buildFailed || acceptanceFailed) {
      status = STATUS.FAILED;
    } else if (executionEvidence && !receiptVerification.valid) {
      // Evidence was provided but untrusted, forged, or hash mismatched
      status = STATUS.FAILED;
    } else if (receiptVerification.valid) {
      // Evidence is authenticated by trusted runner
      if (isComplexApp && !acceptancePassed) {
        // Complex applications require acceptance verification; build alone cannot prove interactions
        status = STATUS.PARTIAL;
      } else if (staticPass && buildPassed && (!isComplexApp || acceptancePassed) && (!unitTestsRun || testsConfirmed)) {
        status = STATUS.VERIFIED_PASS;
      } else if (buildPassed || unitTestsPassed > 0 || runtimeStarted) {
        status = STATUS.PARTIAL;
      } else {
        status = STATUS.FAILED;
      }
    } else {
      // No execution evidence provided
      // Strict rule: static diagnostics alone can NEVER yield VERIFIED_PASS
      if (staticPass) {
        status = STATUS.STATIC_DIAGNOSTIC_PASS;
      } else if (coveragePercent >= 50) {
        status = STATUS.PARTIAL;
      } else {
        status = STATUS.FAILED;
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      evaluatorVersion: this.version,
      caseId,
      caseName: caseDef.name,
      status,
      score: staticScore,
      coveragePercent,
      artifactHash,
      detectedCapabilities: Array.from(detectedCapabilities),
      detectedElements: Array.from(detectedElements),
      defects,
      criticalDefectCount: defects.filter((d) => d.severity === 'HIGH').length,
      fileCount: filePaths.length,
      model,
      latencyMs,
      layers: {
        staticDiagnostics: {
          passed: staticPass,
          score: staticScore,
          coveragePercent,
          defectsCount: defects.length
        },
        syntaxCheck: {
          executed: true,
          passed: syntaxPassed,
          errors: syntaxErrors
        },
        executionReceipt: {
          executed: Boolean(executionEvidence),
          verified: receiptVerification.valid,
          reason: receiptVerification.reason || null,
          artifactHash: receipt?.artifactHash || null,
          runId: receipt?.runId || null
        },
        buildExecution: {
          executed: Boolean(receipt?.build),
          passed: buildPassed,
          output: receipt?.build?.output || null
        },
        unitTests: {
          executed: unitTestsRun > 0,
          passed: testsConfirmed,
          testsRun: unitTestsRun,
          testsPassed: unitTestsPassed,
          testsFailed: unitTestsFailed
        },
        runtimeStartup: {
          executed: Boolean(receipt?.runtime),
          passed: runtimeStarted,
          port: receipt?.runtime?.port || null
        },
        acceptanceFlows: {
          executed: Boolean(receipt?.acceptance),
          passed: acceptancePassed,
          flowsTested: receipt?.acceptance?.flowsTested || 0,
          flowsFailed: receipt?.acceptance?.flowsFailed || 0
        }
      },
      evaluatedAt: new Date().toISOString()
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
  GeneratedAppQualityGate,
  STATUS,
  computeArtifactHash,
  mintExecutionReceipt,
  createTrustedExecutionEvidence,
  verifyExecutionReceipt
};
