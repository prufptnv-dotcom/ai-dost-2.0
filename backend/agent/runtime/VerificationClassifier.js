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
 *    verified application checks (e.g. verify_project with acceptance criteria satisfied).
 *    Evidence proves specific requested functional features are verified working.
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
  'browser_snapshot'
]);

const TEST_TOOLS = new Set([
  'run_tests',
  'run_automated_tests',
  'test_project'
]);

const FUNCTIONAL_ACCEPTANCE_TOOLS = new Set([
  'verify_project',
  'verify_functional_acceptance',
  'verify_acceptance_criteria',
  'verify_user_flow'
]);

function classifyTool(toolName, input = {}, output = null) {
  if (!toolName || typeof toolName !== 'string') return EVIDENCE_CATEGORIES.UNKNOWN;
  const name = toolName.trim().toLowerCase();

  // Explicit category override if supplied
  if (input?.category && EVIDENCE_CATEGORIES[input.category]) return input.category;
  if (output?.evidenceCategory && EVIDENCE_CATEGORIES[output.evidenceCategory]) return output.evidenceCategory;

  if (INSPECTION_TOOLS.has(name)) return EVIDENCE_CATEGORIES.INSPECTION;
  if (BUILD_TOOLS.has(name)) return EVIDENCE_CATEGORIES.BUILD;
  if (VISUAL_TOOLS.has(name)) return EVIDENCE_CATEGORIES.VISUAL;
  if (TEST_TOOLS.has(name)) return EVIDENCE_CATEGORIES.TEST;
  if (FUNCTIONAL_ACCEPTANCE_TOOLS.has(name)) return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;

  // Name heuristic prefix matches
  if (/^(read|list|search|fetch|get|probe|inspect)/i.test(name)) return EVIDENCE_CATEGORIES.INSPECTION;
  if (/^(build|compile)/i.test(name)) return EVIDENCE_CATEGORIES.BUILD;
  if (/^(screenshot|snapshot)/i.test(name)) return EVIDENCE_CATEGORIES.VISUAL;
  if (/^(test|run_test)/i.test(name)) return EVIDENCE_CATEGORIES.TEST;
  if (/^(verify_acceptance|verify_functional|assert_requirement)/i.test(name)) return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;

  // Terminal tool inspection: check command
  if (name === 'run_terminal' || name === 'sandbox_exec') {
    const cmd = String(input?.command || input?.cmd || '').toLowerCase();
    if (/npm\s+(run\s+)?(build|compile)|vite\s+build|tsc|webpack|next\s+build/.test(cmd)) return EVIDENCE_CATEGORIES.BUILD;
    if (/npm\s+(test|run\s+test)|jest|pytest|vitest|playwright\s+test|mocha/.test(cmd)) return EVIDENCE_CATEGORIES.TEST;
    if (/ls|dir|cat|grep|find|head|tail|pwd/.test(cmd)) return EVIDENCE_CATEGORIES.INSPECTION;
  }

  // Safe conservative fallback for unknown tools: treat as INSPECTION, never assume functional!
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

  const categories = steps.map((s) => classifyTool(s.tool, s.input));
  const hasInspection = categories.includes(EVIDENCE_CATEGORIES.INSPECTION);
  const hasBuild = categories.includes(EVIDENCE_CATEGORIES.BUILD);
  const hasVisual = categories.includes(EVIDENCE_CATEGORIES.VISUAL);
  const hasTest = categories.includes(EVIDENCE_CATEGORIES.TEST);
  const hasFunctionalAcceptance = categories.includes(EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);

  const isInspectionOnly = !hasBuild && !hasVisual && !hasTest && !hasFunctionalAcceptance;

  let evidenceLevel = 'INSPECTION_ONLY';
  if (hasFunctionalAcceptance) {
    evidenceLevel = 'FUNCTIONAL_ACCEPTANCE';
  } else if (hasTest) {
    evidenceLevel = 'TEST_ONLY';
  } else if (hasBuild) {
    evidenceLevel = 'BUILD_ONLY';
  } else if (hasVisual) {
    evidenceLevel = 'VISUAL_ONLY';
  }

  return {
    evidenceLevel,
    hasInspection,
    hasBuild,
    hasVisual,
    hasTest,
    hasFunctionalAcceptance,
    isInspectionOnly
  };
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
    const category = step.category || classifyTool(step.tool, step.input, step.output);
    const success = step.success !== false &&
      !(step.output && typeof step.output === 'object' && step.output.success === false) &&
      !step.error;
    return {
      ...step,
      category,
      success
    };
  });

  const failedSteps = classifiedSteps.filter((s) => !s.success);
  if (failedSteps.length > 0) {
    const firstFail = failedSteps[0];
    const failureMsg = firstFail.error ||
      (firstFail.output && typeof firstFail.output === 'object' && (firstFail.output.error || firstFail.output.message)) ||
      `${firstFail.tool} did not confirm or failed execution`;
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

  const passedCategories = new Set(classifiedSteps.map((s) => s.category));
  const hasFunctionalAcceptance = passedCategories.has(EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  const hasTest = passedCategories.has(EVIDENCE_CATEGORIES.TEST);
  const hasBuild = passedCategories.has(EVIDENCE_CATEGORIES.BUILD);
  const hasVisual = passedCategories.has(EVIDENCE_CATEGORIES.VISUAL);
  const isInspectionOnly = passedCategories.size === 1 && passedCategories.has(EVIDENCE_CATEGORIES.INSPECTION);

  // Case 1: ONLY inspection evidence (read_file, list_directory, search_codebase)
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
      passedChecks: classifiedSteps.map((s) => ({ tool: s.tool, category: s.category })),
      failedChecks: [],
      categories: ['INSPECTION']
    };
  }

  // Case 2: Explicit functional acceptance check executed and passed
  if (hasFunctionalAcceptance) {
    return {
      status: 'SUCCEEDED',
      verification_status: 'PASSED',
      evidenceLevel: 'FUNCTIONAL_ACCEPTANCE',
      acceptanceStatus: 'SATISFIED',
      summary: 'Verification succeeded: Functional acceptance checks confirmed application requirements.',
      passedChecks: classifiedSteps.map((s) => ({ tool: s.tool, category: s.category })),
      failedChecks: [],
      categories: Array.from(passedCategories)
    };
  }

  // Case 3: Build, visual, or test passed, but requirement functional acceptance checks remain untested
  const evidenceLabel = hasTest ? 'Automated tests' : hasBuild ? 'Build' : 'Visual check';
  const evidenceLevel = hasTest ? 'TEST_PASSED_ACCEPTANCE_UNTESTED' : hasBuild ? 'BUILD_PASSED_ACCEPTANCE_UNTESTED' : 'VISUAL_PASSED_ACCEPTANCE_UNTESTED';
  return {
    status: 'PARTIAL',
    verification_status: 'PARTIAL',
    evidenceLevel,
    acceptanceStatus: 'NOT_EVALUATED',
    summary: `Verification partial: ${evidenceLabel} passed, but requirement-level functional acceptance checks remain untested.`,
    passedChecks: classifiedSteps.map((s) => ({ tool: s.tool, category: s.category })),
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
  classifyTool,
  classifyPlan,
  evaluateVerificationRun
};
