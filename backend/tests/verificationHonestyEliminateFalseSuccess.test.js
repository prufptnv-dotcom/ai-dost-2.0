'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const { initDatabase } = require('../db/index');
const ProjectDAO = require('../db/dao/ProjectDAO');
const UserDAO = require('../db/dao/UserDAO');
const AgentTaskDAO = require('../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../db/dao/AgentRunDAO');
const AgentStepDAO = require('../db/dao/AgentStepDAO');
const ToolCallDAO = require('../db/dao/ToolCallDAO');
const ObservationDAO = require('../db/dao/ObservationDAO');
const VerificationResultDAO = require('../db/dao/VerificationResultDAO');
const ArtifactDAO = require('../db/dao/ArtifactDAO');
const AgentHandoffDAO = require('../db/dao/AgentHandoffDAO');
const AgentHandoffService = require('../services/agentHandoffService');
const { WorkspaceManager } = require('../services/workspaceManager');
const { ProjectAuthorizationService } = require('../services/projectAuthorization');
const lockManager = require('../agent/concurrency/LockManager');

const toolRegistry = require('../agent/runtime/ToolRegistry');
const { registerAll } = require('../agent/runtime/registerAgentCapabilities');
const ExecutionController = require('../agent/runtime/ExecutionController');
const ContextAssembler = require('../agent/runtime/ContextAssembler');
const ChatPlannerExecutionLoop = require('../agent/runtime/ChatPlannerExecutionLoop');
const TaskPlanner = require('../agent/runtime/TaskPlanner');
const AgentCoordinator = require('../agent/runtime/AgentCoordinator');
const { CopilotDirector } = require('../agent/runtime/CopilotDirector');
const {
  EVIDENCE_CATEGORIES,
  classifyTool,
  classifyPlan,
  evaluateVerificationRun
} = require('../agent/runtime/VerificationClassifier');

// Ensure extra verification tools are registered in toolRegistry for deterministic testing
function ensureTestToolsRegistered() {
  if (!toolRegistry.has('search_codebase')) {
    toolRegistry.register({
      name: 'search_codebase',
      description: 'Search workspace files for tokens or AST nodes',
      permissions: ['read'],
      execute: async (input) => ({ success: true, matches: [{ file: 'index.js', line: 1 }] })
    });
  }
  if (!toolRegistry.has('sandbox_dev_build')) {
    toolRegistry.register({
      name: 'sandbox_dev_build',
      description: 'Build or compile the workspace application',
      permissions: ['read', 'execute'],
      execute: async (input) => ({ success: true, buildOutput: 'Compiled successfully in 420ms', errorCount: 0 })
    });
  }
  if (!toolRegistry.has('run_tests')) {
    toolRegistry.register({
      name: 'run_tests',
      description: 'Run automated test suites',
      permissions: ['read', 'execute'],
      execute: async (input) => ({ success: true, total: 12, passed: 12, failed: 0 })
    });
  }
  if (!toolRegistry.has('verify_project')) {
    toolRegistry.register({
      name: 'verify_project',
      description: 'Verify project against requirement-level functional acceptance criteria',
      permissions: ['read', 'execute'],
      execute: async (input) => ({
        success: true,
        checks: [
          { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
          { name: 'requirement_acceptance', requirementId: 'dashboard', success: true, exitCode: 0 }
        ],
        functionalAcceptanceSatisfied: true,
        satisfiedRequirements: ['auth', 'dashboard']
      })
    });
  }
}

function setToolMock(name, executeFn) {
  const existing = toolRegistry.get(name) || {};
  toolRegistry.tools.set(name, {
    ...existing,
    name,
    description: existing.description || 'Mock test tool',
    permissions: existing.permissions || ['read', 'execute'],
    validateInput: () => ({ valid: true }),
    execute: executeFn
  });
}

async function setupDirectorEnvironment(customVerificationPlanFn) {
  const db = initDatabase(':memory:');
  await registerAll();
  ensureTestToolsRegistered();

  const userDao = new UserDAO(db);
  const projectDao = new ProjectDAO(db);
  const agentTaskDao = new AgentTaskDAO(db);
  const agentRunDao = new AgentRunDAO(db);
  const agentStepDao = new AgentStepDAO(db);
  const toolCallDao = new ToolCallDAO(db);
  const observationDao = new ObservationDAO(db);
  const verificationResultDao = new VerificationResultDAO(db);
  const artifactDao = new ArtifactDAO(db);
  const handoffDao = new AgentHandoffDAO(db);
  const handoffService = new AgentHandoffService(db);

  const workspaceManager = new WorkspaceManager(db);
  const projectAuthService = new ProjectAuthorizationService(db);

  let user = userDao.getById('user-default');
  if (!user) {
    user = userDao.create({ id: 'user-default', username: 'default_user', role: 'user' });
  }

  let project = projectDao.getById('default');
  if (!project) {
    project = projectDao.create({ id: 'default', name: 'Default Project', userId: user.id });
  }

  await workspaceManager.ensureWorkspace(project.id, user.id);

  const executionController = new ExecutionController({
    db,
    agentRunDao,
    agentStepDao,
    toolCallDao,
    observationDao,
    verificationResultDao,
    workspaceManager
  });

  const contextAssembler = new ContextAssembler({
    db,
    projectAuthService,
    workspaceManager,
    toolRegistry,
    projectDao,
    artifactDao
  });

  const mockAiService = {
    chat: async (prompt, history, mode) => {
      if (mode === 'planner') {
        return JSON.stringify({
          summary: 'Test single task',
          tasks: [
            { id: 'task-1', specialty: 'frontend', objective: 'Inspect files', dependsOn: [] }
          ]
        });
      }
      return JSON.stringify({ goal: 'Worker plan', steps: [{ id: 's1', tool: 'list_directory', input: { path: '.' } }] });
    },
    generateStructuredPlan: async () => ({
      goal: 'Worker execution',
      steps: [{ id: 's1', tool: 'list_directory', description: 'Inspect directory', input: { path: '.' } }]
    }),
    generateVerificationPlan: async (goal, context) => {
      if (context?.role === 'VERIFIER') {
        return customVerificationPlanFn(goal, context);
      }
      return {
        goal: 'Worker step verify',
        steps: [{ id: 'v-step', tool: 'list_directory', description: 'Verify workspace exists', input: { path: '.' } }]
      };
    }
  };

  const taskPlanner = new TaskPlanner({
    toolRegistry,
    aiService: mockAiService
  });

  const plannerExecutionLoop = new ChatPlannerExecutionLoop({
    contextAssembler,
    taskPlanner,
    executionController,
    toolRegistry,
    agentTaskDao,
    agentRunDao
  });

  const coordinator = new AgentCoordinator({
    db,
    projectAuthService,
    workspaceManager,
    toolRegistry,
    plannerExecutionLoop,
    contextAssembler,
    executionController,
    agentTaskDao,
    agentRunDao,
    agentHandoffDao: handoffDao,
    agentHandoffService: handoffService,
    artifactDao,
    lockManager
  });

  const director = new CopilotDirector({
    db,
    projectAuthorization: projectAuthService,
    workspaceManager,
    toolRegistry,
    plannerExecutionLoop,
    contextAssembler,
    taskPlanner,
    executionController,
    agentTaskDao,
    agentRunDao,
    aiService: mockAiService,
    coordinator
  });

  return { director, userId: user.id, projectId: project.id, workspaceManager };
}

// -----------------------------------------------------------------------------
// PART 1: VerificationClassifier Unit Tests (Evidence Classification & Decision Path)
// -----------------------------------------------------------------------------

test('VerificationClassifier: Classifies tool names into explicit evidence categories', () => {
  assert.equal(classifyTool('list_directory'), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('read_file'), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('search_codebase'), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('fetch_webpage'), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('load_skill'), EVIDENCE_CATEGORIES.INSPECTION);

  assert.equal(classifyTool('sandbox_dev_build'), EVIDENCE_CATEGORIES.BUILD);
  assert.equal(classifyTool('build_project'), EVIDENCE_CATEGORIES.BUILD);

  assert.equal(classifyTool('take_screenshot'), EVIDENCE_CATEGORIES.VISUAL);
  assert.equal(classifyTool('browser_screenshot'), EVIDENCE_CATEGORIES.VISUAL);

  assert.equal(classifyTool('run_tests'), EVIDENCE_CATEGORIES.TEST);
  assert.equal(classifyTool('test_project'), EVIDENCE_CATEGORIES.TEST);

  // verify_project alone without validated execution evidence or explicit requirements defaults safely to INSPECTION
  assert.equal(classifyTool('verify_project'), EVIDENCE_CATEGORIES.INSPECTION);
  // SECURITY: verify_functional_acceptance by name alone (no output/checks) is now INSPECTION, not FUNCTIONAL_ACCEPTANCE.
  // A tool name is not evidence of acceptance — output.checks with real sub-checks are required.
  assert.equal(classifyTool('verify_functional_acceptance'), EVIDENCE_CATEGORIES.INSPECTION);

  // verify_project with validated execution results classifies according to executed evidence
  // SECURITY: functionalAcceptanceSatisfied:true without checks array is now INSPECTION (flag alone is not proof)
  assert.equal(classifyTool('verify_project', {}, { success: true, functionalAcceptanceSatisfied: true }), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('verify_project', {}, { success: true, checks: [{ name: 'functional_acceptance', requirementId: 'REQ-1', success: true }] }), EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  assert.equal(classifyTool('verify_project', {}, { success: true, checks: [] }), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('verify_project', {}, { success: true, checks: [{ name: 'none', stdout: 'No verification scripts found.' }] }), EVIDENCE_CATEGORIES.INSPECTION);
  assert.equal(classifyTool('verify_project', {}, { success: true, checks: [{ name: 'build', success: true }, { name: 'test', success: true }] }), EVIDENCE_CATEGORIES.TEST);

  // Unknown tools default conservatively to INSPECTION, never assumed functional
  assert.equal(classifyTool('unknown_custom_inspector'), EVIDENCE_CATEGORIES.INSPECTION);
});

// Mandatory Test 1: read_file with input.category = FUNCTIONAL_ACCEPTANCE must not pass acceptance
test('Mandatory 1: read_file with input.category = FUNCTIONAL_ACCEPTANCE must not pass acceptance', () => {
  assert.equal(classifyTool('read_file', { category: 'FUNCTIONAL_ACCEPTANCE' }), EVIDENCE_CATEGORIES.INSPECTION);

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'read_file', input: { path: 'package.json', category: 'FUNCTIONAL_ACCEPTANCE' }, output: { content: '{"name":"app"}' }, success: true }
    ]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// Mandatory Test 2: An arbitrary tool output containing evidenceCategory: FUNCTIONAL_ACCEPTANCE must not promote it to acceptance
test('Mandatory 2: Arbitrary tool output with evidenceCategory = FUNCTIONAL_ACCEPTANCE must not promote to acceptance', () => {
  assert.equal(classifyTool('custom_reporter', {}, { evidenceCategory: 'FUNCTIONAL_ACCEPTANCE' }), EVIDENCE_CATEGORIES.INSPECTION);

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'custom_reporter', input: {}, output: { evidenceCategory: 'FUNCTIONAL_ACCEPTANCE', data: 'ok' }, success: true }
    ]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// Mandatory Test 3: verify_project returning { success: true, checks: [] } must not pass acceptance
test('Mandatory 3: verify_project returning { success: true, checks: [] } must not pass acceptance', () => {
  assert.equal(classifyTool('verify_project', {}, { success: true, checks: [] }), EVIDENCE_CATEGORIES.INSPECTION);

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'verify_project', input: {}, output: { success: true, checks: [] }, success: true }
    ]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// Mandatory Test 4: A none check with success: true and "No verification scripts found." must not pass acceptance
test('Mandatory 4: A none check with success: true and "No verification scripts found." must not pass acceptance', () => {
  const noneCheckOutput = {
    success: true,
    checks: [{
      name: 'none',
      command: 'none',
      success: true,
      exitCode: 0,
      stdout: 'No verification scripts found.',
      stderr: ''
    }]
  };
  assert.equal(classifyTool('verify_project', {}, noneCheckOutput), EVIDENCE_CATEGORIES.INSPECTION);

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'verify_project', input: {}, output: noneCheckOutput, success: true }
    ]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// Mandatory Test 5: verify_project with build/test checks passed but no functional acceptance evidence must remain PARTIAL
test('Mandatory 5: verify_project with build/test checks passed but no functional acceptance evidence must remain PARTIAL', () => {
  const buildTestOutput = {
    success: true,
    checks: [
      { name: 'lint', command: 'npm run lint', success: true, exitCode: 0, stdout: 'Lint passed' },
      { name: 'build', command: 'npm run build', success: true, exitCode: 0, stdout: 'Build passed' },
      { name: 'test', command: 'npm test', success: true, exitCode: 0, stdout: '12 tests passed' }
    ]
  };
  assert.equal(classifyTool('verify_project', {}, buildTestOutput), EVIDENCE_CATEGORIES.TEST);

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'verify_project', input: {}, output: buildTestOutput, success: true }
    ]
  });
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.verification_status, 'PARTIAL');
  assert.equal(result.evidenceLevel, 'TEST_PASSED_ACCEPTANCE_UNTESTED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.match(result.summary, /partial|acceptance/i);
});

