const crypto = require('crypto');
const { getDatabase } = require('../../db');
const AgentTaskDAO = require('../../db/dao/AgentTaskDAO');
const AgentRunDAO = require('../../db/dao/AgentRunDAO');
const AgentStepDAO = require('../../db/dao/AgentStepDAO');
const ToolCallDAO = require('../../db/dao/ToolCallDAO');
const ObservationDAO = require('../../db/dao/ObservationDAO');
const VerificationResultDAO = require('../../db/dao/VerificationResultDAO');
const AgentHandoffDAO = require('../../db/dao/AgentHandoffDAO');
const ProjectDAO = require('../../db/dao/ProjectDAO');
const UserDAO = require('../../db/dao/UserDAO');

const { WorkspaceManager } = require('../../services/workspaceManager');
const defaultProjectAuth = require('../../services/projectAuthorization');
const AgentHandoffService = require('../../services/agentHandoffService');
const ExecutionController = require('./ExecutionController');
const { ToolRegistry } = require('./ToolRegistry');
const CapabilityPolicy = require('../policy/CapabilityPolicy');
const { ResultValidator } = require('./resultValidator');
const Supervisor = require('./Supervisor');
const lockManager = require('../concurrency/LockManager');
const MultiAgentVerifier = require('../verification/MultiAgentVerifier');
const { SupervisorArbitrator } = require('../arbitration/SupervisorArbitrator');
const { VerificationContract } = require('../verification/VerificationContract');
const logger = require('../../logger');

const MAX_DELEGATION_DEPTH = 3;
const MAX_WORKERS_PER_SUPERVISOR = 5;
const MAX_ACTIVE_WORKERS_PER_PROJECT = 10;
const MAX_REPAIR_CYCLES = 3;

class AgentCoordinator {
  constructor(options = {}) {
    this._db = options.db || null;
    this.projectAuthService = options.projectAuthService || defaultProjectAuth;
    this.workspaceManager = options.workspaceManager || new WorkspaceManager(this.db);
    this.lockManager = options.lockManager || lockManager;
    this.toolRegistry = options.toolRegistry || new ToolRegistry();
    this.plannerExecutionLoop = options.plannerExecutionLoop || null;
    this.contextAssembler = options.contextAssembler || null;

    this.agentTaskDao = options.agentTaskDao || new AgentTaskDAO(this.db);
    this.agentRunDao = options.agentRunDao || new AgentRunDAO(this.db);
    this.agentStepDao = options.agentStepDao || new AgentStepDAO(this.db);
    this.toolCallDao = options.toolCallDao || new ToolCallDAO(this.db);
    this.observationDao = options.observationDao || new ObservationDAO(this.db);
    this.verificationResultDao = options.verificationResultDao || new VerificationResultDAO(this.db);
    this.agentHandoffDao = options.agentHandoffDao || new AgentHandoffDAO(this.db);
    this.projectDao = options.projectDao || new ProjectDAO(this.db);
    this.userDao = options.userDao || new UserDAO(this.db);

    this.agentHandoffService = options.agentHandoffService || new AgentHandoffService(this.db);

    this.multiAgentVerifier = options.multiAgentVerifier || new MultiAgentVerifier({
      db: this.db,
      projectAuthService: this.projectAuthService,
      workspaceManager: this.workspaceManager,
      verificationResultDao: this.verificationResultDao,
      artifactDao: options.artifactDao || (this.db ? new (require('../../db/dao/ArtifactDAO'))(this.db) : null),
      contextAssembler: this.contextAssembler
    });

    this.arbitrator = options.arbitrator || new SupervisorArbitrator({
      maxRepairs: options.maxRepairs || MAX_REPAIR_CYCLES
    });

    this.executionController = options.executionController || new ExecutionController({
      db: this.db,
      agentRunDao: this.agentRunDao,
      agentStepDao: this.agentStepDao,
      toolCallDao: this.toolCallDao,
      observationDao: this.observationDao,
      verificationResultDao: this.verificationResultDao,
      workspaceManager: this.workspaceManager
    });

    // In-process tracking for active worker lock tokens
    this._activeLocks = new Map(); // workerRunId -> { path, token }
  }

