'use strict';

/**
 * VerificationClassifier — Canonical classification of verification evidence,
 * tool categories, and verification status.
 *
 * Evidence Categories:
 * 1. INSPECTION: File reading, directory listing, code search, workspace reads, skills, web search.
 *    Evidence proves file existence or text match, NEVER that the code works, compiles, or passes tests.
 * 2. BUILD: Build compilation (sandbox_dev_build, npm run build, vite build, tsc).
 *    Evidence proves code builds/compiles without fatal syntax/bundle errors. Does not prove all features work.
 * 3. VISUAL: Visual screenshots and DOM snapshots.
 *    Evidence proves visual state rendered. Does not prove full interactive acceptance by itself.
 * 4. TEST: Automated test suites (run_tests, npm test, pytest, playwright test).
 *    Evidence proves automated unit/integration tests passed.
 * 5. FUNCTIONAL_ACCEPTANCE: Requirement-level functional acceptance checks or end-to-end
 *    verified application checks (e.g. verify_project with verified requirement checks).
 *    Evidence proves specific requested functional features are verified working.
 *
 * Security invariants:
 * - Tool names, check names, type/category fields, success/satisfied/verified flags, and
 *   output coverage lists are NEVER sufficient proof of functional acceptance on their own.
 * - Only explicitly identified, executed, and passing requirement-level checks constitute evidence.
 * - Requirements scope is resolved from all supplied input fields; empty arrays do not hide others.
 * - Requirement matching uses exact normalized identity comparison — no substring fuzzy matching.
 * - A check with success:false is failed, regardless of exitCode value.
 * - output.satisfiedRequirements/verifiedRequirements/coveredRequirements are not independent
 *   proof; a requirement is only "covered" when a passing executed check carries that same identity.
 */

const EVIDENCE_CATEGORIES = Object.freeze({
  INSPECTION: 'INSPECTION',
  BUILD: 'BUILD',
  VISUAL: 'VISUAL',
  TEST: 'TEST',
  FUNCTIONAL_ACCEPTANCE: 'FUNCTIONAL_ACCEPTANCE',
  UNKNOWN: 'UNKNOWN'
});

const INSPECTION_TOOLS = new Set([
  'list_directory',
  'read_file',
  'read_file_tree',
  'search_codebase',
  'search_codebase_index',
  'get_relevant_context',
  'sandbox_read',
  'sandbox_list',
  'web_search',
  'fetch_webpage',
  'load_skill',
  'create_assessment',
  'inspect_code',
  'inspect_visual_dom'
]);

const BUILD_TOOLS = new Set([
  'sandbox_dev_build',
  'build_project',
  'compile_project'
]);

const VISUAL_TOOLS = new Set([
  'take_screenshot',
  'browser_screenshot',
  'browser_snapshot',
  'visual_verification'
]);

const TEST_TOOLS = new Set([
  'run_tests',
  'run_automated_tests',
  'test_project'
]);

/**
 * Exact set of server-side trusted functional-acceptance tool names.
 * SECURITY: Adding a name here does NOT grant acceptance — output.checks must still
 * carry valid, identity-bound, passing requirement checks.
 */