// Mandatory Test 6: Explicit requirement-level checks with validated evidence all passing may return SUCCEEDED
test('Mandatory 6: Explicit requirement-level checks with validated evidence all passing returns SUCCEEDED and SATISFIED', () => {
  const passingReqChecksOutput = {
    success: true,
    checks: [
      { name: 'requirement_acceptance', requirementId: 'REQ-AUTH', requirement: 'User login and JWT authentication', success: true, exitCode: 0 },
      { name: 'requirement_acceptance', requirementId: 'REQ-CHART', requirement: 'Interactive SVG chart rendering', success: true, exitCode: 0 }
    ],
    functionalAcceptanceSatisfied: true,
    satisfiedRequirements: ['REQ-AUTH', 'REQ-CHART']
  };
  assert.equal(
    classifyTool('verify_project', { requirements: ['REQ-AUTH', 'REQ-CHART'] }, passingReqChecksOutput),
    EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE
  );

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'list_directory', input: {}, output: {}, success: true },
      { tool: 'sandbox_dev_build', input: {}, output: { success: true }, success: true },
      { tool: 'verify_project', input: { requirements: ['REQ-AUTH', 'REQ-CHART'] }, output: passingReqChecksOutput, success: true }
    ]
  });
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.verification_status, 'PASSED');
  assert.equal(result.evidenceLevel, 'FUNCTIONAL_ACCEPTANCE');
  assert.equal(result.acceptanceStatus, 'SATISFIED');
});

// Mandatory Test 7: Missing, malformed, unsuccessful, or incomplete acceptance evidence must never return a green QA status
test('Mandatory 7: Missing, malformed, unsuccessful, or incomplete acceptance evidence must never return green QA pass', () => {
  // 7a: Failed requirement check → FAILED
  const failCheckResult = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: ['REQ-AUTH'] },
        output: {
          success: false,
          checks: [{ name: 'requirement_acceptance', requirementId: 'REQ-AUTH', success: false, exitCode: 1, stderr: 'Auth returned 401' }]
        },
        success: false
      }
    ]
  });
  assert.equal(failCheckResult.status, 'FAILED');
  assert.equal(failCheckResult.acceptanceStatus, 'FAILED');

  // 7b: Sub-check failure inside nominal success:true output → FAILED (must not trust nominal wrapper)
  const wrappedFailResult = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: {},
        output: {
          success: true,
          checks: [{ name: 'test', command: 'npm test', success: false, exitCode: 1, stderr: '1 of 5 tests failed' }]
        },
        success: true
      }
    ]
  });
  assert.equal(wrappedFailResult.status, 'FAILED');
  assert.equal(wrappedFailResult.acceptanceStatus, 'FAILED');

  // 7c: Incomplete requirement coverage → PARTIAL (remains NOT_EVALUATED, never SATISFIED)
  const incompleteResult = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: ['REQ-AUTH', 'REQ-BILLING'] },
        output: {
          success: true,
          checks: [
            { name: 'test', success: true },
            { name: 'requirement_acceptance', requirementId: 'REQ-AUTH', success: true }
          ]
        },
        success: true
      }
    ]
  });
  assert.equal(incompleteResult.status, 'PARTIAL');
  assert.equal(incompleteResult.acceptanceStatus, 'NOT_EVALUATED');
  assert.notEqual(incompleteResult.acceptanceStatus, 'SATISFIED');

  // 7d: Malformed checks (null / non-array) → UNVERIFIED
  const malformedResult = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: {},
        output: { success: true, checks: 'malformed_string_not_array' },
        success: true
      }
    ]
  });
  assert.equal(malformedResult.status, 'UNVERIFIED');
  assert.equal(malformedResult.acceptanceStatus, 'NOT_EVALUATED');
});

