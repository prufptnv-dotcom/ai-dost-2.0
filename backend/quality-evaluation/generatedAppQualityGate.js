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
const os = require('os');

const {
  createWorkspaceSnapshot,
  computeSnapshotHash,
  SUPPORTED_EXTENSIONS,
  EXCLUDED_DIRS,
  DEFAULT_LIMITS
} = require('./workspaceManifest');

const {
  consumeReceiptSignature,
  isReceiptSignatureConsumed,
  _clearConsumedReceiptsForTesting
} = require('./receiptReplayStore');

const { getAcceptanceFlows } = require('./canonicalAcceptanceFlows');

const STATUS = {
  VERIFIED_PASS: 'VERIFIED_PASS',
  STATIC_DIAGNOSTIC_PASS: 'STATIC_DIAGNOSTIC_PASS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  UNVERIFIED: 'UNVERIFIED',
  NOT_EVALUATED: 'NOT_EVALUATED'
};

function getRunnerSecret() {
  const secret = process.env.AIDOST_RUNNER_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    return null;
  }
  return secret.trim();
}

const CANONICAL_EXTENSIONS = SUPPORTED_EXTENSIONS;
const CANONICAL_EXCLUDE_DIRS = EXCLUDED_DIRS;

/**
 * Single authoritative canonical file collector for all verification and evidence services.
 */
function collectCanonicalWorkspaceFiles(dir, rootDir = dir, fileMap = {}) {
  if (!dir || !fs.existsSync(dir)) return fileMap;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (CANONICAL_EXCLUDE_DIRS.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        collectCanonicalWorkspaceFiles(full, rootDir, fileMap);
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (CANONICAL_EXTENSIONS.has(ext)) {
          const rel = path.relative(rootDir, full).replace(/\\/g, '/');
          try {
            fileMap[rel] = fs.readFileSync(full, 'utf8');
          } catch (_) {}
        }
      }
    }
  } catch (_) {}
  return fileMap;
}

/**
 * Computes canonical SHA-256 artifact hash across all evaluated project files.
 */
function computeArtifactHash(fileMap = {}) {
  return computeSnapshotHash(fileMap);
}

/**
 * Canonicalizes receipt payload deterministically for signing and verification.
 */
function canonicalizeReceiptPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return '';
  const canonicalObj = {
    acceptance: {
      flows: Array.isArray(payload.acceptance?.flows)
        ? payload.acceptance.flows.map((f) => ({
            id: String(f?.id || ''),
            name: String(f?.name || ''),
            passed: Boolean(f?.passed)
          })).sort((a, b) => a.id.localeCompare(b.id))
        : [],
      flowsFailed: Number(payload.acceptance?.flowsFailed || 0),
      flowsTested: Number(payload.acceptance?.flowsTested || payload.acceptance?.flowsChecked || 0),
      passed: Boolean(payload.acceptance?.passed)
    },
    artifactHash: String(payload.artifactHash || ''),
    build: {
      exitCode: payload.build?.exitCode != null ? Number(payload.build.exitCode) : null,
      output: String(payload.build?.output || ''),
      status: String(payload.build?.status || (payload.build?.success ? 'PASSED' : 'NOT_REQUIRED')),
      success: Boolean(payload.build?.success)
    },
    command: String(payload.command || ''),
    exitCode: Number(payload.exitCode || 0),
    runId: String(payload.runId || ''),
    runnerId: String(payload.runnerId || ''),
    runtime: {
      port: payload.runtime?.port != null ? Number(payload.runtime.port) : null,
      started: Boolean(payload.runtime?.started)
    },
    tests: {
      commandPassed: Boolean(payload.tests?.commandPassed),
      countsMeasured: Boolean(payload.tests?.countsMeasured),
      testsFailed: payload.tests?.testsFailed != null ? Number(payload.tests.testsFailed) : null,
      testsPassed: payload.tests?.testsPassed != null ? Number(payload.tests.testsPassed) : null,
      testsRun: payload.tests?.testsRun != null ? Number(payload.tests.testsRun) : null
    },
    timestamp: String(payload.timestamp || '')
  };
  return JSON.stringify(canonicalObj);
}

/**
 * Verifies that an execution receipt was minted by a trusted runner for the exact artifact evaluated.
 */
