const crypto = require('crypto');

function createExecutionError(message, code, metadata = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, metadata);
  return error;
}

function resolveToolTimeoutMs(context = {}) {
  const configured = context.toolTimeoutMs ?? process.env.AGENT_TOOL_TIMEOUT_MS;
  const timeoutMs = Number(configured ?? 120000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000;
}

class ExecutionController {
  constructor({ db, agentRunDao, agentStepDao, toolCallDao, observationDao, verificationResultDao, workspaceManager, gatekeeper } = {}) {
    this.db = db;
    this.agentRunDao = agentRunDao;
    this.agentStepDao = agentStepDao;
    this.toolCallDao = toolCallDao;
    this.observationDao = observationDao;
    this.verificationResultDao = verificationResultDao;
    this.workspaceManager = workspaceManager;
    this.gatekeeper = gatekeeper !== undefined ? gatekeeper : require('../policy/CapabilityGatekeeper').capabilityGatekeeper;

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

  async executeTool(stepId, toolName, input, context = {}, toolRegistry) {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (this.gatekeeper && typeof this.gatekeeper.evaluate === 'function') {
      const toolToCapMap = {
        'run_terminal': 'devops.terminal',
        'terminal': 'devops.terminal',
        'exec_command': 'devops.terminal',
        'apply_diff': 'coding.production_code',
        'write_file': 'coding.production_code',
        'read_file': 'coding.code_explanation',
        'list_files': 'coding.code_explanation',
        'load_skill': 'autonomy.skill_loading',
        'web_search': 'autonomy.web_acquisition',
        'fetch_webpage': 'autonomy.web_acquisition',
        'create_assessment': 'autonomy.skill_loading'
      };

      const capId = tool.capabilityId || toolToCapMap[toolName] || null;
      if (capId) {
        const evaluation = this.gatekeeper.evaluate([capId], {
          user: (context && context.user) || (context && context.userId ? { id: context.userId, role: context.role || 'developer' } : null),
          project_id: context && context.projectId,
          permissions: (context && context.permissions) !== undefined ? context.permissions : null
        });

        if (evaluation.decision === 'BLOCK') {
          const reason = (evaluation.capabilities || []).map(c => c.reason).join(', ') || 'Blocked by security policy';
          throw new Error(`Execution blocked by CapabilityGatekeeper: ${reason}`);
        }

        if (['REQUIRE_EXPLICIT_APPROVAL', 'REQUIRE_CONFIRMATION'].includes(evaluation.decision)) {
          const token = context && (context.approvalToken || context.approval_token);
          if (!token) {
            const err = new Error(`Action requires user approval (${evaluation.decision}): ${capId}`);
            err.code = 'APPROVAL_REQUIRED';
            err.decision = evaluation.decision;
            err.approvalToken = evaluation.approval_token;
            err.capabilities = evaluation.capabilities;
            throw err;
          }

          const validation = this.gatekeeper.validateApproval({
            token,
            requestId: context && (context.requestId || context.request_id),
            planId: context && (context.planId || context.taskId),
            user: context && (context.user || { id: context.userId }),
            capabilityIds: [capId]
          });

          if (!validation.valid) {
            throw new Error(`Invalid or expired approval token: ${validation.reason}`);
          }
        }
      }
    }

    const toolCall = await this.recordToolCall(stepId, toolName, input);
    const startTime = Date.now();
    const timeoutMs = resolveToolTimeoutMs(context);
    const parentSignal = context && context.signal;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeoutHandle;
    let removeParentAbortListener = null;
    let settled = false;

    const timeoutError = () => createExecutionError(
      `Tool execution timed out after ${timeoutMs}ms`,
      'TOOL_TIMEOUT',
      { timeoutMs, toolName, stepId }
    );

    const cancellationError = () => createExecutionError(
      'Tool execution cancelled',
      'TOOL_CANCELLED',
      { toolName, stepId }
    );

    try {
      if (parentSignal && parentSignal.aborted) {
        throw cancellationError();
      }

      if (controller && parentSignal) {
        const onParentAbort = () => controller.abort(parentSignal.reason);
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
        removeParentAbortListener = () => parentSignal.removeEventListener('abort', onParentAbort);
      }

      const toolContext = controller ? { ...context, signal: controller.signal } : context;
      const executionPromise = Promise.resolve().then(() => tool.execute(toolContext, input));
      const guardedExecution = new Promise((resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          if (settled) return;
          if (controller) controller.abort(timeoutError());
          reject(timeoutError());
        }, timeoutMs);

        executionPromise.then(
          value => {
            if (settled) return;
            resolve(value);
          },
          error => {
            if (settled) return;
            reject(error);
          }
        );

        if (parentSignal) {
          const onCancel = () => {
            if (settled) return;
            if (controller) controller.abort(parentSignal.reason);
            reject(cancellationError());
          };
          if (parentSignal.aborted) onCancel();
          else parentSignal.addEventListener('abort', onCancel, { once: true });
          const previousCleanup = removeParentAbortListener;
          removeParentAbortListener = () => {
            previousCleanup?.();
            parentSignal.removeEventListener('abort', onCancel);
          };
        }
      });

      const output = await guardedExecution;
      settled = true;
      clearTimeout(timeoutHandle);
      removeParentAbortListener?.();
      const duration = Date.now() - startTime;
      await this.completeToolCall(toolCall.id, 'SUCCEEDED', output, null, { duration });
      return output;
    } catch (err) {
      settled = true;
      clearTimeout(timeoutHandle);
      removeParentAbortListener?.();
      const duration = Date.now() - startTime;
      await this.completeToolCall(toolCall.id, 'FAILED', null, err.message, {
        duration,
        errorCode: err.code || 'TOOL_EXECUTION_FAILED',
        ...(err.code === 'TOOL_TIMEOUT' ? { timeoutMs } : {})
      });
      throw err;
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