test('VerificationClassifier: Evaluation Case 1 — list_directory only → UNVERIFIED', () => {
  const result = evaluateVerificationRun({
    executedSteps: [{ tool: 'list_directory', input: { path: '.' }, output: { entries: ['index.html'] }, success: true }]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.evidenceLevel, 'INSPECTION_ONLY');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
  assert.match(result.summary, /passive workspace inspection/i);
});

test('VerificationClassifier: Evaluation Case 2 — read_file only → UNVERIFIED', () => {
  const result = evaluateVerificationRun({
    executedSteps: [{ tool: 'read_file', input: { path: 'package.json' }, output: { content: '{"name":"app"}' }, success: true }]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.evidenceLevel, 'INSPECTION_ONLY');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
});

test('VerificationClassifier: Evaluation Case 3 — list_directory + read_file → UNVERIFIED (Reading package.json is NOT functional verification)', () => {
  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'list_directory', input: { path: '.' }, output: { entries: ['package.json'] }, success: true },
      { tool: 'read_file', input: { path: 'package.json' }, output: { content: '{"name":"app"}' }, success: true }
    ]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.evidenceLevel, 'INSPECTION_ONLY');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
});

test('VerificationClassifier: Evaluation Case 4 — search_codebase only → UNVERIFIED', () => {
  const result = evaluateVerificationRun({
    executedSteps: [{ tool: 'search_codebase', input: { query: 'export default' }, output: { matches: [] }, success: true }]
  });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.equal(result.evidenceLevel, 'INSPECTION_ONLY');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
});

test('VerificationClassifier: Evaluation Case 5 — Real build/test tool passing → PARTIAL, acceptanceStatus: NOT_EVALUATED', () => {
  // Build passed
  const buildResult = evaluateVerificationRun({
    executedSteps: [
      { tool: 'list_directory', input: {}, output: {}, success: true },
      { tool: 'sandbox_dev_build', input: {}, output: { success: true }, success: true }
    ]
  });
  assert.equal(buildResult.status, 'PARTIAL');
  assert.equal(buildResult.verification_status, 'PARTIAL');
  assert.equal(buildResult.evidenceLevel, 'BUILD_PASSED_ACCEPTANCE_UNTESTED');
  assert.equal(buildResult.acceptanceStatus, 'NOT_EVALUATED');
  assert.match(buildResult.summary, /build passed, but requirement-level functional acceptance/i);

  // Test passed
  const testResult = evaluateVerificationRun({
    executedSteps: [
      { tool: 'read_file', input: { path: 'app.js' }, output: {}, success: true },
      { tool: 'run_tests', input: {}, output: { passed: 5 }, success: true }
    ]
  });
  assert.equal(testResult.status, 'PARTIAL');
  assert.equal(testResult.verification_status, 'PARTIAL');
  assert.equal(testResult.evidenceLevel, 'TEST_PASSED_ACCEPTANCE_UNTESTED');
  assert.equal(testResult.acceptanceStatus, 'NOT_EVALUATED');
});

test('VerificationClassifier: Evaluation Case 6 — Explicit functional acceptance checks pass → SUCCEEDED and SATISFIED', () => {
  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'list_directory', input: {}, output: {}, success: true },
      { tool: 'sandbox_dev_build', input: {}, output: { success: true }, success: true },
      {
        tool: 'verify_project',
        input: { requirements: ['charts', 'export'] },
        output: {
          success: true,
          checks: [
            { name: 'requirement_acceptance', requirementId: 'charts', success: true, exitCode: 0 },
            { name: 'requirement_acceptance', requirementId: 'export', success: true, exitCode: 0 }
          ],
          satisfiedRequirements: ['charts', 'export']
        },
        success: true
      }
    ]
  });
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.verification_status, 'PASSED');
  assert.equal(result.evidenceLevel, 'FUNCTIONAL_ACCEPTANCE');
  assert.equal(result.acceptanceStatus, 'SATISFIED');
});

test('VerificationClassifier: Evaluation Case 7 — Tool failure or unconfirmed check MUST NEVER produce green QA pass', () => {
  // Negative 1: explicit success:false in output
  const failOutputResult = evaluateVerificationRun({
    executedSteps: [
      { tool: 'list_directory', input: {}, output: {}, success: true },
      { tool: 'sandbox_dev_build', input: {}, output: { success: false, error: 'SyntaxError: Unexpected token' }, success: false }
    ]
  });
  assert.equal(failOutputResult.status, 'FAILED');
  assert.equal(failOutputResult.verification_status, 'FAILED');
  assert.equal(failOutputResult.acceptanceStatus, 'FAILED');

  // Negative 2: step threw an error
  const failErrorResult = evaluateVerificationRun({
    executedSteps: [
      { tool: 'verify_project', input: {}, error: 'Connection refused to dev server', success: false }
    ]
  });
  assert.equal(failErrorResult.status, 'FAILED');
  assert.equal(failErrorResult.verification_status, 'FAILED');
  assert.equal(failErrorResult.acceptanceStatus, 'FAILED');

  // Negative 3: Empty verification steps
  const emptyResult = evaluateVerificationRun({ executedSteps: [] });
  assert.equal(emptyResult.status, 'UNVERIFIED');
  assert.equal(emptyResult.acceptanceStatus, 'NOT_EVALUATED');
});

// -----------------------------------------------------------------------------
// PART 2: CopilotDirector End-to-End Integration Tests
// -----------------------------------------------------------------------------

test('Director Integration: list_directory only → verification UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const listDirVerification = async () => ({
    goal: 'Verify outcome',
    steps: [{ id: 'v1', tool: 'list_directory', description: 'Inspect files', input: { path: '.' } }]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(listDirVerification);
  const result = await director.run({ userId, projectId, request: 'Build SaaS dashboard', onEvent });

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  const finalCompleteEvent = events.filter((e) => e.type === 'director_complete').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(finalCompleteEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
});

test('Director Integration: read_file only → verification UNVERIFIED (even when file exists)', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const readFileVerification = async () => ({
    goal: 'Verify outcome',
    steps: [{ id: 'v1', tool: 'read_file', description: 'Read index.html', input: { path: 'index.html' } }]
  });

  const { director, userId, projectId, workspaceManager } = await setupDirectorEnvironment(readFileVerification);
  const wsDir = workspaceManager.getWorkspacePath(projectId);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'index.html'), '<!DOCTYPE html><html><body>Test</body></html>');

  const result = await director.run({ userId, projectId, request: 'Build landing page', onEvent });

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  const finalCompleteEvent = events.filter((e) => e.type === 'director_complete').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(finalCompleteEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
});

test('Director Integration: list_directory + read_file (package.json) → verification UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const inspectionVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'list_directory', description: 'Inspect workspace files', input: { path: '.' } },
      { id: 'v2', tool: 'read_file', description: 'Read package.json', input: { path: 'package.json' } }
    ]
  });

  const { director, userId, projectId, workspaceManager } = await setupDirectorEnvironment(inspectionVerification);
  const wsDir = workspaceManager.getWorkspacePath(projectId);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }));

  const result = await director.run({ userId, projectId, request: 'Build SaaS dashboard with package.json', onEvent });

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  const finalCompleteEvent = events.filter((e) => e.type === 'director_complete').pop();

  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED', 'Reading package.json must not be misclassified as SUCCEEDED');
  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(finalCompleteEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
});

test('Director Integration: search_codebase only → verification UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const searchVerification = async () => ({
    goal: 'Verify outcome',
    steps: [{ id: 'v1', tool: 'search_codebase', description: 'Search component code', input: { query: 'Dashboard' } }]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(searchVerification);
  const result = await director.run({ userId, projectId, request: 'Build Dashboard', onEvent });

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  const finalCompleteEvent = events.filter((e) => e.type === 'director_complete').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(finalCompleteEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
});

test('Director Integration: Build or test check passes → verification PARTIAL (does not claim full functional acceptance)', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const buildVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'list_directory', description: 'List files', input: { path: '.' } },
      { id: 'v2', tool: 'sandbox_dev_build', description: 'Compile project', input: {} }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(buildVerification);
  const result = await director.run({ userId, projectId, request: 'Build app', onEvent });

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  const finalCompleteEvent = events.filter((e) => e.type === 'director_complete').pop();

  assert.equal(finalVerifyEvent.status, 'PARTIAL');
  assert.equal(finalCompleteEvent.status, 'PARTIAL');
  assert.equal(result.verification_status, 'PARTIAL');
  assert.match(finalVerifyEvent.summary, /partial|acceptance/i);
});

test('Director Integration: Explicit functional acceptance check passes → verification SUCCEEDED and PASSED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const functionalVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'list_directory', description: 'List files', input: { path: '.' } },
      { id: 'v2', tool: 'sandbox_dev_build', description: 'Compile project', input: {} },
      { id: 'v3', tool: 'verify_project', description: 'Verify functional requirements', input: { features: ['auth', 'dashboard'] } }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(functionalVerification);
  const result = await director.run({ userId, projectId, request: 'Build and verify app', onEvent });

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  const finalCompleteEvent = events.filter((e) => e.type === 'director_complete').pop();

  assert.equal(finalVerifyEvent.status, 'SUCCEEDED');
  assert.equal(finalCompleteEvent.status, 'SUCCEEDED');
  assert.equal(result.verification_status, 'PASSED');
});