function verifyExecutionReceipt(receipt, expectedArtifactHash, expectedRunId = null, options = {}) {
  const secret = options.secret !== undefined ? options.secret : getRunnerSecret();
  if (!secret || typeof secret !== 'string' || secret.trim().length < 16) {
    return { valid: false, reason: 'RUNNER_SECRET_UNAVAILABLE' };
  }

  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, reason: 'MISSING_RECEIPT' };
  }
  if (!receipt.receiptSignature || !receipt.artifactHash || !receipt.runId || !receipt.timestamp) {
    return { valid: false, reason: 'UNTRUSTED_OR_MALFORMED_RECEIPT' };
  }

  // Signature format validation: must be 64-char hex string
  if (typeof receipt.receiptSignature !== 'string' || !/^[0-9a-f]{64}$/i.test(receipt.receiptSignature)) {
    return { valid: false, reason: 'MALFORMED_RECEIPT_SIGNATURE' };
  }

  // Required expected run ID validation
  if (!expectedRunId || typeof expectedRunId !== 'string' || !expectedRunId.trim()) {
    return { valid: false, reason: 'EXPECTED_RUN_ID_REQUIRED' };
  }
  if (receipt.runId !== expectedRunId) {
    return {
      valid: false,
      reason: 'RUN_ID_MISMATCH',
      detail: `Receipt run ID (${receipt.runId}) does not match expected run ID (${expectedRunId})`
    };
  }

  // Freshness check: timestamp must be valid ISO, within freshness limit, not in future
  const receiptTime = new Date(receipt.timestamp).getTime();
  if (isNaN(receiptTime)) {
    return { valid: false, reason: 'INVALID_RECEIPT_TIMESTAMP' };
  }
  const maxAgeMs = options.maxAgeMs || 300000; // 5 minutes
  const now = options.now || Date.now();
  if (receiptTime > now + 5000) {
    return { valid: false, reason: 'RECEIPT_TIMESTAMP_IN_FUTURE' };
  }
  if (now - receiptTime > maxAgeMs) {
    return { valid: false, reason: 'RECEIPT_EXPIRED' };
  }

  // Replay protection: check if signature was already consumed
  try {
    if (isReceiptSignatureConsumed(receipt.receiptSignature)) {
      return { valid: false, reason: 'RECEIPT_REPLAY_DETECTED' };
    }
  } catch (err) {
    return { valid: false, reason: 'REPLAY_REGISTRY_ERROR', detail: err.message };
  }

  // Exact artifact hash match
  if (expectedArtifactHash && receipt.artifactHash !== expectedArtifactHash) {
    return {
      valid: false,
      reason: 'ARTIFACT_HASH_MISMATCH',
      detail: `Receipt artifact hash (${receipt.artifactHash}) does not match current files artifact hash (${expectedArtifactHash})`
    };
  }

  // Constant-time HMAC comparison
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(canonicalizeReceiptPayload(receipt))
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const actualBuf = Buffer.from(receipt.receiptSignature, 'hex');

  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: 'FABRICATED_RECEIPT_SIGNATURE' };
  }

  // Mark signature consumed in transactional durable replay store
  try {
    consumeReceiptSignature(receipt.receiptSignature, receipt.runId, receipt.artifactHash);
  } catch (err) {
    if (err && err.code === 'RECEIPT_REPLAY_DETECTED') {
      return { valid: false, reason: 'RECEIPT_REPLAY_DETECTED' };
    }
    return { valid: false, reason: 'REPLAY_REGISTRY_ERROR', detail: err.message };
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
        status: STATUS.NOT_EVALUATED,
        caseId: caseId || null,
        score: 0,
        reason: `Unknown or unsupported canonical case ID: ${caseId}`,
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

    let snapshot;
    try {
      const source = files || projectDir;
      if (!source) {
        throw new Error('No project files found to evaluate');
      }
      snapshot = createWorkspaceSnapshot(source);
    } catch (manifestErr) {
      return {
        evaluatorVersion: this.version,
        status: STATUS.FAILED,
        caseId,
        score: 0,
        coveragePercent: 0,
        errors: [manifestErr.message],
        defects: [{
          type: manifestErr.message.includes('MANIFEST_LIMIT_EXCEEDED') ? 'MANIFEST_LIMIT_EXCEEDED' : 'WORKSPACE_SNAPSHOT_ERROR',
          severity: 'HIGH',
          detail: manifestErr.message
        }],
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

    const fileMap = snapshot.files;
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

    const artifactHash = snapshot.hash;

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
    let buildNotRequired = false;
    let unitTestsRun = null;
    let unitTestsPassed = null;
    let unitTestsFailed = null;
    let countsMeasured = false;
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
          const buildStatus = verifiedReceipt.build?.status;
          const buildExecuted = Boolean(verifiedReceipt.build?.executed);

          if (buildStatus === 'PASSED' || (verifiedReceipt.build?.success === true && (verifiedReceipt.build?.exitCode === 0 || verifiedReceipt.build?.exitCode == null))) {
            buildPassed = true;
            buildFailed = false;
          } else if (buildStatus === 'FAILED' || (buildExecuted && verifiedReceipt.build?.success === false) || (verifiedReceipt.build?.exitCode != null && verifiedReceipt.build?.exitCode > 0)) {
            buildPassed = false;
            buildFailed = true;
          } else if (buildStatus === 'NOT_REQUIRED' || (!buildExecuted && !verifiedReceipt.build?.success)) {
            buildNotRequired = true;
            buildFailed = false;
          }

          countsMeasured = Boolean(verifiedReceipt.tests?.countsMeasured);
          unitTestsRun = verifiedReceipt.tests?.testsRun != null ? Number(verifiedReceipt.tests.testsRun) : null;
          unitTestsPassed = verifiedReceipt.tests?.testsPassed != null ? Number(verifiedReceipt.tests.testsPassed) : null;
          unitTestsFailed = verifiedReceipt.tests?.testsFailed != null ? Number(verifiedReceipt.tests.testsFailed) : null;

          testsConfirmed = Boolean(
            countsMeasured &&
            unitTestsRun != null &&
            unitTestsRun > 0 &&
            unitTestsPassed === unitTestsRun &&
            (!unitTestsFailed || unitTestsFailed === 0)
          );

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
      // Evidence was provided but untrusted, forged, replayed, or hash mismatched
      status = STATUS.FAILED;
    } else if (receiptVerification.valid) {
      // Evidence is authenticated by trusted runner
      const buildSatisfied = buildPassed || buildNotRequired;

      if (isComplexApp && !acceptancePassed) {
        // Complex applications require acceptance verification; build alone cannot prove interactions
        status = STATUS.PARTIAL;
      } else if (staticPass && buildSatisfied && (!isComplexApp || acceptancePassed) && (!countsMeasured || testsConfirmed)) {
        if (unitTestsRun != null && !testsConfirmed) {
          status = STATUS.PARTIAL;
        } else {
          status = STATUS.VERIFIED_PASS;
        }
      } else if (buildPassed || (countsMeasured && unitTestsPassed > 0) || runtimeStarted) {
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
          executed: Boolean(receipt?.build?.executed || (receipt?.build && receipt?.build?.status !== 'NOT_REQUIRED')),
          passed: buildPassed,
          status: receipt?.build?.status || (buildPassed ? 'PASSED' : (buildNotRequired ? 'NOT_REQUIRED' : 'FAILED')),
          output: receipt?.build?.output || null
        },
        unitTests: {
          executed: countsMeasured && unitTestsRun != null && unitTestsRun > 0,
          passed: testsConfirmed,
          countsMeasured,
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
    return collectCanonicalWorkspaceFiles(currentDir, rootDir, fileMap);
  }
}

const {
  resolveCanonicalCase,
  getCanonicalCase,
  CANONICAL_CASES,
  CANONICAL_CASE_IDS
} = require('./canonicalCaseResolver');

module.exports = {
  GeneratedAppQualityGate,
  STATUS,
  computeArtifactHash,
  collectCanonicalWorkspaceFiles,
  verifyExecutionReceipt,
  canonicalizeReceiptPayload,
  getRunnerSecret,
  _clearConsumedReceiptsForTesting,
  resolveCanonicalCase,
  getCanonicalCase,
  CANONICAL_CASES,
  CANONICAL_CASE_IDS,
  createWorkspaceSnapshot,
  computeSnapshotHash,
  getAcceptanceFlows
};