const FUNCTIONAL_ACCEPTANCE_TOOLS = new Set([
  'verify_project',
  'verify_functional_acceptance',
  'verify_acceptance_criteria',
  'verify_user_flow'
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns a normalised identity string for a requirement descriptor.
 * Returns '' for anything that cannot produce a valid identity.
 */
function normalizeRequirementId(r) {
  if (typeof r === 'string') return r.trim().toLowerCase();
  if (r && typeof r === 'object') {
    const raw = r.id || r.requirementId || r.name;
    return raw ? String(raw).trim().toLowerCase() : '';
  }
  return '';
}

/**
 * Returns a normalised identity string for a check's requirement binding.
 * Returns '' when no identity field is present.
 */
function normalizeCheckIdentity(c) {
  const raw = c.requirementId || c.requirement || c.feature || c.criteria;
  return raw ? String(raw).trim().toLowerCase() : '';
}

/**
 * Checks whether a check result is a dummy or placeholder check
 * (e.g., when verify_project found no scripts and returned name: 'none').
 */
function isDummyCheck(check) {
  if (!check || typeof check !== 'object') return true;
  const name = String(check.name || '').trim().toLowerCase();
  const cmd  = String(check.command || '').trim().toLowerCase();
  const stdout = String(check.stdout || '').toLowerCase();
  if (name === 'none' || cmd === 'none' || name === 'dummy' || name === 'empty') return true;
  if (/no verification scripts found/i.test(stdout)) return true;
  return false;
}

/**
 * Returns true when a check should count as passing.
 *
 * SECURITY: success:false is a definitive failure signal and overrides exitCode.
 * A check with { success: false, exitCode: 0 } is FAILED.
 * A check with { success: true, exitCode: 0 } or { success: true } is PASSED.
 * Absence of success field (undefined) is treated as passed when exitCode is 0,
 * but explicit false always wins.
 */
function isCheckPassing(c) {
  if (c.success === false) return false;          // explicit failure — exitCode cannot override
  if (c.success === true)  return true;           // explicit pass
  // success is absent — fall back to exitCode
  return typeof c.exitCode === 'number' && c.exitCode === 0;
}

/**
 * Resolves the full requirement scope from the input object.
 *
 * Bypass A fix: requirements:[] does NOT hide populated features/explicitRequirements/
 * acceptanceCriteria.  We collect from ALL four fields and merge into one list,
 * filtering out empty/null identities.  Returns null when no usable scope exists.
 */
function resolveRequirementScope(input = {}) {
  const sources = [
    input?.requirements,
    input?.explicitRequirements,
    input?.features,
    input?.acceptanceCriteria
  ];

  // Track whether any array was present at all
  let anyArrayPresent = false;
  const merged = [];
  const seen = new Set();

  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    anyArrayPresent = true;
    for (const r of src) {
      const id = normalizeRequirementId(r);
      if (id && !seen.has(id)) {
        seen.add(id);
        merged.push(id);
      }
    }
  }

  // No array supplied at all → truly absent scope → null
  if (!anyArrayPresent) return null;

  // Arrays were supplied but all entries were empty/null/invalid
  // → scope was explicitly requested but is unresolvable → empty array (fail closed)
  return merged;
}

/**
 * Builds the set of requirement identities that are proved by passing, identity-bound
 * executed checks.
 *
 * Bypass C fix:
 * - Uses exact normalised identity matching (no substring/fuzzy logic).
 * - output.satisfiedRequirements/verifiedRequirements/coveredRequirements are NOT
 *   counted as independent proof.  Every entry in those arrays is only accepted when
 *   a passing executed check with the same normalised identity exists.
 * - success:false overrides exitCode (see isCheckPassing).
 *
 * @param {Array} checks  - Real (non-dummy) executed sub-checks
 * @returns {Set<string>} - Set of exactly-matched, proven requirement identities
 */
function buildExecutedCoverageSet(checks) {
  const covered = new Set();
  if (!Array.isArray(checks)) return covered;
  for (const c of checks) {
    if (!c || isDummyCheck(c)) continue;
    if (!isCheckPassing(c)) continue;           // failed check — cannot contribute
    const id = normalizeCheckIdentity(c);
    if (id) covered.add(id);
  }
  return covered;
}

/**
 * Validates that every requirement in the resolved scope has been proved by an
 * executed, passing, identity-bound check.
 *
 * Returns true  → all requirements have executed evidence.
 * Returns false → any requirement is unproved, or scope resolution fails.
 * Returns null  → no requirement scope is defined (caller decides what to do).
 *
 * SECURITY:
 * - Empty requirements array plus other populated arrays is handled by resolveRequirementScope.
 * - Output coverage-list claims (satisfiedRequirements etc.) are NOT independent proof.
 * - Matching is exact (normalized lowercase) — no substring fuzzy matching.
 * - Empty/null identities in the scope are treated as unresolvable → fail closed.
 */
function hasValidRequirementCoverage(input = {}, _output = {}, checks = []) {
  // Bypass A fix: resolve full scope across all input fields
  const scope = resolveRequirementScope(input);

  // null → no scope supplied at all → no requirement-level claims either way
  if (scope === null) return null;

  // [] → scope was explicitly requested but all entries were invalid → fail closed
  if (scope.length === 0) return false;

  // Build coverage set exclusively from executed, passing, identity-bound checks
  const executedCoverage = buildExecutedCoverageSet(checks);

  // Every scoped requirement must appear in the executed coverage set (exact match)
  for (const reqId of scope) {
    if (!executedCoverage.has(reqId)) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Check and tool classifiers
// ---------------------------------------------------------------------------

/**
 * Returns true when a check has an explicit requirement identity AND indicates
 * it is a functional/requirement-level check (by type, name, or identity presence).
 *
 * Bypass B fix: type/name of 'functional_acceptance' or 'requirement_acceptance' WITHOUT
 * an explicit requirement identity does NOT make a check functional.  An explicit identity
 * field (requirementId/requirement/feature/criteria) is required.
 */
function isIdentityBoundRequirementCheck(c) {
  const identity = normalizeCheckIdentity(c);
  // Identity must be present — structural name/type alone is insufficient
  if (!identity) return false;

  const type = String(c.type || '').toLowerCase();
  const name = String(c.name || '').toLowerCase();

  return (
    type === 'functional_acceptance' ||
    type === 'requirement'           ||
    type === 'acceptance_criteria'   ||
    name === 'requirement_acceptance' ||
    name === 'functional_acceptance'  ||
    name === 'acceptance'             ||
    // Presence of identity field alone is sufficient structural evidence
    true   // identity was already confirmed above; any check with an identity is req-level
  );
}

/**
 * Classifies executed sub-checks into an evidence category.
 */
function classifyExecutedChecks(checks = [], input = {}, _output = {}) {
  const realChecks = Array.isArray(checks)
    ? checks.filter((c) => c && !isDummyCheck(c))
    : [];

  // SECURITY: No real checks = INSPECTION regardless of output flags.
  if (realChecks.length === 0) return EVIDENCE_CATEGORIES.INSPECTION;

  let hasFunctional = false;
  let hasTest       = false;
  let hasBuild      = false;
  let hasVisual     = false;

  for (const c of realChecks) {
    const name = String(c.name || '').toLowerCase();
    const type = String(c.type || '').toLowerCase();
    const cmd  = String(c.command || '').toLowerCase();

    // Bypass B fix: a check is only functional when it carries an explicit requirement identity.
    if (isIdentityBoundRequirementCheck(c)) {
      hasFunctional = true;
    } else if (name === 'test' || type === 'test' || /test|pytest|unittest|jest|vitest|mocha/.test(cmd)) {
      hasTest = true;
    } else if (name === 'visual_verification' || type === 'visual' || /playwright\s+verify/.test(cmd) || c.screenshotPath) {
      hasVisual = true;
    } else if (name === 'build' || name === 'lint' || type === 'build' || /build|compile|lint/.test(cmd)) {
      hasBuild = true;
    }
    // Unknown check type: ignore for upward promotion; treated as build-level at most.
  }

  // SECURITY: Boolean output flags cannot boost hasFunctional here.

  if (hasFunctional) {
    const coverage = hasValidRequirementCoverage(input, {}, realChecks);
    // coverage === null → no explicit requirement scope → functional checks with
    //   identity bindings are sufficient; acceptance is based on executed check structure.
    // coverage === true → all scoped requirements have executed evidence.
    // coverage === false → explicit scope defined but some requirements uncovered.
    if (coverage === false) {
      if (hasTest)   return EVIDENCE_CATEGORIES.TEST;
      if (hasBuild)  return EVIDENCE_CATEGORIES.BUILD;
      if (hasVisual) return EVIDENCE_CATEGORIES.VISUAL;
      return EVIDENCE_CATEGORIES.INSPECTION;
    }
    return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
  }

  if (hasTest)   return EVIDENCE_CATEGORIES.TEST;
  if (hasBuild)  return EVIDENCE_CATEGORIES.BUILD;
  if (hasVisual) return EVIDENCE_CATEGORIES.VISUAL;
  return EVIDENCE_CATEGORIES.INSPECTION;
}

function classifyTool(toolName, input = {}, output = null, options = {}) {
  if (!toolName || typeof toolName !== 'string') return EVIDENCE_CATEGORIES.UNKNOWN;
  const name = toolName.trim().toLowerCase();

  // SECURITY: Never trust input.category or arbitrary output.evidenceCategory overrides.
  if (INSPECTION_TOOLS.has(name)) return EVIDENCE_CATEGORIES.INSPECTION;
  if (BUILD_TOOLS.has(name))      return EVIDENCE_CATEGORIES.BUILD;
  if (VISUAL_TOOLS.has(name))     return EVIDENCE_CATEGORIES.VISUAL;
  if (TEST_TOOLS.has(name))       return EVIDENCE_CATEGORIES.TEST;

  // Trusted functional-acceptance tools — require executed output.checks evidence.
  if (FUNCTIONAL_ACCEPTANCE_TOOLS.has(name)) {
    if (output && typeof output === 'object' && !Array.isArray(output)) {
      if (Array.isArray(output.checks)) {
        // Delegate to executed-checks classifier; flags inside output are ignored.
        return classifyExecutedChecks(output.checks, input, output);
      }
      // Output present but no checks array → no executed evidence.
      return EVIDENCE_CATEGORIES.INSPECTION;
    }
    // No output (plan-time). Accept only when explicit requirement scope is defined.
    // SECURITY: Tool name alone does not promote to FUNCTIONAL_ACCEPTANCE.
    if (options.isPlan) {
      const scope = resolveRequirementScope(input);
      if (scope !== null) return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
    }
    return EVIDENCE_CATEGORIES.INSPECTION;
  }

  // Name-prefix heuristics for unlisted tools
  if (/^(read|list|search|fetch|get|probe|inspect)/i.test(name)) return EVIDENCE_CATEGORIES.INSPECTION;
  if (/^(build|compile)/i.test(name))                            return EVIDENCE_CATEGORIES.BUILD;
  if (/^(screenshot|snapshot)/i.test(name))                      return EVIDENCE_CATEGORIES.VISUAL;
  if (/^(test|run_test)/i.test(name))                            return EVIDENCE_CATEGORIES.TEST;

  // SECURITY: verify_acceptance_* / verify_functional_* / assert_requirement_* name prefixes
  // are NOT in the trusted allowlist.  They require output.checks — name alone is insufficient.
  if (/^(verify_acceptance|verify_functional|assert_requirement)/i.test(name)) {
    if (output && typeof output === 'object' && !Array.isArray(output) && Array.isArray(output.checks)) {
      return classifyExecutedChecks(output.checks, input, output);
    }
    return EVIDENCE_CATEGORIES.INSPECTION;
  }

  // Terminal tool: classify by command content
  if (name === 'run_terminal' || name === 'sandbox_exec') {
    const cmd = String(input?.command || input?.cmd || '').toLowerCase();
    if (/npm\s+(run\s+)?(build|compile)|vite\s+build|tsc|webpack|next\s+build/.test(cmd)) return EVIDENCE_CATEGORIES.BUILD;
    if (/npm\s+(test|run\s+test)|jest|pytest|vitest|playwright\s+test|mocha/.test(cmd))   return EVIDENCE_CATEGORIES.TEST;
    if (/ls|dir|cat|grep|find|head|tail|pwd/.test(cmd))                                    return EVIDENCE_CATEGORIES.INSPECTION;
  }

  // Conservative fallback — never assume functional for unknown tools.
  return EVIDENCE_CATEGORIES.INSPECTION;
}

function classifyPlan(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return {
      evidenceLevel: 'INSPECTION_ONLY',
      hasInspection: false,
      hasBuild: false,
      hasVisual: false,
      hasTest: false,
      hasFunctionalAcceptance: false,
      isInspectionOnly: true
    };
  }

  const categories = steps.map((s) => classifyTool(s.tool, s.input, null, { isPlan: true }));
  const hasInspection        = categories.includes(EVIDENCE_CATEGORIES.INSPECTION);
  const hasBuild             = categories.includes(EVIDENCE_CATEGORIES.BUILD);
  const hasVisual            = categories.includes(EVIDENCE_CATEGORIES.VISUAL);
  const hasTest              = categories.includes(EVIDENCE_CATEGORIES.TEST);
  const hasFunctionalAcceptance = categories.includes(EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  const isInspectionOnly     = !hasBuild && !hasVisual && !hasTest && !hasFunctionalAcceptance;

  let evidenceLevel = 'INSPECTION_ONLY';
  if (hasFunctionalAcceptance) evidenceLevel = 'FUNCTIONAL_ACCEPTANCE';
  else if (hasTest)            evidenceLevel = 'TEST_ONLY';
  else if (hasBuild)           evidenceLevel = 'BUILD_ONLY';
  else if (hasVisual)          evidenceLevel = 'VISUAL_ONLY';

  return { evidenceLevel, hasInspection, hasBuild, hasVisual, hasTest, hasFunctionalAcceptance, isInspectionOnly };
}

function evaluateVerificationRun({ executedSteps = [], plan = null, fallbackReason = null }) {
  if (!Array.isArray(executedSteps) || executedSteps.length === 0) {
    const reason = fallbackReason || 'No verification steps executed';
    return {
      status: 'UNVERIFIED',
      verification_status: 'UNVERIFIED',
      evidenceLevel: 'INSPECTION_ONLY',
      acceptanceStatus: 'NOT_EVALUATED',
      summary: `Verification unverified: ${reason}.`,
      passedChecks: [],
      failedChecks: [],
      categories: []
    };
  }

  const classifiedSteps = executedSteps.map((step) => {
    // SECURITY: Always classify via trusted server-side logic; ignore step.category.
    const category = classifyTool(step.tool, step.input, step.output);

    // Sub-check failure propagation (verify_project sub-checks or test failures).
    // SECURITY: success:false overrides exitCode.
    let subCheckFailure = null;
    if (step.output && typeof step.output === 'object' && Array.isArray(step.output.checks)) {
      const realChecks = step.output.checks.filter((c) => c && !isDummyCheck(c));
      const failingCheck = realChecks.find((c) => !isCheckPassing(c));
      if (failingCheck) {
        subCheckFailure = failingCheck.stderr || failingCheck.stdout || failingCheck.error
          || `Check "${failingCheck.name || 'unnamed'}" failed`;
      }
    }

    const success = step.success !== false
      && !(step.output && typeof step.output === 'object' && step.output.success === false)
      && !step.error
      && !subCheckFailure;

    return {
      ...step,
      category,
      success,
      error: step.error || subCheckFailure || (step.output && typeof step.output === 'object' ? step.output.error : null)
    };
  });

  const failedSteps = classifiedSteps.filter((s) => !s.success);
  if (failedSteps.length > 0) {
    const firstFail = failedSteps[0];
    const failureMsg = firstFail.error
      || (firstFail.output && typeof firstFail.output === 'object' && (firstFail.output.error || firstFail.output.message))
      || `${firstFail.tool} did not confirm or failed execution`;
    return {
      status: 'FAILED',
      verification_status: 'FAILED',
      evidenceLevel: 'FAILED',
      acceptanceStatus: 'FAILED',
      summary: `Verification check failed on ${firstFail.tool}: ${failureMsg}`,
      passedChecks: classifiedSteps.filter((s) => s.success).map((s) => ({ tool: s.tool, category: s.category })),
      failedChecks: failedSteps.map((s) => ({ tool: s.tool, category: s.category, error: s.error || s.output?.error })),
      categories: Array.from(new Set(classifiedSteps.map((s) => s.category)))
    };
  }

  const passedSteps       = classifiedSteps.filter((s) => s.success);
  const passedCategories  = new Set(passedSteps.map((s) => s.category));
  const hasFunctionalAcceptance = passedCategories.has(EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  const hasTest           = passedCategories.has(EVIDENCE_CATEGORIES.TEST);
  const hasBuild          = passedCategories.has(EVIDENCE_CATEGORIES.BUILD);
  const hasVisual         = passedCategories.has(EVIDENCE_CATEGORIES.VISUAL);
  const isInspectionOnly  = passedCategories.size === 1 && passedCategories.has(EVIDENCE_CATEGORIES.INSPECTION);

  // Case 1: Inspection-only evidence
  if (isInspectionOnly || (!hasBuild && !hasVisual && !hasTest && !hasFunctionalAcceptance)) {
    const reason = fallbackReason || plan?.fallbackReason;
    const msg = reason
      ? `Verification unverified: ${reason}. Only passive workspace file inspection was performed.`
      : 'Verification unverified: Only passive workspace inspection was performed (e.g. read_file/list_directory/search_codebase); no build, test, or functional acceptance check was executed.';
    return {
      status: 'UNVERIFIED',
      verification_status: 'UNVERIFIED',
      evidenceLevel: 'INSPECTION_ONLY',
      acceptanceStatus: 'NOT_EVALUATED',
      summary: msg,
      passedChecks: passedSteps.map((s) => ({ tool: s.tool, category: s.category })),
      failedChecks: [],
      categories: ['INSPECTION']
    };
  }

  // Case 2: Functional acceptance checks passed
  if (hasFunctionalAcceptance) {
    return {
      status: 'SUCCEEDED',
      verification_status: 'PASSED',
      evidenceLevel: 'FUNCTIONAL_ACCEPTANCE',
      acceptanceStatus: 'SATISFIED',
      summary: 'Verification succeeded: Functional acceptance checks confirmed application requirements.',
      passedChecks: passedSteps.map((s) => ({ tool: s.tool, category: s.category })),
      failedChecks: [],
      categories: Array.from(passedCategories)
    };
  }

  // Case 3: Build/visual/test passed, but requirement-level acceptance untested
  const evidenceLabel  = hasTest ? 'Automated tests' : hasBuild ? 'Build' : 'Visual check';
  const evidenceLevel  = hasTest ? 'TEST_PASSED_ACCEPTANCE_UNTESTED'
    : hasBuild ? 'BUILD_PASSED_ACCEPTANCE_UNTESTED' : 'VISUAL_PASSED_ACCEPTANCE_UNTESTED';
  return {
    status: 'PARTIAL',
    verification_status: 'PARTIAL',
    evidenceLevel,
    acceptanceStatus: 'NOT_EVALUATED',
    summary: `Verification partial: ${evidenceLabel} passed, but requirement-level functional acceptance checks remain untested.`,
    passedChecks: passedSteps.map((s) => ({ tool: s.tool, category: s.category })),
    failedChecks: [],
    categories: Array.from(passedCategories)
  };
}

module.exports = {
  EVIDENCE_CATEGORIES,
  INSPECTION_TOOLS,
  BUILD_TOOLS,
  VISUAL_TOOLS,
  TEST_TOOLS,
  FUNCTIONAL_ACCEPTANCE_TOOLS,
  isDummyCheck,
  isCheckPassing,
  normalizeRequirementId,
  normalizeCheckIdentity,
  resolveRequirementScope,
  buildExecutedCoverageSet,
  hasValidRequirementCoverage,
  classifyExecutedChecks,
  classifyTool,
  classifyPlan,
  evaluateVerificationRun
};