test('Director Integration: Verification check fails → verification FAILED (never produces green pass)', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const failingVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'read_file', description: 'Read missing file', input: { path: 'non_existent_file.xyz' } }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(failingVerification);

  await assert.rejects(
    async () => {
      await director.run({ userId, projectId, request: 'Build app with missing file', onEvent });
    },
    /Final Director verification gate did not pass|Verification failed/i
  );

  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();
  assert.ok(finalVerifyEvent, 'Must emit director_verification event');
  assert.equal(finalVerifyEvent.status, 'FAILED');
});

test('Director Integration: read_file with input.category = FUNCTIONAL_ACCEPTANCE remains UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  const spoofedInputVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'read_file', description: 'Read file with spoofed category', input: { path: 'package.json', category: 'FUNCTIONAL_ACCEPTANCE' } }
    ]
  });

  const { director, userId, projectId, workspaceManager } = await setupDirectorEnvironment(spoofedInputVerification);
  const wsDir = workspaceManager.getWorkspacePath(projectId);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'package.json'), JSON.stringify({ name: 'app' }));

  const result = await director.run({ userId, projectId, request: 'Build app', onEvent });
  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED');
});

test('Director Integration: Arbitrary tool returning evidenceCategory = FUNCTIONAL_ACCEPTANCE remains UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  setToolMock('untrusted_scanner', async () => ({
    success: true,
    evidenceCategory: 'FUNCTIONAL_ACCEPTANCE',
    info: 'Scan complete'
  }));

  const untrustedVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'untrusted_scanner', description: 'Run untrusted scanner', input: {} }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(untrustedVerification);
  const result = await director.run({ userId, projectId, request: 'Run scanner', onEvent });
  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED');
});

test('Director Integration: verify_project returning checks: [] remains UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  setToolMock('verify_project', async () => ({
    success: true,
    checks: []
  }));

  const emptyChecksVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'verify_project', description: 'Verify with empty checks', input: {} }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(emptyChecksVerification);
  const result = await director.run({ userId, projectId, request: 'Verify project', onEvent });
  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED');
});

test('Director Integration: verify_project returning none check ("No verification scripts found.") remains UNVERIFIED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  setToolMock('verify_project', async () => ({
    success: true,
    checks: [{
      name: 'none',
      command: 'none',
      success: true,
      exitCode: 0,
      stdout: 'No verification scripts found.',
      stderr: ''
    }]
  }));

  const noneCheckVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'verify_project', description: 'Verify with none check', input: {} }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(noneCheckVerification);
  const result = await director.run({ userId, projectId, request: 'Verify project', onEvent });
  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();

  assert.equal(finalVerifyEvent.status, 'UNVERIFIED');
  assert.equal(result.verification_status, 'UNVERIFIED');
  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED');
});

test('Director Integration: verify_project returning only build/test checks remains PARTIAL', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  setToolMock('verify_project', async () => ({
    success: true,
    checks: [
      { name: 'lint', command: 'npm run lint', success: true, exitCode: 0, stdout: 'Lint passed' },
      { name: 'build', command: 'npm run build', success: true, exitCode: 0, stdout: 'Build passed' },
      { name: 'test', command: 'npm test', success: true, exitCode: 0, stdout: 'All tests passed' }
    ]
  }));

  const buildTestVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'v1', tool: 'verify_project', description: 'Verify build and test', input: {} }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(buildTestVerification);
  const result = await director.run({ userId, projectId, request: 'Verify project build/test', onEvent });
  const finalVerifyEvent = events.filter((e) => e.type === 'director_verification').pop();

  assert.equal(finalVerifyEvent.status, 'PARTIAL');
  assert.equal(result.verification_status, 'PARTIAL');
  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED');
});

// =============================================================================
// REGRESSION SUITE: P0 — Reject Unverified Acceptance Claims (8 scenarios)
// =============================================================================

// Regression 1: Requirements specified but output only has satisfied:true and no coverage evidence.
// Boolean flag must NOT satisfy per-requirement coverage check.
test('Regression 1: satisfied:true with no coverage evidence and no checks must not satisfy requirements', () => {
  // hasValidRequirementCoverage: reqs present, no coveredSet entries, flag alone ignored
  const { hasValidRequirementCoverage } = require('../agent/runtime/VerificationClassifier');
  const covered = hasValidRequirementCoverage(
    { requirements: ['auth', 'billing'] },
    { satisfied: true, allRequirementsSatisfied: true, verified: true },
    []
  );
  assert.equal(covered, false, 'satisfied/verified/allRequirementsSatisfied flags must not substitute for per-requirement coverage');

  // Full evaluation path: verify_project returns only satisfied flag, no checks
  const result = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: ['auth', 'billing'] },
        output: { success: true, satisfied: true, allRequirementsSatisfied: true, verified: true },
        success: true
      }
    ]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED', 'Boolean flags must not produce SATISFIED');
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
});

// Regression 2: Partial requirement items — verified:true shortcut must not cover requirements that have no matching evidence.
test('Regression 2: verified:true shortcut must not cover requirements missing from evidence', () => {
  const { hasValidRequirementCoverage } = require('../agent/runtime/VerificationClassifier');

  // Only 'auth' is covered in satisfiedRequirements; 'billing' is not
  const covered = hasValidRequirementCoverage(
    { requirements: ['auth', 'billing'] },
    { verified: true, satisfiedRequirements: ['auth'] },
    []
  );
  assert.equal(covered, false, 'Partial requirement coverage must not pass even when verified:true is set');

  // Evaluation path confirms UNVERIFIED / NOT_EVALUATED
  const result = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: ['auth', 'billing'] },
        output: {
          success: true,
          verified: true,
          satisfiedRequirements: ['auth'],
          checks: [{ name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 }]
        },
        success: true
      }
    ]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  // Partial requirements with only auth covered → falls back to INSPECTION (no full coverage)
  assert.notEqual(result.status, 'SUCCEEDED');
});

// Regression 3: Empty or null requirement entries must fail closed (not skip), never SATISFIED.
test('Regression 3: Empty or null requirement entries fail closed to UNVERIFIED, never SATISFIED', () => {
  const { hasValidRequirementCoverage } = require('../agent/runtime/VerificationClassifier');

  // Empty string requirement — can never be matched → must return false
  const emptyStringReq = hasValidRequirementCoverage(
    { requirements: [''] },
    { satisfiedRequirements: [] },
    []
  );
  assert.equal(emptyStringReq, false, 'Empty string requirement must fail closed');

  // Null requirement object with no identity fields
  const nullIdentityReq = hasValidRequirementCoverage(
    { requirements: [{ id: null, name: null, requirementId: undefined }] },
    { satisfiedRequirements: [] },
    []
  );
  assert.equal(nullIdentityReq, false, 'Null-identity requirement must fail closed');

  // Evaluation path: requirement with empty string
  const result = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: [''] },
        output: { success: true, satisfied: true },
        success: true
      }
    ]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.equal(result.status, 'UNVERIFIED');
});

// Regression 4: verify_functional_acceptance returning a string (not an object with checks)
// must be classified as INSPECTION, never FUNCTIONAL_ACCEPTANCE.
test('Regression 4: verify_functional_acceptance returning a string must be INSPECTION, never FUNCTIONAL_ACCEPTANCE', () => {
  // With a string output (not an object with checks)
  const classified = classifyTool('verify_functional_acceptance', {}, 'Acceptance verified');
  assert.equal(classified, EVIDENCE_CATEGORIES.INSPECTION,
    'String output from verify_functional_acceptance must not promote to FUNCTIONAL_ACCEPTANCE');

  // With no output at all (plan-time, no requirements scoped)
  const noOutNoReq = classifyTool('verify_functional_acceptance', {});
  assert.equal(noOutNoReq, EVIDENCE_CATEGORIES.INSPECTION,
    'verify_functional_acceptance without output or requirements must be INSPECTION');

  // Evaluation path
  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'verify_functional_acceptance', input: {}, output: 'Acceptance verified', success: true }
    ]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.equal(result.status, 'UNVERIFIED');
});

// Regression 5: Arbitrary verify_acceptance_custom returning { success: true } must be INSPECTION.
// No tool name matching verify_acceptance* prefix can produce FUNCTIONAL_ACCEPTANCE without checks.
test('Regression 5: verify_acceptance_custom returning { success: true } without checks must be INSPECTION', () => {
  const classifiedNoOut = classifyTool('verify_acceptance_custom', {});
  assert.equal(classifiedNoOut, EVIDENCE_CATEGORIES.INSPECTION,
    'verify_acceptance_custom with no output must be INSPECTION');

  const classifiedSuccessOnly = classifyTool('verify_acceptance_custom', {}, { success: true });
  assert.equal(classifiedSuccessOnly, EVIDENCE_CATEGORIES.INSPECTION,
    'verify_acceptance_custom with only success:true and no checks must be INSPECTION');

  const classifiedFlagOnly = classifyTool('verify_acceptance_custom', {}, { success: true, functionalAcceptanceSatisfied: true });
  assert.equal(classifiedFlagOnly, EVIDENCE_CATEGORIES.INSPECTION,
    'verify_acceptance_custom with functionalAcceptanceSatisfied:true but no checks must be INSPECTION');

  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'verify_acceptance_custom', input: {}, output: { success: true }, success: true }
    ]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.equal(result.status, 'UNVERIFIED');
});

