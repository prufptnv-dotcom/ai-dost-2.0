const crypto = require('crypto');

class ExecutionController {
  constructor({ db, agentRunDao, agentStepDao, toolCallDao, observationDao, verificationResultDao, workspaceManager }) {
    this.db = db;
    this.agentRunDao = agentRunDao;
    this.agentStepDao = agentStepDao;
    this.toolCallDao = toolCallDao;
    this.observationDao = observationDao;
    this.verificationResultDao = verificationResultDao;
    this.workspaceManager = workspaceManager;
    
    this.VALID_TRANSITIONS = {
      'PENDING': ['RUNNING', 'CANCELLED', 'FAILED'],
      'RUNNING': ['WAITING', 'VERIFYING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
      'WAITING': ['RUNNING', 'CANCELLED', 'FAILED'],
      'VERIFYING': ['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
      'SUCCEEDED': [],
      'FAILED': [],
      'CANCELLED': []
    };
  }

  generateId(prefix) {
    return prefix + '_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  }

  async startRun(runId) {
    const run = this.agentRunDao.getById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    if (run.status !== 'PENDING' && run.status !== 'WAITING' && run.status !== 'VERIFYING') {
      throw new Error(`Invalid state transition: Cannot start run from ${run.status}`);
    }

    this.agentRunDao.updateStatus(runId, 'RUNNING', null, new Date().toISOString(), null);
    return this.agentRunDao.getById(runId);
  }

  async verifyRun(runId) {
    const run = this.agentRunDao.getById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    if (!this.VALID_TRANSITIONS[run.status].includes('VERIFYING')) {
      throw new Error(`Invalid state transition: ${run.status} -> VERIFYING`);
    }

    this.agentRunDao.updateStatus(runId, 'VERIFYING', null, null, null);
    return this.agentRunDao.getById(runId);
  }

  async completeRun(runId, status, errorInfo = null) {
    if (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(status)) {
      throw new Error(`Invalid completion status: ${status}`);
    }
    
    const run = this.agentRunDao.getById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);

    if (!this.VALID_TRANSITIONS[run.status].includes(status)) {
      throw new Error(`Invalid state transition: ${run.status} -> ${status}`);
    }

    this.agentRunDao.updateStatus(runId, status, errorInfo, null, new Date().toISOString());
    return this.agentRunDao.getById(runId);
  }

  async saveCheckpoint(runId, state) {
    const run = this.agentRunDao.getById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    return this.agentRunDao.updateMetadata(runId, state);
  }

  async loadCheckpoint(runId) {
    const run = this.agentRunDao.getById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    if (!run.runtime_metadata) return null;
    try {
      return JSON.parse(run.runtime_metadata);
    } catch (err) {
      throw new Error(`Checkpoint corruption for run ${runId}: Invalid JSON format`);
    }
  }

  async recoverStaleSteps(runId) {
    const existingSteps = this.agentStepDao.listByRun(runId);
    let recoveredCount = 0;
    for (const step of existingSteps) {
      if (step.status === 'RUNNING') {
        await this.completeStep(step.id, 'FAILED', null, 'Process crashed during execution');
        recoveredCount++;
      }
    }
    return recoveredCount;
  }

  async recordStep(runId, stepType, input) {
    const run = this.agentRunDao.getById(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    if (run.status !== 'RUNNING' && run.status !== 'VERIFYING') throw new Error(`Cannot record step while run is ${run.status}`);

    const existingSteps = this.agentStepDao.listByRun(runId);
    const sequence = existingSteps.length + 1;

    const id = this.generateId('step');
    return this.agentStepDao.create({
      id,
      runId,
      sequence,
      stepType,
      status: 'PENDING',
      input
    });
  }

  async startStep(stepId) {
    const step = this.agentStepDao.getById(stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
    return this.agentStepDao.update(stepId, { status: 'RUNNING', startedAt: new Date().toISOString() });
  }

  async completeStep(stepId, status, output = null, errorInfo = null) {
    const step = this.agentStepDao.getById(stepId);
    if (!step) throw new Error(`Step ${stepId} not found`);
    return this.agentStepDao.update(stepId, { 
      status, 
      output, 
      errorInfo, 
      completedAt: new Date().toISOString() 
    });
  }

  async recordToolCall(stepId, toolName, input) {
    const id = this.generateId('toolcall');
    return this.toolCallDao.create({ id, stepId, toolName, input, status: 'PENDING' });
  }

  async completeToolCall(toolCallId, status, output = null, errorInfo = null, timingMeta = null) {
    return this.toolCallDao.update(toolCallId, { status, output, errorInfo, timingMeta });
  }

  async executeTool(stepId, toolName, input, context, toolRegistry) {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    // Permission checks can be added here based on context.permissions vs tool.permissions
    const toolCall = await this.recordToolCall(stepId, toolName, input);
    
    const startTime = Date.now();
    try {
      const output = await tool.execute(context, input);
      const duration = Date.now() - startTime;
      await this.completeToolCall(toolCall.id, 'SUCCEEDED', output, null, { duration });
      return output;
    } catch (err) {
      const duration = Date.now() - startTime;
      await this.completeToolCall(toolCall.id, 'FAILED', null, err.message, { duration });
      throw err; // Re-throw to let the caller handle Step failure
    }
  }

  async recordObservation(stepId, observationType, payload) {
    const id = this.generateId('obs');
    return this.observationDao.create({ id, stepId, observationType, payload });
  }

  async recordVerificationResult(stepId, status, reason = null, evidence = null) {
    const id = this.generateId('verify');
    return this.verificationResultDao.create({ id, stepId, status, reason, evidence });
  }
}

module.exports = ExecutionController;




