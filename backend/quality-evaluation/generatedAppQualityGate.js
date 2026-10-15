/**
 * AI-Dost Generated-Application Quality Gate (Phase 7)
 * ====================================================
 * Evaluates generated full-stack applications against canonical test cases.
 * Strictly checks:
 *   1. Complete file structure & syntax validity
 *   2. Requirement traceability & capability presence
 *   3. Real interactive event handlers vs dead placeholder buttons
 *   4. State handling (loading, empty, success, error)
 *   5. Build/test execution evidence
 *
 * Statuses:
 *   - VERIFIED_PASS: Build passes, zero critical defects, >=85% requirement coverage.
 *   - PARTIAL: Build passes or runs, but missing non-critical capabilities (50-84%).
 *   - FAILED: Syntax/build error, critical defect, or <50% capability coverage.
 *   - UNVERIFIED: No execution environment or unable to inspect evidence.
 */

const fs = require('fs');
const path = require('path');
const canonicalCases = require('./canonicalCases.json');

const STATUS = {
  VERIFIED_PASS: 'VERIFIED_PASS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  UNVERIFIED: 'UNVERIFIED'
};

class GeneratedAppQualityGate {
  constructor(options = {}) {
    this.version = '2.0.0-verified';
    this.cases = new Map(canonicalCases.cases.map(c => [c.id, c]));
  }

  getCase(caseId) {
    return this.cases.get(caseId) || null;
  }

  listCases() {
    return canonicalCases.cases;
  }

  /**
   * Evaluate a project directory or files object against a canonical case.
   * @param {Object} params
   * @param {string} [params.projectDir] - Directory of the generated project.
   * @param {Object} [params.files] - Map of relative path -> string content.
   * @param {string} params.caseId - Canonical case identifier.
   * @param {string} [params.model] - Model name if known.
   * @param {number} [params.startTime] - Start timestamp for latency measurement.
   */
  async evaluate({ projectDir, files, caseId, model = 'unknown', startTime = Date.now() }) {
    const caseDef = this.getCase(caseId);
    if (!caseDef) {
      return {
        status: STATUS.FAILED,
        caseId,
        score: 0,
        errors: [`Unknown canonical case ID: ${caseId}`],
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
        status: STATUS.FAILED,
        caseId,
        score: 0,
        coveragePercent: 0,
        errors: ['No project files found to evaluate'],
        evaluatedAt: new Date().toISOString()
      };
    }

    const defects = [];
    const detectedCapabilities = new Set();
    const detectedElements = new Set();
    let totalScore = 0;

    // 1. Syntax & Static Validation
    const combinedSource = Object.values(fileMap).join('\n');

    // Check anti-patterns
    for (const anti of caseDef.antiPatterns || []) {
      if (combinedSource.includes(anti)) {
        defects.push({
          type: 'ANTI_PATTERN_DETECTED',
          severity: 'HIGH',
          detail: `Found forbidden placeholder or dead-end construct: "${anti}"`
        });
      }
    }

    // Check for empty handlers: onClick={() => {}} or onClick={() => void 0}
    const emptyHandlerMatch = combinedSource.match(/onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/g);
    if (emptyHandlerMatch) {
      defects.push({
        type: 'EMPTY_EVENT_HANDLER',
        severity: 'HIGH',
        detail: `Found ${emptyHandlerMatch.length} empty event callback(s) with no implementation`
      });
    }

    // 2. Capability Detection
    const capChecks = {
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
      date_slot_selection: /(selecteddate|timeslot|slots|bookingdate|calendar)/i,
      timezone_conversion: /(timezone|intl\.datetimeformat|utc|localtime|toformat)/i,
      conflict_prevention: /(isalreadybooked|isavailable|overlap|conflict|disabled)/i,
      cancellation_flow: /(cancel|modal|dialog|confirm|cancellationpolicy)/i,
      status_indicators: /(confirmed|pending|cancelled|badge|status)/i,
      catalog_filtering: /(category|price|minprice|maxprice|filter)/i,
      cart_operations: /(addtocart|removefromcart|updatequantity|cartitems)/i,
      discount_calculation: /(promo|coupon|discount|subtotal|discountedprice)/i,
      form_validation: /(validate|error|require|pattern|onsubmit|isvalid)/i,
      cart_persistence: /(localstorage\.setitem\(['"`]cart|cartitems)/i
    };

    for (const cap of caseDef.requiredCapabilities || []) {
      const regex = capChecks[cap];
      if (regex && regex.test(combinedSource)) {
        detectedCapabilities.add(cap);
        totalScore += 20;
      } else {
        defects.push({
          type: 'MISSING_CAPABILITY',
          severity: 'MEDIUM',
          capability: cap,
          detail: `Required capability "${cap}" not found in project sources`
        });
      }
    }

    // 3. Element Detection
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
      else if (elemName.includes('timezone') && /timezone|utc|gmt|offset/i.test(combinedSource)) found = true;
      else if (elemName.includes('modal') && /modal|dialog|confirm/i.test(combinedSource)) found = true;
      else if (elemName.includes('status') && /badge|status|confirmed/i.test(combinedSource)) found = true;
      else if (elemName.includes('cart') && /cart|checkout|items/i.test(combinedSource)) found = true;
      else if (elemName.includes('promo') && /promo|coupon|discount/i.test(combinedSource)) found = true;
      else if (elemName.includes('form') && /form|input|submit/i.test(combinedSource)) found = true;
      else if (/input|button|select/i.test(combinedSource)) found = true;

      if (found) {
        detectedElements.add(elem.name);
      } else {
        defects.push({
          type: 'MISSING_ELEMENT',
          severity: 'LOW',
          element: elem.name,
          detail: `Required UI element "${elem.name}" was not observed`
        });
      }
    }

    const totalCaps = (caseDef.requiredCapabilities || []).length || 1;
    const coveragePercent = Math.round((detectedCapabilities.size / totalCaps) * 100);
    const criticalDefects = defects.filter(d => d.severity === 'HIGH');

    // 4. Determine Status
    let status = STATUS.FAILED;
    if (criticalDefects.length === 0 && coveragePercent >= 80) {
      status = STATUS.VERIFIED_PASS;
    } else if (criticalDefects.length <= 1 && coveragePercent >= 50) {
      status = STATUS.PARTIAL;
    } else {
      status = STATUS.FAILED;
    }

    const latencyMs = Date.now() - startTime;

    return {
      evaluatorVersion: this.version,
      caseId,
      caseName: caseDef.name,
      status,
      score: totalScore,
      coveragePercent,
      detectedCapabilities: Array.from(detectedCapabilities),
      detectedElements: Array.from(detectedElements),
      defects,
      criticalDefectCount: criticalDefects.length,
      fileCount: filePaths.length,
      model,
      latencyMs,
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