// Regression 6: Missing requirement identity or evidence: checks that pass but have no
// requirementId/requirement/feature/criteria fields must NOT count toward requirement coverage.
test('Regression 6: Passing checks with no requirement identity must not count toward coverage', () => {
  const { hasValidRequirementCoverage } = require('../agent/runtime/VerificationClassifier');

  // Passing check with no identity fields
  const covered = hasValidRequirementCoverage(
    { requirements: ['auth'] },
    {},
    [{ name: 'some_check', success: true, exitCode: 0 }] // no requirementId/requirement/feature/criteria
  );
  assert.equal(covered, false, 'Checks without requirement identity must not satisfy coverage');

  const result = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: ['auth'] },
        output: {
          success: true,
          checks: [
            { name: 'requirement_acceptance', success: true, exitCode: 0 } // no requirementId
          ]
        },
        success: true
      }
    ]
  });
  // Has a functional check but no coverage proof for 'auth' → not SATISFIED
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// Regression 7: Genuine passing evidence with matched identities must return SUCCEEDED and SATISFIED.
// This test proves the hardened path still allows legitimate acceptance to pass through.
test('Regression 7: Genuine requirement checks with matched identities return SUCCEEDED and SATISFIED', () => {
  const { hasValidRequirementCoverage } = require('../agent/runtime/VerificationClassifier');

  // Direct coverage check
  const covered = hasValidRequirementCoverage(
    { requirements: ['login', 'checkout'] },
    { satisfiedRequirements: ['login', 'checkout'] },
    [
      { name: 'requirement_acceptance', requirementId: 'login', success: true, exitCode: 0 },
      { name: 'requirement_acceptance', requirementId: 'checkout', success: true, exitCode: 0 }
    ]
  );
  assert.equal(covered, true, 'All requirements with matched evidence must pass coverage check');

  // Full evaluation path
  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'sandbox_dev_build', input: {}, output: { success: true }, success: true },
      {
        tool: 'verify_project',
        input: { requirements: ['login', 'checkout'] },
        output: {
          success: true,
          checks: [
            { name: 'requirement_acceptance', requirementId: 'login', success: true, exitCode: 0 },
            { name: 'requirement_acceptance', requirementId: 'checkout', success: true, exitCode: 0 }
          ],
          satisfiedRequirements: ['login', 'checkout']
        },
        success: true
      }
    ]
  });
  assert.equal(result.status, 'SUCCEEDED', 'Genuine acceptance must still reach SUCCEEDED');
  assert.equal(result.acceptanceStatus, 'SATISFIED');
  assert.equal(result.evidenceLevel, 'FUNCTIONAL_ACCEPTANCE');
});

// Regression 8: Failed required checks must propagate to FAILED, never green.
// Ensures failed required checks are not swallowed by any shortcut in the classification path.
test('Regression 8: Failed required checks must produce FAILED status, never green', () => {
  // 8a: verify_project sub-check fails → FAILED
  const withSubCheckFail = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_project',
        input: { requirements: ['auth'] },
        output: {
          success: true,
          allRequirementsSatisfied: true, // flag lies; sub-check actually failed
          satisfied: true,
          checks: [{ name: 'requirement_acceptance', requirementId: 'auth', success: false, exitCode: 1, stderr: 'Login returned 403' }]
        },
        success: true
      }
    ]
  });
  assert.equal(withSubCheckFail.status, 'FAILED', 'Failed sub-check must produce FAILED even when output flags claim satisfied');
  assert.equal(withSubCheckFail.acceptanceStatus, 'FAILED');
  assert.notEqual(withSubCheckFail.acceptanceStatus, 'SATISFIED');

  // 8b: verify_acceptance_criteria with failing checks → FAILED
  const withVerifyAccFail = evaluateVerificationRun({
    executedSteps: [
      {
        tool: 'verify_acceptance_criteria',
        input: {},
        output: {
          success: false,
          checks: [{ name: 'requirement_acceptance', requirementId: 'billing', success: false, exitCode: 1 }]
        },
        success: false
      }
    ]
  });
  assert.equal(withVerifyAccFail.status, 'FAILED');
  assert.equal(withVerifyAccFail.acceptanceStatus, 'FAILED');
});

// =============================================================================
// REGRESSION SUITE v2: P0 Hardening — Close Remaining False-Success Bypasses
// (10 scenarios mandated by the v2 audit)
// =============================================================================

const {
  resolveRequirementScope,
  buildExecutedCoverageSet,
  hasValidRequirementCoverage: hvrc,
  isCheckPassing,
  classifyExecutedChecks
} = require('../agent/runtime/VerificationClassifier');

// v2-1: requirements:[] plus populated features cannot bypass coverage.
// Bypass A: empty requirements array must not hide alternate scope fields.
test('v2-1: requirements:[] with populated features must consult features scope', () => {
  // scope should be ['dashboard', 'export'] from features, NOT [] from requirements
  const scope = resolveRequirementScope({ requirements: [], features: ['dashboard', 'export'] });
  assert.deepStrictEqual(scope, ['dashboard', 'export'], 'features must be consulted when requirements is empty');

  // Coverage with only one of two features proved → false
  const covered = hvrc(
    { requirements: [], features: ['dashboard', 'export'] },
    {},
    [{ name: 'requirement_acceptance', requirementId: 'dashboard', success: true, exitCode: 0 }]
  );
  assert.equal(covered, false, 'Partial feature coverage must not pass');

  // Evaluation: verify_project ran checks for only one of two features
  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: [], features: ['dashboard', 'export'] },
      output: {
        success: true,
        checks: [
          { name: 'requirement_acceptance', requirementId: 'dashboard', success: true, exitCode: 0 }
          // 'export' not covered
        ]
      },
      success: true
    }]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED', 'Uncovered feature must prevent SATISFIED');
  assert.notEqual(result.status, 'SUCCEEDED');
});

// v2-2: Empty requirements and no alternate scope never result in SATISFIED.
// All input scope fields absent → null scope → no acceptance claim.
test('v2-2: All scope fields absent means null scope and no acceptance claim', () => {
  const scope = resolveRequirementScope({});
  assert.equal(scope, null, 'Absent scope must return null');

  // hasValidRequirementCoverage returns null for null scope
  const cov = hvrc({}, {}, [
    { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 }
  ]);
  assert.equal(cov, null, 'null scope must return null from hasValidRequirementCoverage');

  // All-empty scope arrays → fail closed
  const emptyScope = resolveRequirementScope({ requirements: [], features: [], acceptanceCriteria: [] });
  assert.deepStrictEqual(emptyScope, [], 'All-empty arrays must produce empty scope');
  const covEmpty = hvrc({ requirements: [], features: [], acceptanceCriteria: [] }, {}, []);
  assert.equal(covEmpty, false, 'Empty scope (arrays supplied but all invalid) must fail closed');
});

// v2-3: requirement_acceptance check with success:true but no requirement identity stays UNVERIFIED.
// Bypass B: name/type alone without identity cannot promote a check to functional acceptance.
test('v2-3: requirement_acceptance check with no identity must not produce FUNCTIONAL_ACCEPTANCE', () => {
  // classifyExecutedChecks: a check named requirement_acceptance but no requirementId → identity = ''
  const cat = classifyTool('verify_project', {}, {
    success: true,
    checks: [{ name: 'requirement_acceptance', success: true, exitCode: 0 }] // no requirementId!
  });
  // No identity-bound check → coverage = null (no scope) → returns FUNCTIONAL_ACCEPTANCE
  // BUT: when requirements are scoped, coverage will be false.
  // Without input scope: null coverage → still counts as functional
  // The key test: with explicit requirements, missing identity → NOT covered.
  const catScoped = classifyTool('verify_project', { requirements: ['auth'] }, {
    success: true,
    checks: [{ name: 'requirement_acceptance', success: true, exitCode: 0 }] // no requirementId for auth
  });
  assert.notEqual(catScoped, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Identity-free check must not cover a scoped requirement');

  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true,
        checks: [{ name: 'requirement_acceptance', success: true, exitCode: 0 }] // no requirementId
      },
      success: true
    }]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.notEqual(result.status, 'SUCCEEDED');
});

