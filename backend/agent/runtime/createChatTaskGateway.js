'use strict';

const { getDatabase } = require('../../db');
const ProjectDAO = require('../../db/dao/ProjectDAO');
const AgentTaskDAO = require('../../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../../db/dao/AgentRunDAO');
const AgentStepDAO = require('../../db/dao/AgentStepDAO');
const ToolCallDAO = require('../../db/dao/ToolCallDAO');
const ObservationDAO = require('../../db/dao/ObservationDAO');
const VerificationResultDAO = require('../../db/dao/VerificationResultDAO');
const ArtifactDAO = require('../../db/dao/ArtifactDAO');
const ConversationDAO = require('../../db/dao/ConversationDAO');
const WorkspaceManager = require('../../services/workspaceManager');
const projectAuthorization = require('../../services/projectAuthorization');
const ExecutionController = require('./ExecutionController');
const ChatPlannerExecutionLoop = require('./ChatPlannerExecutionLoop');
const TaskPlanner = require('./TaskPlanner');
const ContextAssembler = require('./ContextAssembler');
const ChatTaskAdapter = require('./ChatTaskAdapter');
const ChatTaskGateway = require('./ChatTaskGateway');
const DurableTaskIdempotencyStore = require('./DurableTaskIdempotencyStore');
const toolRegistry = require('./ToolRegistry');
const { ResultValidator } = require('./resultValidator');
const { registerAll } = require('./registerAgentCapabilities');
const { createStructuredAgentPlanner } = require('./structuredAgentPlanner');
const { CopilotDirector } = require('./CopilotDirector');
const AgentCoordinator = require('./AgentCoordinator');

let runtimeCache = null;

function createChatTaskGateway({ db = getDatabase(), aiService = null, runtime = {} } = {}) {
  if (runtime.gateway) return runtime.gateway;

  const workspaceManager = runtime.workspaceManager || new WorkspaceManager.WorkspaceManager(db);
  const projectDao = runtime.projectDao || new ProjectDAO(db);
  const agentTaskDao = runtime.agentTaskDao || new AgentTaskDAO(db);
  const agentRunDao = runtime.agentRunDao || new AgentRunDAO(db);
  const agentStepDao = runtime.agentStepDao || new AgentStepDAO(db);
  const toolCallDao = runtime.toolCallDao || new ToolCallDAO(db);
  const observationDao = runtime.observationDao || new ObservationDAO(db);
  const verificationResultDao = runtime.verificationResultDao || new VerificationResultDAO(db);
  const artifactDao = runtime.artifactDao || new ArtifactDAO(db);
  const conversationDao = runtime.conversationDao || new ConversationDAO(db);
  const idempotencyStore = runtime.idempotencyStore || new DurableTaskIdempotencyStore(db, {
    ttlMs: Number(process.env.AGENT_TASK_IDEMPOTENCY_TTL_MS) || 10 * 60 * 1000,
    maxEvents: Number(process.env.AGENT_TASK_IDEMPOTENCY_MAX_EVENTS) || 100,
  });

  const structuredPlanner = aiService || createStructuredAgentPlanner({ toolRegistry });

  const executionController = runtime.executionController || new ExecutionController({
    db,
    agentRunDao,
    agentStepDao,
    toolCallDao,
    observationDao,
    verificationResultDao,
    workspaceManager
  });

  const contextAssembler = runtime.contextAssembler || new ContextAssembler({
    db,
    projectAuthService: projectAuthorization,
    workspaceManager,
    toolRegistry,
    projectDao,
    retrievalService: runtime.retrievalService || null,
    contextBudgetManager: runtime.contextBudgetManager || null,
    contextNodeDao: runtime.contextNodeDao || null,
    artifactDao,
    conversationDao
  });

  const taskPlanner = runtime.taskPlanner || new TaskPlanner({
    toolRegistry,
    aiService: structuredPlanner
  });

  const plannerExecutionLoop = runtime.plannerExecutionLoop || new ChatPlannerExecutionLoop({
    contextAssembler,
    taskPlanner,
    executionController,
    toolRegistry,
    agentTaskDao,
    agentRunDao
  });

  const adapter = runtime.adapter || new ChatTaskAdapter({
    toolRegistry,
    resultValidator: runtime.resultValidator || new ResultValidator()
  });

  const gateway = new ChatTaskGateway({
    plannerExecutionLoop,
    adapter,
    taskPlanner,
    contextAssembler,
    idempotencyStore,
  });

  return {
    gateway,
    plannerExecutionLoop,
    taskPlanner,
    contextAssembler,
    executionController,
    adapter,
    toolRegistry,
    idempotencyStore,
    workspaceManager,
    projectDao,
    agentTaskDao,
    agentRunDao,
    projectAuthorization,
  };
}

async function getChatTaskRuntime({ aiService, db, runtime } = {}) {
  if (!runtimeCache) {
    await registerAll().catch(() => {});
    runtimeCache = createChatTaskGateway({ aiService, db, runtime });
  }
  return runtimeCache;
}

async function getChatTaskGateway({ aiService, db, runtime } = {}) {
  const runtimeState = await getChatTaskRuntime({ aiService, db, runtime });
  return runtimeState.gateway;
}

async function getCopilotDirectorRuntime({ aiService, db, runtime } = {}) {
  const state = await getChatTaskRuntime({ aiService, db, runtime });
  if (!state.director) {
    state.coordinator = new AgentCoordinator({
      db: db || getDatabase(),
      projectAuthService: state.projectAuthorization,
      workspaceManager: state.workspaceManager,
      toolRegistry,
      plannerExecutionLoop: state.plannerExecutionLoop,
      contextAssembler: state.contextAssembler,
      executionController: state.executionController,
      agentTaskDao: state.agentTaskDao,
      agentRunDao: state.agentRunDao,
      artifactDao: new ArtifactDAO(db || getDatabase())
    });
    state.director = new CopilotDirector({
      db: db || getDatabase(),
      projectAuthorization: state.projectAuthorization,
      workspaceManager: state.workspaceManager,
      toolRegistry,
      plannerExecutionLoop: state.plannerExecutionLoop,
      contextAssembler: state.contextAssembler,
      taskPlanner: state.taskPlanner,
      executionController: state.executionController,
      agentTaskDao: state.agentTaskDao,
      agentRunDao: state.agentRunDao,
      aiService: aiService || createStructuredAgentPlanner({ toolRegistry }),
      coordinator: state.coordinator
    });
  }
  return state;
}

function resetChatTaskGatewayForTests() {
  runtimeCache = null;
}

module.exports = {
  createChatTaskGateway,
  getChatTaskRuntime,
  getChatTaskGateway,
  getCopilotDirectorRuntime,
  resetChatTaskGatewayForTests
};
