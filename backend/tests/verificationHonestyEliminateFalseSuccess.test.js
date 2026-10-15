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
      execute: async (input) => ({ success: true, verified: true, functionalAcceptanceSatisfied: true })
    });
  }
}

async function setupDirectorEnvironment(customVerificationPlanFn) {
  await registerAll();
  ensureTestToolsRegistered();
  const db = initDatabase();

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

  assert.equal(classifyTool('verify_project'), EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);
  assert.equal(classifyTool('verify_functional_acceptance'), EVIDENCE_CATEGORIES.FUNCTIONAL_ACCEPTANCE);

  // Unknown tools default conservatively to INSPECTION, never assumed functional
  assert.equal(classifyTool('unknown_custom_inspector'), EVIDENCE_CATEGORIES.INSPECTION);
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
      { tool: 'verify_project', input: { requirements: ['charts', 'export'] }, output: { success: true, satisfied: true }, success: true }
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