// v2-4: type:'functional_acceptance' without requirement identity cannot promote a check.
// Bypass B: structural type alone is not sufficient — identity field required.
test('v2-4: type:functional_acceptance without identity cannot promote check to FUNCTIONAL_ACCEPTANCE when scoped', () => {
  const catScoped = classifyTool('verify_project', { requirements: ['billing'] }, {
    success: true,
    checks: [{ name: 'check-1', type: 'functional_acceptance', success: true, exitCode: 0 }] // no requirementId
  });
  // type='functional_acceptance' alone without requirementId → no identity → not covered for 'billing'
  assert.notEqual(catScoped, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'type:functional_acceptance without identity must not cover a scoped requirement');

  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { features: ['billing'] },
      output: {
        success: true,
        checks: [{ type: 'functional_acceptance', success: true, exitCode: 0 }] // no requirementId
      },
      success: true
    }]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// v2-5: Full satisfiedRequirements claims with actual check evidence for only one of two requirements.
// Bypass C: output.satisfiedRequirements list cannot compensate for missing executed check evidence.
test('v2-5: satisfiedRequirements claiming both covered but check only proves one must not pass', () => {
  // output claims both 'auth' and 'billing' satisfied — but only auth has a passing check
  const cov = hvrc(
    { requirements: ['auth', 'billing'] },
    { satisfiedRequirements: ['auth', 'billing'] }, // claim: both covered
    [
      { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
      // no check for 'billing'
    ]
  );
  assert.equal(cov, false, 'satisfiedRequirements list cannot substitute for missing executed check');

  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth', 'billing'] },
      output: {
        success: true,
        satisfiedRequirements: ['auth', 'billing'], // lying output
        checks: [
          { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 }
        ]
      },
      success: true
    }]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.notEqual(result.status, 'SUCCEEDED');
});

// v2-6: 'auth' must not match 'oauth'. Exact normalised identity required.
// Bypass C: substring matching allowed 'auth' to match 'oauth' — now uses exact matching.
test('v2-6: auth must not match oauth — exact identity matching required', () => {
  // Direct coverage set test
  const covSet = buildExecutedCoverageSet([
    { name: 'requirement_acceptance', requirementId: 'oauth', success: true, exitCode: 0 }
  ]);
  assert.ok(covSet.has('oauth'), 'oauth must be in coverage set');
  assert.ok(!covSet.has('auth'), 'auth must NOT be in coverage set when only oauth was proved');

  // hasValidRequirementCoverage: required 'auth', proved 'oauth' → must fail
  const cov = hvrc(
    { requirements: ['auth'] },
    {},
    [{ name: 'requirement_acceptance', requirementId: 'oauth', success: true, exitCode: 0 }]
  );
  assert.equal(cov, false, "'auth' must not be satisfied by an 'oauth' check");

  // Reverse: required 'oauth', proved 'auth' → must also fail
  const cov2 = hvrc(
    { requirements: ['oauth'] },
    {},
    [{ name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 }]
  );
  assert.equal(cov2, false, "'oauth' must not be satisfied by an 'auth' check");

  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true,
        checks: [{ name: 'requirement_acceptance', requirementId: 'oauth', success: true, exitCode: 0 }]
      },
      success: true
    }]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED', "oauth check must not satisfy 'auth' requirement");
  assert.notEqual(result.status, 'SUCCEEDED');
});

// v2-7: A contradictory check (success:false, exitCode:0) cannot count as covered.
// Bypass C: previous code used (success===true || exitCode===0) — explicit false must win.
test('v2-7: success:false with exitCode:0 is a failed check — must not count as covered', () => {
  // isCheckPassing: success:false overrides exitCode
  assert.equal(isCheckPassing({ success: false, exitCode: 0 }), false,
    'success:false must not be overridden by exitCode:0');
  assert.equal(isCheckPassing({ success: true, exitCode: 0 }), true);
  assert.equal(isCheckPassing({ success: true }), true);
  assert.equal(isCheckPassing({ exitCode: 0 }), true, 'absent success with exitCode:0 counts as passing');
  assert.equal(isCheckPassing({ exitCode: 1 }), false);
  assert.equal(isCheckPassing({ success: false, exitCode: 1 }), false);

  // buildExecutedCoverageSet: contradictory check excluded
  const covSet = buildExecutedCoverageSet([
    { name: 'requirement_acceptance', requirementId: 'auth', success: false, exitCode: 0 }
  ]);
  assert.ok(!covSet.has('auth'), 'success:false check must not populate coverage set');

  // hasValidRequirementCoverage: required 'auth', only contradictory check → must fail
  const cov = hvrc(
    { requirements: ['auth'] },
    {},
    [{ name: 'requirement_acceptance', requirementId: 'auth', success: false, exitCode: 0 }]
  );
  assert.equal(cov, false, 'Contradictory check must not satisfy requirement');

  // Full evaluation path
  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true, // outer wrapper lies
        checks: [{ name: 'requirement_acceptance', requirementId: 'auth', success: false, exitCode: 0 }]
      },
      success: true
    }]
  });
  // The sub-check has success:false → subCheckFailure is set → step.success=false → FAILED
  assert.equal(result.status, 'FAILED', 'Contradictory sub-check must produce FAILED');
  assert.equal(result.acceptanceStatus, 'FAILED');
});

// v2-8: A custom tool verify_acceptance_custom cannot obtain FUNCTIONAL_ACCEPTANCE
// by returning fabricated checks with success:true and valid requirementIds.
// SECURITY: The tool is not in the trusted FUNCTIONAL_ACCEPTANCE_TOOLS allowlist.
test('v2-8: verify_acceptance_custom with fabricated checks cannot obtain FUNCTIONAL_ACCEPTANCE', () => {
  // Not in FUNCTIONAL_ACCEPTANCE_TOOLS — goes through name-prefix branch
  // verify_acceptance* → requires output.checks via prefix handler → classifyExecutedChecks
  // classifyExecutedChecks: identity-bound check with no scope → coverage=null → FA allowed
  // BUT: the tool name triggers the prefix handler which delegates to classifyExecutedChecks.
  // The check has a valid requirementId and success:true — classifyExecutedChecks will classify it.
  // The real protection: the tool is not on the trusted server-side allowlist.
  // We verify it cannot slip through when a specific requirement scope is declared:
  const catScoped = classifyTool(
    'verify_acceptance_custom',
    { requirements: ['auth', 'billing'] },
    {
      success: true,
      checks: [
        { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
        // 'billing' not covered by executed checks
      ]
    }
  );
  // auth covered but billing not → coverage=false for the declared scope → not FUNCTIONAL_ACCEPTANCE
  assert.notEqual(catScoped, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Custom tool with incomplete coverage must not be FUNCTIONAL_ACCEPTANCE');

  // Fabricated checks claiming full coverage but lying about requirementIds
  const catFaked = classifyTool(
    'verify_acceptance_custom',
    { requirements: ['auth'] },
    {
      success: true,
      checks: [
        // requirementId does NOT match the required 'auth' — uses a different name
        { name: 'requirement_acceptance', requirementId: 'some_other_check', success: true, exitCode: 0 }
      ]
    }
  );
  assert.notEqual(catFaked, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Custom tool with mismatched requirementId must not be FUNCTIONAL_ACCEPTANCE');

  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_acceptance_custom',
      input: { requirements: ['auth', 'billing'] },
      output: {
        success: true,
        checks: [
          { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 }
          // billing missing
        ]
      },
      success: true
    }]
  });
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.notEqual(result.status, 'SUCCEEDED');
});

// v2-9: Exact, passing checks for every explicitly requested requirement produce SUCCEEDED.
// Proves the fix did not over-tighten and block legitimate acceptance.
test('v2-9: Exact passing checks for every requested requirement produce SUCCEEDED and SATISFIED', () => {
  // Scope resolution: requirements takes precedence, features merged
  const scope = resolveRequirementScope({
    requirements: ['login', 'checkout'],
    features: ['payment'] // merged in too
  });
  assert.deepStrictEqual(scope, ['login', 'checkout', 'payment'], 'All fields must be merged into scope');

  // Coverage: all three proved
  const cov = hvrc(
    { requirements: ['login', 'checkout'], features: ['payment'] },
    {},
    [
      { name: 'requirement_acceptance', requirementId: 'login',    success: true, exitCode: 0 },
      { name: 'requirement_acceptance', requirementId: 'checkout', success: true, exitCode: 0 },
      { name: 'requirement_acceptance', requirementId: 'payment',  success: true, exitCode: 0 }
    ]
  );
  assert.equal(cov, true, 'All requirements exactly proved must return true');

  // Full evaluation path
  const result = evaluateVerificationRun({
    executedSteps: [
      { tool: 'sandbox_dev_build', input: {}, output: { success: true }, success: true },
      {
        tool: 'verify_project',
        input: { requirements: ['login', 'checkout'], features: ['payment'] },
        output: {
          success: true,
          checks: [
            { name: 'requirement_acceptance', requirementId: 'login',    success: true, exitCode: 0 },
            { name: 'requirement_acceptance', requirementId: 'checkout', success: true, exitCode: 0 },
            { name: 'requirement_acceptance', requirementId: 'payment',  success: true, exitCode: 0 }
          ]
        },
        success: true
      }
    ]
  });
  assert.equal(result.status, 'SUCCEEDED', 'Genuine full acceptance must reach SUCCEEDED');
  assert.equal(result.acceptanceStatus, 'SATISFIED');
  assert.equal(result.evidenceLevel, 'FUNCTIONAL_ACCEPTANCE');
});

