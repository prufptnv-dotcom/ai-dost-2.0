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
const toolRegistry = require('./ToolRegistry');
const { ResultValidator } = require('./resultValidator');
const { registerAll } = require('./registerAgentCapabilities');
const { createStructuredAgentPlanner } = require('./structuredAgentPlanner');

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
    contextAssembler
  });

  return {
    gateway,
    plannerExecutionLoop,
    taskPlanner,
    contextAssembler,
    executionController,
    adapter,
    toolRegistry
  };
}

async function getChatTaskGateway({ aiService, db, runtime } = {}) {
  if (!runtimeCache) {
    await registerAll().catch(() => {});
    runtimeCache = createChatTaskGateway({ aiService, db, runtime });
  }
  return runtimeCache.gateway;
}

function resetChatTaskGatewayForTests() {
  runtimeCache = null;
}

module.exports = {
  createChatTaskGateway,
  getChatTaskGateway,
  resetChatTaskGatewayForTests
};