  get db() {
    return this._db || getDatabase();
  }

  generateId(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 1. Create a Supervisor task and run with trusted role assignment.
   */
  async createSupervisorTask({ userId, projectId, title = 'Supervisor Task', prompt = '', metadata = {} }) {
    if (!userId || !projectId) {
      throw new Error('userId and projectId are required to create a supervisor task');
    }

    // 1. Authorize user against project
    const auth = this.projectAuthService.authorize(projectId, { user: { id: userId } });
    if (!auth.authorized) {
      throw new Error(auth.error || `Unauthorized: User ${userId} denied access to project ${projectId}`);
    }

    // 2. Create AgentTask record
    const taskId = this.generateId('task_sup');
    const task = this.agentTaskDao.create({
      id: taskId,
      projectId: auth.project.id,
      userId: auth.user.id,
      title,
      status: 'PENDING'
    });

    // 3. Create Supervisor AgentRun with trusted runtime_metadata.role
    const runId = this.generateId('run_sup');
    const supervisorMetadata = {
      role: 'SUPERVISOR',
      depth: 0,
      prompt,
      ...metadata
    };

    const run = this.agentRunDao.create({
      id: runId,
      taskId: task.id,
      status: 'PENDING',
      metadata: supervisorMetadata
    });

    const supervisor = new Supervisor({
      runId: run.id,
      taskId: task.id,
      projectId: auth.project.id,
      userId: auth.user.id,
      coordinator: this
    });

    logger.info(`[AgentCoordinator] Created Supervisor task ${task.id}, run ${run.id} for project ${auth.project.id}`);
    return { task, run, supervisor };
  }

  /**
   * 2. Delegate a sub-objective from Supervisor to a specialized Worker.
   */
  async delegate({
    supervisorRunId,
    role,
    objective,
    contextRefs = [],
    artifactRefs = [],
    constraints = {},
    expectedOutput = null
  }) {
    if (!supervisorRunId || !role || !objective) {
      throw new Error('supervisorRunId, role, and objective are required for delegation');
    }

    // 1. Validate Supervisor run and trusted role
    const supervisorRun = this.agentRunDao.getById(supervisorRunId);
    if (!supervisorRun) {
      throw new Error(`Supervisor run '${supervisorRunId}' not found`);
    }

    let supervisorMeta = {};
    try {
      supervisorMeta = JSON.parse(supervisorRun.runtime_metadata || '{}');
    } catch (_) {}

    if (supervisorMeta.role !== 'SUPERVISOR') {
      throw new Error(`Delegation denied: Run '${supervisorRunId}' has role '${supervisorMeta.role}', only SUPERVISOR may delegate`);
    }

    // 2. Validate Worker Target Role
    if (!CapabilityPolicy.validateWorkerRole(role)) {
      throw new Error(`Invalid or unauthorized worker role: '${role}'. Allowed worker roles: ${CapabilityPolicy.ALLOWED_WORKER_ROLES.join(', ')}`);
    }

    // 3. Enforce Delegation Depth Limit (Derived from trusted hierarchy)
    const currentDepth = typeof supervisorMeta.depth === 'number' ? supervisorMeta.depth : 0;
    const workerDepth = currentDepth + 1;
    if (workerDepth > MAX_DELEGATION_DEPTH) {
      throw new Error(`Delegation depth limit exceeded: max allowed depth is ${MAX_DELEGATION_DEPTH}, attempted depth ${workerDepth}`);
    }

    // 4. Retrieve Parent Task and check Project Worker Limits
    const parentTask = this.agentTaskDao.getById(supervisorRun.task_id);
    if (!parentTask) {
      throw new Error(`Parent task '${supervisorRun.task_id}' not found`);
    }

    // Worker limit per supervisor task
    const taskWorkerCount = this.agentRunDao.countByTask(parentTask.id);
    if (taskWorkerCount >= MAX_WORKERS_PER_SUPERVISOR + 1) { // +1 for the supervisor run itself
      throw new Error(`Worker limit per supervisor task exceeded: max allowed is ${MAX_WORKERS_PER_SUPERVISOR}`);
    }

    // Active worker limit per project (from canonical DB state)
    const activeProjectWorkers = this.agentRunDao.countActiveByProject(parentTask.project_id);
    if (activeProjectWorkers >= MAX_ACTIVE_WORKERS_PER_PROJECT) {
      throw new Error(`Active worker limit per project exceeded: max allowed is ${MAX_ACTIVE_WORKERS_PER_PROJECT}`);
    }

    // 5. Logical Handoff Idempotency Check
    const handoff = await this.agentHandoffService.createHandoff({
      taskId: parentTask.id,
      sourceRunId: supervisorRunId,
      sourceAgent: 'SUPERVISOR',
      targetAgent: role.toUpperCase(),
      objective,
      contextRefs,
      artifactRefs,
      constraints,
      expectedOutput
    });

    // If an existing active handoff was returned with an assigned worker run, return it
    if (handoff.target_run_id) {
      const existingWorkerRun = this.agentRunDao.getById(handoff.target_run_id);
      if (existingWorkerRun) {
        logger.info(`[AgentCoordinator] Idempotent delegation: Returning existing active worker run ${existingWorkerRun.id} for handoff ${handoff.id}`);
        return { workerTask: parentTask, workerRun: existingWorkerRun, handoff };
      }
    }

    // 6. Create Worker AgentRun with trusted runtime_metadata.role
    const workerRunId = this.generateId(`run_${role.toLowerCase()}`);
    const workerMetadata = {
      role: role.toUpperCase(),
      depth: workerDepth,
      parent_run_id: supervisorRunId,
      supervisor_task_id: parentTask.id,
      objective
    };

    const workerRun = this.agentRunDao.create({
      id: workerRunId,
      taskId: parentTask.id,
      status: 'PENDING',
      metadata: workerMetadata
    });

    // 7. Accept handoff with worker run assignment
    await this.agentHandoffService.acceptHandoff(handoff.id, workerRun.id);

    logger.info(`[AgentCoordinator] Delegated task from Supervisor ${supervisorRunId} to Worker ${workerRun.id} (${role})`);
    return {
      workerTask: parentTask,
      workerRun,
      handoff: this.agentHandoffService.getHandoff(handoff.id)
    };
  }

  /**
   * 3. Start worker execution through Worker runtime / ExecutionController / PlannerExecutionLoop.
   */
  async startWorker(workerRunId, options = {}) {
    const workerRun = this.agentRunDao.getById(workerRunId);
    if (!workerRun) throw new Error(`Worker run '${workerRunId}' not found`);

    if (workerRun.status === 'CANCELLED') {
      throw new Error(`Cannot start cancelled worker run '${workerRunId}'`);
    }

    let meta = {};
    try {
      meta = JSON.parse(workerRun.runtime_metadata || '{}');
    } catch (_) {}

    const role = meta.role || 'WORKER';
    const parentTask = this.agentTaskDao.getById(workerRun.task_id);
    const projectId = parentTask ? parentTask.project_id : 'default';

    // Locate handoff
    const handoffs = this.agentHandoffService.listByTargetRun(workerRunId);
    const handoff = handoffs.length > 0 ? handoffs[0] : null;

    if (handoff && handoff.status !== 'CANCELLED') {
      await this.agentHandoffService.startHandoff(handoff.id);
    }

    // Mutation Serialization: If worker performs code mutations (CODER role), acquire project workspace lock
    let lockToken = null;
    let wsPath = null;
    const isMutatingRole = (role === 'CODER');

    if (isMutatingRole) {
      wsPath = this.workspaceManager.getWorkspacePath(projectId);
      try {
        lockToken = await this.lockManager.acquire(wsPath, options.lockTimeoutMs || 30000);
        this._activeLocks.set(workerRunId, { path: wsPath, token: lockToken });
      } catch (lockErr) {
        if (handoff) {
          await this.agentHandoffService.failHandoff(handoff.id, `Failed to acquire workspace mutation lock: ${lockErr.message}`);
        }
        throw lockErr;
      }
    }

    // Start run in ExecutionController
    await this.executionController.startRun(workerRunId);

    try {
      let executionResult = null;

      if (options.runner && typeof options.runner === 'function') {
        executionResult = await options.runner(workerRunId, { projectId, role, objective: meta.objective });
      } else if (this.plannerExecutionLoop && options.autoPlan) {
        executionResult = await this.plannerExecutionLoop.run(projectId, parentTask.user_id, meta.objective);
      } else {
        // Default successful simulated execution completion when no custom runner is provided
        executionResult = options.result || {
          status: 'COMPLETED',
          summary: `Worker execution completed successfully for objective: ${meta.objective || 'Task'}`,
          artifact_refs: options.artifactRefs || [],
          context_refs: options.contextRefs || [],
          verification_status: options.verificationStatus || 'PASSED',
          errors: []
        };
      }

      // Check for cancellation race
      const currentRun = this.agentRunDao.getById(workerRunId);
      if (currentRun.status === 'CANCELLED') {
        logger.warn(`[AgentCoordinator] Worker ${workerRunId} was cancelled during execution; ignoring completion`);
        return { runId: workerRunId, status: 'CANCELLED' };
      }

      // Complete run
      await this.executionController.completeRun(workerRunId, 'SUCCEEDED');

      // Canonical result validation & handoff completion
      if (handoff && handoff.status !== 'CANCELLED') {
        const canonicalResult = ResultValidator.validate({
          status: 'COMPLETED',
          summary: executionResult.summary || `Worker completed ${role} task`,
          artifact_refs: executionResult.artifact_refs || [],
          context_refs: executionResult.context_refs || [],
          verification_status: executionResult.verification_status || 'PASSED',
          errors: executionResult.errors || []
        });

        await this.agentHandoffService.completeHandoff(handoff.id, canonicalResult);
      }

      return { runId: workerRunId, status: 'SUCCEEDED', result: executionResult };
    } catch (err) {
      const currentRun = this.agentRunDao.getById(workerRunId);
      if (currentRun.status !== 'CANCELLED') {
        await this.executionController.completeRun(workerRunId, 'FAILED', err.message).catch(() => {});
        if (handoff && handoff.status !== 'CANCELLED') {
          await this.agentHandoffService.failHandoff(handoff.id, err.message);
        }
      }
      throw err;
    } finally {
      // Release mutation lock if held
      if (lockToken && wsPath) {
        this.lockManager.release(wsPath, lockToken);
        this._activeLocks.delete(workerRunId);
      }
    }
  }

  /**
   * 4. Query current worker status.
   */
  async getWorkerStatus(workerRunId) {
    const run = this.agentRunDao.getById(workerRunId);
    if (!run) throw new Error(`Worker run '${workerRunId}' not found`);
    const handoffs = this.agentHandoffService.listByTargetRun(workerRunId);
    return {
      run,
      handoff: handoffs.length > 0 ? handoffs[0] : null
    };
  }

  /**
   * 5. Collect worker result with strict project/user authorization check.
   */
  async collectWorkerResult(workerRunId, requestingUserId) {
    if (!workerRunId || !requestingUserId) {
      throw new Error('workerRunId and requestingUserId are required to collect worker result');
    }

    const workerRun = this.agentRunDao.getById(workerRunId);
    if (!workerRun) throw new Error(`Worker run '${workerRunId}' not found`);

    const parentTask = this.agentTaskDao.getById(workerRun.task_id);
    if (!parentTask) throw new Error(`Task for run '${workerRunId}' not found`);

    // Strict user & project ownership authorization (SEC-001)
    const auth = this.projectAuthService.authorize(parentTask.project_id, { user: { id: requestingUserId } });
    if (!auth.authorized) {
      logger.warn(`[AgentCoordinator] Cross-project/cross-user result access denied for user '${requestingUserId}' on project '${parentTask.project_id}'`);
      throw new Error(`Unauthorized: User '${requestingUserId}' does not have permission to access results from project '${parentTask.project_id}'`);
    }

    // Locate handoff record
    const handoffs = this.agentHandoffService.listByTargetRun(workerRunId);
    if (handoffs.length === 0) {
      throw new Error(`No handoff record found for worker run '${workerRunId}'`);
    }
    const handoff = handoffs[0];

    // Check for result_json
    if (handoff.result_json) {
      try {
        const parsed = JSON.parse(handoff.result_json);
        return ResultValidator.validate(parsed);
      } catch (parseErr) {
        throw new Error(`Corrupted result_json in handoff '${handoff.id}': ${parseErr.message}`);
      }
    }

    // If no result_json yet (e.g. still in progress or failed without json), format bounded result
    if (handoff.status === 'CANCELLED') {
      return ResultValidator.formatFailureResult('Worker execution was cancelled', [{ code: 'CANCELLED', message: handoff.error_info || 'Run cancelled' }], { status: 'CANCELLED', verification_status: 'SKIPPED' });
    }
    if (handoff.status === 'FAILED') {
      return ResultValidator.formatFailureResult(handoff.error_info || 'Worker execution failed', [{ code: 'FAILED', message: handoff.error_info || 'Unknown error' }]);
    }

    return {
      status: handoff.status,
      summary: handoff.objective,
      artifact_refs: handoff.artifact_refs ? JSON.parse(handoff.artifact_refs) : [],
      context_refs: handoff.context_refs ? JSON.parse(handoff.context_refs) : [],
      verification_status: 'SKIPPED',
      errors: []
    };
  }

  /**
   * 6. Cancel worker execution and enforce cancellation rules.
   */
  async cancelWorker(workerRunId, reason = 'Worker cancelled by coordinator') {
    const workerRun = this.agentRunDao.getById(workerRunId);
    if (!workerRun) throw new Error(`Worker run '${workerRunId}' not found`);

    // Release any active mutation locks
    const activeLock = this._activeLocks.get(workerRunId);
    if (activeLock) {
      this.lockManager.release(activeLock.path, activeLock.token);
      this._activeLocks.delete(workerRunId);
    }

    // Update run state to CANCELLED in ExecutionController
    await this.executionController.completeRun(workerRunId, 'CANCELLED', reason).catch(() => {
      this.agentRunDao.updateStatus(workerRunId, 'CANCELLED', reason, null, new Date().toISOString());
    });

    // Cancel related handoffs
    const handoffs = this.agentHandoffService.listByTargetRun(workerRunId);
    for (const h of handoffs) {
      await this.agentHandoffService.cancelHandoff(h.id, reason);
    }

    logger.info(`[AgentCoordinator] Cancelled worker run ${workerRunId}: ${reason}`);
    return { runId: workerRunId, status: 'CANCELLED' };
  }

  /**
   * 7. Cancel entire task, cascading to all runs and handoffs.
   */
  async cancelTask(taskId, reason = 'Task cancelled by coordinator') {
    const task = this.agentTaskDao.getById(taskId);
    if (!task) throw new Error(`Task '${taskId}' not found`);

    this.agentTaskDao.updateStatus(taskId, 'CANCELLED');

    const runs = this.agentRunDao.listByTask(taskId);
    for (const r of runs) {
      if (r.status !== 'SUCCEEDED' && r.status !== 'FAILED' && r.status !== 'CANCELLED') {
        await this.cancelWorker(r.id, reason).catch(() => {});
      }
    }

    logger.info(`[AgentCoordinator] Cancelled task ${taskId} and all associated child runs`);
    return { taskId, status: 'CANCELLED' };
  }

  /**
   * 8. Verify a worker result independently through VERIFIER agent.
   */
  async verifyWorkerResult({ supervisorRunId, workerRunId, checks = [], options = {} }) {
    if (!supervisorRunId || !workerRunId) {
      throw new Error('supervisorRunId and workerRunId are required for verification');
    }

    const supervisorRun = this.agentRunDao.getById(supervisorRunId);
    if (!supervisorRun) throw new Error(`Supervisor run '${supervisorRunId}' not found`);

    const workerRun = this.agentRunDao.getById(workerRunId);
    if (!workerRun) throw new Error(`Worker run '${workerRunId}' not found`);

    const parentTask = this.agentTaskDao.getById(workerRun.task_id);
    if (!parentTask) throw new Error(`Task for run '${workerRunId}' not found`);

    // Collect worker result
    const workerResult = await this.collectWorkerResult(workerRunId, parentTask.user_id);

    // Delegate to VERIFIER role
    const verifierHandoff = await this.delegate({
      supervisorRunId,
      role: 'VERIFIER',
      objective: `Verify worker result for objective: ${workerResult.summary}`,
      contextRefs: workerResult.context_refs || [],
      artifactRefs: workerResult.artifact_refs || [],
      constraints: { checks }
    });

    const verifierRunId = verifierHandoff.workerRun.id;
    await this.executionController.startRun(verifierRunId);

    // Execute independent verification
    const verificationResult = await this.multiAgentVerifier.verify({
      projectId: parentTask.project_id,
      userId: parentTask.user_id,
      workerResult,
      requestedChecks: checks,
      options: {
        ...options,
        stepId: options.stepId || null
      }
    });

    // Complete verifier run
    await this.executionController.completeRun(
      verifierRunId,
      verificationResult.status === 'PASS' ? 'SUCCEEDED' : 'FAILED',
      verificationResult.status === 'PASS' ? null : verificationResult.summary
    );

    // Save canonical result to verifier handoff
    const canonicalResult = ResultValidator.validate({
      status: verificationResult.status === 'PASS' ? 'COMPLETED' : 'FAILED',
      summary: verificationResult.summary,
      artifact_refs: verificationResult.artifact_refs || [],
      context_refs: verificationResult.evidence_refs || [],
      verification_status: verificationResult.status === 'PASS' ? 'PASSED' : 'FAILED',
      errors: verificationResult.failed_checks.map(c => ({ code: c.check_type, message: c.message }))
    });

    if (verificationResult.status === 'PASS') {
      await this.agentHandoffService.completeHandoff(verifierHandoff.handoff.id, canonicalResult);
    } else {
      await this.agentHandoffService.failHandoff(verifierHandoff.handoff.id, verificationResult.summary, canonicalResult);
    }

    // Run Supervisor Arbitration
    const arbitration = this.arbitrator.evaluate({
      workerResult,
      verificationResult,
      repairAttempts: options.repairAttempts || 0,
      context: options.arbitrationContext || {}
    });

    logger.info(`[AgentCoordinator] Verification finished with verdict ${verificationResult.status}. Arbitration decision: ${arbitration.decision}`);
    return {
      verifierRunId,
      verificationResult,
      arbitration
    };
  }

  /**
   * 9. Execute bounded repair cycle on failed verification.
   */
  async executeRepairCycle({ supervisorRunId, workerRunId, repairPayload, options = {} }) {
    const currentAttempt = typeof options.repairAttempt === 'number' ? options.repairAttempt : 1;
    if (currentAttempt > this.arbitrator.maxRepairs) {
      return {
        decision: 'WAITING_FOR_USER',
        reason: `Maximum repair cycles (${this.arbitrator.maxRepairs}) reached without passing verification`,
        shouldWaitUser: true
      };
    }

    // Delegate repair task to CODER
    const coderHandoff = await this.delegate({
      supervisorRunId,
      role: 'CODER',
      objective: repairPayload.objective || 'Fix verification errors',
      contextRefs: repairPayload.evidence_refs || [],
      artifactRefs: repairPayload.artifact_refs || [],
      constraints: repairPayload.constraints || { repairAttempt: currentAttempt }
    });

    // Run repair coder
    const repairCoderResult = await this.startWorker(coderHandoff.workerRun.id, {
      runner: options.coderRunner || null,
      result: options.coderResult || {
        status: 'COMPLETED',
        summary: 'Repair code changes applied',
        artifact_refs: repairPayload.artifact_refs || [],
        context_refs: repairPayload.evidence_refs || [],
        verification_status: 'PASSED',
        errors: []
      }
    });

    // Re-run verification pipeline on repaired result
    const reverify = await this.verifyWorkerResult({
      supervisorRunId,
      workerRunId: coderHandoff.workerRun.id,
      checks: options.checks || [],
      options: {
        ...options,
        repairAttempts: currentAttempt
      }
    });

    return {
      repairAttempt: currentAttempt,
      repairedWorkerRunId: coderHandoff.workerRun.id,
      repairedWorkerResult: repairCoderResult,
      reverify
    };
  }
}

module.exports = AgentCoordinator;