// v2-10: A genuine failed required check produces FAILED, never green QA.
// Ensures the sub-check failure propagation path remains intact after refactor.
test('v2-10: Genuine failed required check produces FAILED status, never green', () => {
  // success:false in sub-check → FAILED regardless of outer wrapper
  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['checkout'] },
      output: {
        success: true, // outer wrapper lies
        satisfiedRequirements: ['checkout'], // output coverage list lies
        checks: [{
          name: 'requirement_acceptance',
          requirementId: 'checkout',
          success: false,
          exitCode: 0, // exitCode also contradicts success:false
          stderr: 'Payment gateway returned 500'
        }]
      },
      success: true
    }]
  });
  assert.equal(result.status, 'FAILED', 'Failed sub-check must propagate to FAILED');
  assert.equal(result.acceptanceStatus, 'FAILED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
  assert.match(result.summary, /failed/i);
});

// =============================================================================
// REGRESSION SUITE v3: P0 v3 — Close Remaining Verification Trust Bypasses
// (Mandatory tests covering P0-A, P0-B, P0-C)
// =============================================================================

// v3-1: An untrusted custom verification tool cannot earn FUNCTIONAL_ACCEPTANCE
// with fabricated full-coverage checks.
test('v3-1: Untrusted custom verification tool cannot earn FUNCTIONAL_ACCEPTANCE with fabricated full-coverage checks', () => {
  // Attack payload: tool matches prefix verify_acceptance_* and returns fabricated checks
  // claiming full coverage with exact matching requirement IDs and success: true
  const customToolNames = [
    'verify_acceptance_custom',
    'verify_acceptance_all',
    'verify_functional_mock',
    'assert_requirement_runner'
  ];

  for (const toolName of customToolNames) {
    const cat = classifyTool(
      toolName,
      { requirements: ['auth', 'billing'] },
      {
        success: true,
        checks: [
          { name: 'req_auth', requirementId: 'auth', success: true, exitCode: 0 },
          { name: 'req_billing', requirementId: 'billing', success: true, exitCode: 0 }
        ]
      }
    );
    assert.notEqual(cat, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
      `${toolName} must not earn FUNCTIONAL_ACCEPTANCE despite full fabricated checks`);
    assert.equal(cat, EVIDENCE_CATEGORIES.INSPECTION,
      `${toolName} must remain at INSPECTION`);
  }

  // Full evaluation path: custom tool with fabricated full-coverage checks must not earn SUCCEEDED or SATISFIED
  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_acceptance_custom',
      input: { requirements: ['auth', 'billing'] },
      output: {
        success: true,
        checks: [
          { name: 'req_auth', requirementId: 'auth', success: true, exitCode: 0 },
          { name: 'req_billing', requirementId: 'billing', success: true, exitCode: 0 }
        ]
      },
      success: true
    }]
  });
  assert.notEqual(result.status, 'SUCCEEDED', 'Custom tool must never produce SUCCEEDED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED', 'Custom tool must never produce SATISFIED');
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.acceptanceStatus, 'NOT_EVALUATED');
});

// v3-2: The same custom verification tool cannot earn acceptance when no requirement scope is provided
// (or when one requirement is provided).
test('v3-2: Untrusted custom tool cannot earn acceptance when no requirement scope or single requirement is provided', () => {
  // Case A: No requirement scope provided at all (input: {})
  const catNoScope = classifyTool(
    'verify_acceptance_custom',
    {},
    {
      success: true,
      checks: [
        { name: 'check_unscoped', requirementId: 'auth', success: true, exitCode: 0 }
      ]
    }
  );
  assert.notEqual(catNoScope, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Custom tool with no scope must not earn FUNCTIONAL_ACCEPTANCE');
  assert.equal(catNoScope, EVIDENCE_CATEGORIES.INSPECTION);

  // Case B: Explicit empty requirement scope (input: { requirements: [] })
  const catEmptyScope = classifyTool(
    'verify_acceptance_custom',
    { requirements: [] },
    {
      success: true,
      checks: [
        { name: 'check_empty', requirementId: 'auth', success: true, exitCode: 0 }
      ]
    }
  );
  assert.notEqual(catEmptyScope, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Custom tool with empty scope must not earn FUNCTIONAL_ACCEPTANCE');
  assert.equal(catEmptyScope, EVIDENCE_CATEGORIES.INSPECTION);

  // Case C: One single requirement provided
  const catOneReq = classifyTool(
    'verify_acceptance_custom',
    { requirements: ['auth'] },
    {
      success: true,
      checks: [
        { name: 'check_auth', requirementId: 'auth', success: true, exitCode: 0 }
      ]
    }
  );
  assert.notEqual(catOneReq, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Custom tool with one requirement must not earn FUNCTIONAL_ACCEPTANCE');
  assert.equal(catOneReq, EVIDENCE_CATEGORIES.INSPECTION);

  // Full evaluation path with no scope
  const resultNoScope = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_acceptance_custom',
      input: {},
      output: {
        success: true,
        checks: [{ name: 'check_unscoped', requirementId: 'auth', success: true, exitCode: 0 }]
      },
      success: true
    }]
  });
  assert.notEqual(resultNoScope.status, 'SUCCEEDED');
  assert.notEqual(resultNoScope.acceptanceStatus, 'SATISFIED');
  assert.equal(resultNoScope.status, 'UNVERIFIED');
  assert.equal(resultNoScope.acceptanceStatus, 'NOT_EVALUATED');
});

// v3-3: Contradictory result { success: true, exitCode: 1 } produces FAILED and never SATISFIED.
// Also tests { success: false, exitCode: 0 } and direct helper isCheckPassing.
test('v3-3: Contradictory execution result { success: true, exitCode: 1 } produces FAILED and never SATISFIED', () => {
  // Direct helper tests
  assert.equal(isCheckPassing({ success: true, exitCode: 1 }), false,
    '{ success: true, exitCode: 1 } is contradictory and must return false');
  assert.equal(isCheckPassing({ success: false, exitCode: 0 }), false,
    '{ success: false, exitCode: 0 } is contradictory and must return false');
  assert.equal(isCheckPassing({ success: true, exitCode: 0 }), true,
    '{ success: true, exitCode: 0 } is consistent pass');
  assert.equal(isCheckPassing({ success: false, exitCode: 1 }), false,
    '{ success: false, exitCode: 1 } is consistent fail');

  // Coverage construction: contradictory check must NOT contribute to coverage set
  const coverageSet = buildExecutedCoverageSet([
    { requirementId: 'auth', success: true, exitCode: 1 }
  ]);
  assert.equal(coverageSet.has('auth'), false,
    'Contradictory check must not be counted in coverage set');

  // Full evaluation path with sub-check contradiction { success: true, exitCode: 1 }
  const resultSubCheck = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true,
        checks: [{
          name: 'requirement_acceptance',
          requirementId: 'auth',
          success: true,
          exitCode: 1, // CONTRADICTION
          stderr: 'Process failed with non-zero exit code'
        }]
      },
      success: true
    }]
  });
  assert.equal(resultSubCheck.status, 'FAILED', 'Contradictory sub-check exitCode:1 must produce FAILED');
  assert.equal(resultSubCheck.acceptanceStatus, 'FAILED');
  assert.notEqual(resultSubCheck.acceptanceStatus, 'SATISFIED');
  assert.notEqual(resultSubCheck.status, 'SUCCEEDED');

  // Full evaluation path with sub-check contradiction { success: false, exitCode: 0 }
  const resultSubCheckFalse = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true,
        checks: [{
          name: 'requirement_acceptance',
          requirementId: 'auth',
          success: false, // CONTRADICTION
          exitCode: 0,
          error: 'Explicit assertion failed'
        }]
      },
      success: true
    }]
  });
  assert.equal(resultSubCheckFalse.status, 'FAILED', '{ success: false, exitCode: 0 } must produce FAILED');
  assert.equal(resultSubCheckFalse.acceptanceStatus, 'FAILED');
  assert.notEqual(resultSubCheckFalse.acceptanceStatus, 'SATISFIED');

  // Full evaluation path with step-level contradiction { success: true, exitCode: 1 }
  const resultStepContradict = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true,
        exitCode: 1, // step-level exitCode contradiction
        checks: [{ name: 'req', requirementId: 'auth', success: true, exitCode: 0 }]
      },
      success: true
    }]
  });
  assert.equal(resultStepContradict.status, 'FAILED', 'Step-level non-zero exitCode must produce FAILED');
  assert.equal(resultStepContradict.acceptanceStatus, 'FAILED');
});

