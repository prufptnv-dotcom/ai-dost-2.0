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

async function setupDirectorEnvironment(customVerificationPlanFn) {
  await registerAll();
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
      // If called for director final verification gate (role: VERIFIER)
      if (context?.role === 'VERIFIER') {
        return customVerificationPlanFn(goal, context);
      }
      // For intermediate worker steps, return a basic list_directory check
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

test('Regression: Fallback list_directory verification MUST NOT produce SUCCEEDED or QA Passed', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  // Simulates verification planner falling back to list_directory
  const fallbackListDirectoryVerification = async () => ({
    goal: 'Verify outcome',
    isFallback: true,
    evidenceLevel: 'INSPECTION_ONLY',
    fallbackReason: 'Verification plan generation failed; fell back to directory inspection',
    steps: [{ id: 'step-verify-files', tool: 'list_directory', description: 'Inspect workspace files', input: { path: '.' } }]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(fallbackListDirectoryVerification);

  const result = await director.run({
    userId,
    projectId,
    request: 'Build a SaaS dashboard with interactive charts and export',
    onEvent
  });

  // Collect verification and completion events
  const verifyEvents = events.filter((e) => e.type === 'director_verification');
  const completeEvents = events.filter((e) => e.type === 'director_complete');

  const finalVerifyEvent = verifyEvents[verifyEvents.length - 1];
  const finalCompleteEvent = completeEvents[completeEvents.length - 1];

  // 1. Assert director_verification does NOT claim SUCCEEDED or PASSED
  assert.ok(finalVerifyEvent, 'Must emit director_verification event');
  assert.notEqual(finalVerifyEvent.status, 'SUCCEEDED', 'Verification event status MUST NOT be SUCCEEDED for list_directory fallback');
  assert.equal(finalVerifyEvent.status, 'UNVERIFIED', 'Verification event status MUST be UNVERIFIED when only list_directory runs');

  // 2. Assert director_complete does NOT claim SUCCEEDED
  assert.ok(finalCompleteEvent, 'Must emit director_complete event');
  assert.notEqual(finalCompleteEvent.status, 'SUCCEEDED', 'Director completion MUST NOT be SUCCEEDED when verification is unverified');
  assert.equal(finalCompleteEvent.status, 'UNVERIFIED', 'Director completion status MUST be UNVERIFIED');

  // 3. Assert ResultValidator returned verification_status is UNVERIFIED
  assert.notEqual(result.verification_status, 'PASSED', 'Result verification_status MUST NOT be PASSED');
  assert.equal(result.verification_status, 'UNVERIFIED', 'Result verification_status MUST be UNVERIFIED');

  // 4. Assert explanation of missing functional evidence
  assert.match(
    finalCompleteEvent.verification?.summary || result.summary,
    /unverified|passive|inspection/i,
    'Must explain that only passive inspection occurred and functional evidence is missing'
  );
});

test('Functional Verification: Genuine functional check that passes produces SUCCEEDED and PASSED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  // Simulates verification plan with functional verification step that passes
  const functionalVerification = async () => ({
    goal: 'Verify outcome',
    isFunctional: true,
    steps: [
      { id: 'step-check-files', tool: 'list_directory', description: 'Inspect files', input: { path: '.' } },
      { id: 'step-verify-content', tool: 'read_file', description: 'Read created file', input: { path: 'package.json' } }
    ]
  });

  const { director, userId, projectId, workspaceManager } = await setupDirectorEnvironment(functionalVerification);

  // Write a real package.json in workspace so read_file succeeds
  const wsDir = workspaceManager.getWorkspacePath(projectId);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'package.json'), JSON.stringify({ name: 'test-app' }));

  const result = await director.run({
    userId,
    projectId,
    request: 'Build a SaaS dashboard with package.json',
    onEvent
  });

  const verifyEvents = events.filter((e) => e.type === 'director_verification');
  const completeEvents = events.filter((e) => e.type === 'director_complete');

  const finalVerifyEvent = verifyEvents[verifyEvents.length - 1];
  const finalCompleteEvent = completeEvents[completeEvents.length - 1];

  assert.ok(finalVerifyEvent, 'Must emit director_verification event');
  assert.equal(finalVerifyEvent.status, 'SUCCEEDED', 'Verification event status MUST be SUCCEEDED for passing functional check');

  assert.ok(finalCompleteEvent, 'Must emit director_complete event');
  assert.equal(finalCompleteEvent.status, 'SUCCEEDED', 'Director complete MUST be SUCCEEDED for passing functional check');
  assert.equal(result.verification_status, 'PASSED', 'Result verification_status MUST be PASSED');
});

test('Functional Verification: Verification check that fails produces FAILED', async () => {
  const events = [];
  const onEvent = (evt) => events.push(evt);

  // Simulates verification step that fails (file does not exist)
  const failingFunctionalVerification = async () => ({
    goal: 'Verify outcome',
    steps: [
      { id: 'step-check-missing', tool: 'read_file', description: 'Read missing file', input: { path: 'non_existent_file.xyz' } }
    ]
  });

  const { director, userId, projectId } = await setupDirectorEnvironment(failingFunctionalVerification);

  await assert.rejects(
    async () => {
      await director.run({
        userId,
        projectId,
        request: 'Build a SaaS dashboard expecting non_existent_file.xyz',
        onEvent
      });
    },
    /Final Director verification gate failed|did not pass|Verification failed/i
  );

  const verifyEvents = events.filter((e) => e.type === 'director_verification');
  const finalVerifyEvent = verifyEvents[verifyEvents.length - 1];

  assert.ok(finalVerifyEvent, 'Must emit director_verification event');
  assert.equal(finalVerifyEvent.status, 'FAILED', 'Verification event status MUST be FAILED');
});
