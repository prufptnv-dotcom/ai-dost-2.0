'use strict';

/**
 * AI-Dost Generated-Application Quality Evaluation Gate
 * Replaces misleading static claims with multi-layered, execution-backed evidence.
 * 
 * Strict Principle:
 * Static source analysis produces a diagnostic result, NEVER a claim of runtime verification.
 * VERIFIED_PASS requires applicable real execution evidence (build, tests, or runtime).
 */

const fs = require('fs');
const path = require('path');

const STATUS = {
  VERIFIED_PASS: 'VERIFIED_PASS',
  STATIC_DIAGNOSTIC_PASS: 'STATIC_DIAGNOSTIC_PASS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  UNVERIFIED: 'UNVERIFIED',
  NOT_EVALUATED: 'NOT_EVALUATED'
};

class GeneratedAppQualityGate {
  constructor(options = {}) {
    this.version = '2.0.0-execution-backed';
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
   * @param {Object} params
   * @param {string} [params.projectDir] - Directory of the generated project
   * @param {Object} [params.files] - Map of relative path -> string content
   * @param {string} params.caseId - Canonical case identifier
   * @param {string} [params.model] - Model name if known (never fabricated)
   * @param {Object} [params.executionEvidence] - Real execution evidence layers
   * @param {number} [params.startTime] - Start timestamp for latency measurement
   */
  async evaluate({ projectDir, files, caseId, model = 'unknown', executionEvidence = null, startTime = Date.now() }) {
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
          buildExecution: { executed: false, passed: false },
          unitTests: { executed: false, passed: false },
          runtimeStartup: { executed: false, passed: false },
          acceptanceFlows: { executed: false, passed: false }
        },
        evaluatedAt: new Date().toISOString()
      };
    }

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
      catalog_filtering: /(category|price|minprice|maxprice|filter)/i,
      cart_operations: /(addtocart|removefromcart|updatequantity|cartitems)/i,
      discount_calculation: /(promo|coupon|discount|subtotal|discountedprice)/i,
      form_validation: /(validate|error|require|pattern|onsubmit|isvalid)/i,
      cart_persistence: /(localstorage\.setitem\(['"`]cart|cartitems)/i,
      rest_api_endpoints: /(app|router)\.(get|post|put|delete)/i,
      crud_mutations: /(create|read|update|delete|splice|findindex)/i,
      input_validation: /(req\.body|typeof|length\s*===|bad\s*request|400)/i,
      optimistic_ui: /(previtems|setitems\(\s*\(prev\)|optimistic)/i,
      error_handling: /(errorboundary|catch|fallback|status\(\s*500\))/i,
      root_cause_diagnosis: /(root\s*cause|diagnosis|identified)/i,
      surgical_diff_application: /(apply_diff|replace|patch)/i,
      state_immutability_fix: /(\.\.\.prev|object\.assign|immutab)/i,
      build_verification: /(build\s*passed|compiled|tsc|vite\s*build)/i,
      regression_prevention: /(regression|test|assertion)/i
    };

    for (const cap of caseDef.requiredCapabilities || []) {
      const regex = capChecks[cap];
      if (regex && regex.test(combinedSource)) {
        detectedCapabilities.add(cap);
        staticScore += 20;
      } else {
        defects.push({
          type: 'MISSING_CAPABILITY',
          severity: 'MEDIUM',
          capability: cap,
          detail: `Required capability "${cap}" not found in project sources`
        });
      }
    }

    // Element detection
    for (const elem of caseDef.requiredElements || []) {
      const elemName = elem.name.toLowerCase();
      let found = false;
      if (elemName.includes('search') && /search|filter/i.test(combinedSource)) found = true;
      else if (elemName.includes('table') && /table|grid|tbody|thead|rows/i.test(combinedSource)) found = true;
      else if (elemName.includes('chart') && /chart|svg|canvas|recharts|bar/i.test(combinedSource)) found = true;
      else if (elemName.includes('csv') && /csv|export|download/i.test(combinedSource)) found = true;
      else if (elemName.includes('timer') && /timer|interval|countdown/i.test(combinedSource)) found = true;
      else if (elemName.includes('progress') && /progress|step/i.test(combinedSource)) found = true;
      else if (elemName.includes('score') && /score|review|result/i.test(combinedSource)) found = true;
      else if (elemName.includes('persistence') && /localstorage|persist/i.test(combinedSource)) found = true;
      else if (elemName.includes('cart') && /cart|checkout|items/i.test(combinedSource)) found = true;
      else if (elemName.includes('promo') && /promo|coupon|discount/i.test(combinedSource)) found = true;
      else if (elemName.includes('form') && /form|input|submit/i.test(combinedSource)) found = true;
      else if (elemName.includes('hero') && /hero|h1|welcome|build/i.test(combinedSource)) found = true;
      else if (elemName.includes('pricing') && /pricing|tier|plan|\$|mo|yr/i.test(combinedSource)) found = true;
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

    // ── Layer 3: Real Execution Evidence Evaluation ──
    const exec = executionEvidence || {};
    const buildPassed = Boolean(exec.build && exec.build.success === true);
    const unitTestsRun = Number(exec.tests?.testsRun || 0);
    const unitTestsPassed = Number(exec.tests?.testsPassed || 0);
    const testsConfirmed = unitTestsRun > 0 && unitTestsPassed === unitTestsRun;
    const runtimeStarted = Boolean(exec.runtime?.started === true);
    const acceptancePassed = Boolean(exec.acceptance?.passed === true);

    const hasRealExecutionEvidence = Boolean(
      testsConfirmed || buildPassed || runtimeStarted || acceptancePassed
    );

    // ── Layer-Separated Decision Matrix ──
    let status;
    if (!syntaxPassed || criticalDefects.length > 2) {
      status = STATUS.FAILED;
    } else if (hasRealExecutionEvidence) {
      // Real execution verified
      if ((testsConfirmed || acceptancePassed || buildPassed) && staticPass) {
        status = STATUS.VERIFIED_PASS;
      } else if (unitTestsPassed > 0 || buildPassed) {
        status = STATUS.PARTIAL;
      } else {
        status = STATUS.FAILED;
      }
    } else {
      // NO REAL EXECUTION EVIDENCE
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
      detectedCapabilities: Array.from(detectedCapabilities),
      detectedElements: Array.from(detectedElements),
      defects,
      criticalDefectCount: criticalDefects.length,
      fileCount: filePaths.length,
      model,
      latencyMs,
      // Clear multi-layer evidence breakdown
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
        buildExecution: {
          executed: Boolean(exec.build),
          passed: buildPassed,
          output: exec.build?.output || null
        },
        unitTests: {
          executed: unitTestsRun > 0,
          passed: testsConfirmed,
          testsRun: unitTestsRun,
          testsPassed: unitTestsPassed
        },
        runtimeStartup: {
          executed: Boolean(exec.runtime),
          passed: runtimeStarted,
          port: exec.runtime?.port || null
        },
        acceptanceFlows: {
          executed: Boolean(exec.acceptance),
          passed: acceptancePassed
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
  STATUS
};