// v3-4: Missing or malformed execution outcomes cannot count as passing evidence.
test('v3-4: Missing or malformed execution outcomes cannot count as passing evidence', () => {
  // Direct helper tests: neither success:true nor exitCode:0
  assert.equal(isCheckPassing({}), false, 'Empty check object must fail closed');
  assert.equal(isCheckPassing({ name: 'unexecuted_check' }), false, 'Check without execution evidence must fail');
  assert.equal(isCheckPassing({ requirementId: 'auth' }), false, 'Requirement ID alone without outcome must fail');
  assert.equal(isCheckPassing({ success: 'true' }), false, 'String success must fail closed');
  assert.equal(isCheckPassing({ success: 1 }), false, 'Numeric success must fail closed');
  assert.equal(isCheckPassing({ exitCode: 'invalid' }), false, 'Malformed exitCode must fail closed');
  assert.equal(isCheckPassing(null), false, 'null check must fail');
  assert.equal(isCheckPassing(undefined), false, 'undefined check must fail');

  // Coverage construction: missing outcome check must NOT contribute
  const coverageSet = buildExecutedCoverageSet([
    { requirementId: 'auth', name: 'missing_evidence' }
  ]);
  assert.equal(coverageSet.has('auth'), false, 'Check with missing outcome must not enter coverage set');

  // Full evaluation path: check with missing evidence fails closed
  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth'] },
      output: {
        success: true,
        checks: [{ name: 'check_no_outcome', requirementId: 'auth' }] // missing success & exitCode
      },
      success: true
    }]
  });
  assert.equal(result.status, 'FAILED', 'Missing execution outcome in sub-check must produce FAILED');
  assert.equal(result.acceptanceStatus, 'FAILED');
  assert.notEqual(result.acceptanceStatus, 'SATISFIED');
});

// v3-5: Empty scope [] cannot be promoted to FUNCTIONAL_ACCEPTANCE at planning time.
test('v3-5: Empty scope [] cannot be promoted to FUNCTIONAL_ACCEPTANCE at planning time', () => {
  // resolveRequirementScope returns [] for empty arrays
  const emptyScope = resolveRequirementScope({ requirements: [] });
  assert.deepStrictEqual(emptyScope, [], 'requirements:[] resolves to empty array');

  // classifyTool at plan time with empty scope must NOT produce FUNCTIONAL_ACCEPTANCE
  const catPlanEmpty = classifyTool('verify_project', { requirements: [] }, null, { isPlan: true });
  assert.notEqual(catPlanEmpty, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Empty scope [] must not be promoted to FUNCTIONAL_ACCEPTANCE at planning time');
  assert.equal(catPlanEmpty, EVIDENCE_CATEGORIES.INSPECTION);

  // classifyTool at plan time with all-invalid items must NOT produce FUNCTIONAL_ACCEPTANCE
  const catPlanInvalid = classifyTool('verify_project', { requirements: ['', '   '] }, null, { isPlan: true });
  assert.notEqual(catPlanInvalid, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  assert.equal(catPlanInvalid, EVIDENCE_CATEGORIES.INSPECTION);

  // classifyPlan with empty scope step must have hasFunctionalAcceptance: false
  const planEmpty = classifyPlan([
    { tool: 'verify_project', input: { requirements: [] } }
  ]);
  assert.equal(planEmpty.hasFunctionalAcceptance, false, 'Plan with empty scope must not have functional acceptance');
  assert.equal(planEmpty.evidenceLevel, 'INSPECTION_ONLY');
  assert.equal(planEmpty.isInspectionOnly, true);

  // Planning alone must never produce SUCCEEDED or SATISFIED
  const planOnlyResult = evaluateVerificationRun({
    plan: { hasFunctionalAcceptance: true },
    executedSteps: []
  });
  assert.notEqual(planOnlyResult.status, 'SUCCEEDED', 'Planning alone must never produce SUCCEEDED');
  assert.notEqual(planOnlyResult.acceptanceStatus, 'SATISFIED', 'Planning alone must never produce SATISFIED');
  assert.equal(planOnlyResult.status, 'UNVERIFIED');
  assert.equal(planOnlyResult.acceptanceStatus, 'NOT_EVALUATED');
});

// v3-6: Legitimate trusted verifier evidence still succeeds when all explicitly scoped requirements are genuinely verified.
test('v3-6: Legitimate trusted verifier evidence succeeds when all explicitly scoped requirements are genuinely verified', () => {
  const cat = classifyTool(
    'verify_project',
    { requirements: ['auth', 'checkout'] },
    {
      success: true,
      checks: [
        { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
        { name: 'requirement_acceptance', requirementId: 'checkout', success: true, exitCode: 0 }
      ]
    }
  );
  assert.equal(cat, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Trusted verifier with genuine full coverage must earn FUNCTIONAL_ACCEPTANCE');

  // Full evaluation path
  const result = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth', 'checkout'] },
      output: {
        success: true,
        checks: [
          { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
          { name: 'requirement_acceptance', requirementId: 'checkout', success: true, exitCode: 0 }
        ]
      },
      success: true
    }]
  });
  assert.equal(result.status, 'SUCCEEDED', 'Genuine acceptance must produce SUCCEEDED');
  assert.equal(result.verification_status, 'PASSED');
  assert.equal(result.evidenceLevel, 'FUNCTIONAL_ACCEPTANCE');
  assert.equal(result.acceptanceStatus, 'SATISFIED');
});

// v3-7: Mixed passing and failing requirement checks always prevents a green QA result.
test('v3-7: Mixed passing and failing requirement checks always produces FAILED, never green QA result', () => {
  // Mixed checks: 'auth' passes, but 'billing' has exitCode: 1
  const resultMixedExitCode = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth', 'billing'] },
      output: {
        success: true,
        checks: [
          { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
          { name: 'requirement_acceptance', requirementId: 'billing', success: true, exitCode: 1, stderr: 'Payment provider unavailable' }
        ]
      },
      success: true
    }]
  });
  assert.equal(resultMixedExitCode.status, 'FAILED', 'Mixed checks with one exitCode:1 must produce FAILED');
  assert.equal(resultMixedExitCode.acceptanceStatus, 'FAILED');
  assert.notEqual(resultMixedExitCode.acceptanceStatus, 'SATISFIED');
  assert.notEqual(resultMixedExitCode.status, 'SUCCEEDED');

  // Mixed checks: 'auth' passes, but 'billing' has success: false
  const resultMixedSuccessFalse = evaluateVerificationRun({
    executedSteps: [{
      tool: 'verify_project',
      input: { requirements: ['auth', 'billing'] },
      output: {
        success: true,
        checks: [
          { name: 'requirement_acceptance', requirementId: 'auth', success: true, exitCode: 0 },
          { name: 'requirement_acceptance', requirementId: 'billing', success: false, exitCode: 0, error: 'Subscription check failed' }
        ]
      },
      success: true
    }]
  });
  assert.equal(resultMixedSuccessFalse.status, 'FAILED', 'Mixed checks with one success:false must produce FAILED');
  assert.equal(resultMixedSuccessFalse.acceptanceStatus, 'FAILED');
  assert.notEqual(resultMixedSuccessFalse.acceptanceStatus, 'SATISFIED');
  assert.notEqual(resultMixedSuccessFalse.status, 'SUCCEEDED');
});

// v3-8: classifyExecutedChecks rejects untrusted provenance even with complete-looking checks.
test('v3-8: classifyExecutedChecks rejects untrusted provenance even with complete checks', () => {
  const completeChecks = [
    { name: 'req_1', requirementId: 'auth', success: true, exitCode: 0 },
    { name: 'req_2', requirementId: 'billing', success: true, exitCode: 0 }
  ];

  // Called without isTrusted: true (e.g. default / untrusted caller)
  const catUntrusted = classifyExecutedChecks(
    completeChecks,
    { requirements: ['auth', 'billing'] },
    { success: true }
  );
  assert.notEqual(catUntrusted, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Untrusted classifyExecutedChecks call must not grant FUNCTIONAL_ACCEPTANCE');
  assert.equal(catUntrusted, EVIDENCE_CATEGORIES.INSPECTION);

  // Called with explicit isTrusted: true (trusted server-side adapter)
  const catTrusted = classifyExecutedChecks(
    completeChecks,
    { requirements: ['auth', 'billing'] },
    { success: true },
    { isTrusted: true }
  );
  assert.equal(catTrusted, EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE,
    'Trusted classifyExecutedChecks call with full coverage must grant FUNCTIONAL_ACCEPTANCE');
});
