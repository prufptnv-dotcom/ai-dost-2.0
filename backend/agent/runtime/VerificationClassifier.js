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

const FUNCTIONAL_ACCEPTANCE_TOOLS = new Set([
  'verify_project',
  'verify_functional_acceptance',
  'verify_acceptance_criteria',
  'verify_user_flow'
]);

/**
 * Checks whether a check result is a dummy or placeholder check
 * (e.g., when verify_project found no scripts and returned name: 'none').
 */
function isDummyCheck(check) {
  if (!check || typeof check !== 'object') return true;
  const name = String(check.name || '').trim().toLowerCase();
  const cmd = String(check.command || '').trim().toLowerCase();
  const stdout = String(check.stdout || '').toLowerCase();
  if (name === 'none' || cmd === 'none' || name === 'dummy' || name === 'empty') return true;
  if (/no verification scripts found/i.test(stdout)) return true;
  return false;
}

/**
 * Validates requirement coverage when specific requirements were requested.
 */
function hasValidRequirementCoverage(input = {}, output = {}, checks = []) {
  const reqs = input?.requirements || input?.explicitRequirements || input?.features || input?.acceptanceCriteria;
  if (!reqs || !Array.isArray(reqs) || reqs.length === 0) {
    return true;
  }

  const coveredSet = new Set();
  const outputCovered = output?.satisfiedRequirements || output?.verifiedRequirements || output?.coveredRequirements || output?.requirements;
  if (Array.isArray(outputCovered)) {
    outputCovered.forEach((r) => {
      if (typeof r === 'string') coveredSet.add(r.trim().toLowerCase());
      else if (r && typeof r === 'object' && (r.id || r.requirementId || r.name)) {
        coveredSet.add(String(r.id || r.requirementId || r.name).trim().toLowerCase());
      }
    });
  }

  if (Array.isArray(checks)) {
    checks.forEach((c) => {
      if (c && !isDummyCheck(c) && (c.success === true || c.exitCode === 0)) {
        const id = c.requirementId || c.requirement || c.feature || c.criteria;
        if (id) coveredSet.add(String(id).trim().toLowerCase());
      }
    });
  }

  if (output?.functionalAcceptanceSatisfied === true || output?.allRequirementsSatisfied === true || output?.satisfied === true || output?.verified === true) {
    return true;
  }

  for (const r of reqs) {
    const target = (typeof r === 'string' ? r : (r?.id || r?.requirementId || r?.name || '')).trim().toLowerCase();
    if (!target) continue;
    let found = false;
    for (const covered of coveredSet) {
      if (covered.includes(target) || target.includes(covered)) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  return true;
}

/**
 * Classifies executed sub-checks into an evidence category.
 */
function classifyExecutedChecks(checks = [], input = {}, output = {}) {
  const realChecks = Array.isArray(checks) ? checks.filter((c) => c && !isDummyCheck(c)) : [];
  if (realChecks.length === 0) {
    if (output && typeof output === 'object') {
      if (output.functionalAcceptanceSatisfied === true || output.acceptanceCriteriaSatisfied === true || output.satisfied === true || output.verified === true) {
        if (hasValidRequirementCoverage(input, output, [])) {
          return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
        }
      }
    }
    return EVIDENCE_CATEGORIES.INSPECTION;
  }

  let hasFunctional = false;
  let hasTest = false;
  let hasBuild = false;
  let hasVisual = false;

  for (const c of realChecks) {
    const name = String(c.name || '').toLowerCase();
    const type = String(c.type || '').toLowerCase();
    const cmd = String(c.command || '').toLowerCase();

    const isExplicitReqCheck = (
      type === 'functional_acceptance' ||
      type === 'requirement' ||
      type === 'acceptance_criteria' ||
      name === 'requirement_acceptance' ||
      name === 'functional_acceptance' ||
      name === 'acceptance' ||
      Boolean(c.requirementId || c.requirement || c.criteria || c.acceptanceCriteria)
    );

    if (isExplicitReqCheck) {
      hasFunctional = true;
    } else if (name === 'test' || type === 'test' || /test|pytest|unittest|jest|vitest|mocha/.test(cmd)) {
      hasTest = true;
    } else if (name === 'visual_verification' || type === 'visual' || /playwright\s+verify/.test(cmd) || c.screenshotPath) {
      hasVisual = true;
    } else if (name === 'build' || name === 'lint' || type === 'build' || /build|compile|lint/.test(cmd)) {
      hasBuild = true;
    }
  }

  if (output && typeof output === 'object') {
    if (output.functionalAcceptanceSatisfied === true || output.acceptanceCriteriaSatisfied === true || output.satisfied === true || output.verified === true) {
      hasFunctional = true;
    }
  }

  if (hasFunctional) {
    if (!hasValidRequirementCoverage(input, output, realChecks)) {
      if (hasTest) return EVIDENCE_CATEGORIES.TEST;
      if (hasBuild) return EVIDENCE_CATEGORIES.BUILD;
      if (hasVisual) return EVIDENCE_CATEGORIES.VISUAL;
      return EVIDENCE_CATEGORIES.INSPECTION;
    }
    return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
  }

  if (hasTest) return EVIDENCE_CATEGORIES.TEST;
  if (hasBuild) return EVIDENCE_CATEGORIES.BUILD;
  if (hasVisual) return EVIDENCE_CATEGORIES.VISUAL;

  return EVIDENCE_CATEGORIES.INSPECTION;
}

function classifyTool(toolName, input = {}, output = null, options = {}) {
  if (!toolName || typeof toolName !== 'string') return EVIDENCE_CATEGORIES.UNKNOWN;
  const name = toolName.trim().toLowerCase();

  // SECURITY: Never trust input.category or arbitrary output.evidenceCategory overrides.
  // Planner-generated inputs or untrusted tool outputs cannot promote passive tools.
  if (INSPECTION_TOOLS.has(name)) return EVIDENCE_CATEGORIES.INSPECTION;
  if (BUILD_TOOLS.has(name)) return EVIDENCE_CATEGORIES.BUILD;
  if (VISUAL_TOOLS.has(name)) return EVIDENCE_CATEGORIES.VISUAL;
  if (TEST_TOOLS.has(name)) return EVIDENCE_CATEGORIES.TEST;

  // Functional acceptance tools (verify_project, verify_functional_acceptance, etc.)
  if (FUNCTIONAL_ACCEPTANCE_TOOLS.has(name)) {
    if (output && typeof output === 'object') {
      if (Array.isArray(output.checks)) {
        return classifyExecutedChecks(output.checks, input, output);
      }
      if (output.functionalAcceptanceSatisfied === true || output.acceptanceCriteriaSatisfied === true || output.satisfied === true || output.verified === true) {
        if (hasValidRequirementCoverage(input, output, [])) {
          return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
        }
      }
      return EVIDENCE_CATEGORIES.INSPECTION;
    }

    // Static plan classification (before execution) or dedicated acceptance tool capability
    if (name !== 'verify_project') {
      return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
    }

    if (options.isPlan || (input && (input.requirements || input.features || input.acceptanceCriteria))) {
      if (input?.requirements?.length || input?.features?.length) {
        return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
      }
    }
    // verify_project tool name alone without executed evidence or requirement scope cannot assume acceptance
    return EVIDENCE_CATEGORIES.INSPECTION;
  }

  // Name heuristic prefix matches
  if (/^(read|list|search|fetch|get|probe|inspect)/i.test(name)) return EVIDENCE_CATEGORIES.INSPECTION;
  if (/^(build|compile)/i.test(name)) return EVIDENCE_CATEGORIES.BUILD;
  if (/^(screenshot|snapshot)/i.test(name)) return EVIDENCE_CATEGORIES.VISUAL;
  if (/^(test|run_test)/i.test(name)) return EVIDENCE_CATEGORIES.TEST;
  if (/^(verify_acceptance|verify_functional|assert_requirement)/i.test(name)) {
    if (output && typeof output === 'object') {
      if (Array.isArray(output.checks)) return classifyExecutedChecks(output.checks, input, output);
      if (output.functionalAcceptanceSatisfied === true) return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
    }
    return EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE;
  }

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

  const categories = steps.map((s) => classifyTool(s.tool, s.input, null, { isPlan: true }));
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
    // SECURITY: Always derive category using trusted server-side tool classification.
    // Never trust arbitrary step.category or caller overrides.
    const category = classifyTool(step.tool, step.input, step.output);

    // Sub-check failure propagation (e.g. verify_project sub-checks or test failures)
    let subCheckFailure = null;
    if (step.output && typeof step.output === 'object' && Array.isArray(step.output.checks)) {
      const realChecks = step.output.checks.filter((c) => c && !isDummyCheck(c));
      const failingCheck = realChecks.find((c) => c.success === false || (typeof c.exitCode === 'number' && c.exitCode !== 0));
      if (failingCheck) {
        subCheckFailure = failingCheck.stderr || failingCheck.stdout || failingCheck.error || `Check "${failingCheck.name || 'unnamed'}" failed`;
      }
    }

    const success = step.success !== false &&
      !(step.output && typeof step.output === 'object' && step.output.success === false) &&
      !step.error &&
      !subCheckFailure;

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

  const passedSteps = classifiedSteps.filter((s) => s.success);
  const passedCategories = new Set(passedSteps.map((s) => s.category));
  const hasFunctionalAcceptance = passedCategories.has(EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  const hasTest = passedCategories.has(EVIDENCE_CATEGORIES.TEST);
  const hasBuild = passedCategories.has(EVIDENCE_CATEGORIES.BUILD);
  const hasVisual = passedCategories.has(EVIDENCE_CATEGORIES.VISUAL);
  const isInspectionOnly = passedCategories.size === 1 && passedCategories.has(EVIDENCE_CATEGORIES.INSPECTION);

  // Case 1: ONLY inspection evidence (read_file, list_directory, search_codebase, empty/dummy verify_project)
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

  // Case 2: Explicit functional acceptance check executed and passed
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

  // Case 3: Build, visual, or test passed, but requirement functional acceptance checks remain untested
  const evidenceLabel = hasTest ? 'Automated tests' : hasBuild ? 'Build' : 'Visual check';
  const evidenceLevel = hasTest ? 'TEST_PASSED_ACCEPTANCE_UNTESTED' : hasBuild ? 'BUILD_PASSED_ACCEPTANCE_UNTESTED' : 'VISUAL_PASSED_ACCEPTANCE_UNTESTED';
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
  hasValidRequirementCoverage,
  classifyExecutedChecks,
  classifyTool,
  classifyPlan,
  evaluateVerificationRun
};
