const crypto = require('crypto');
const { getDatabase } = require('../db');
const AgentHandoffDAO = require('../db/dao/AgentHandoffDAO');
const { ResultValidator } = require('../agent/runtime/resultValidator');
const logger = require('../logger');

class AgentHandoffService {
  constructor(db = null) {
    this._db = db;
    this._dao = null;
  }

  get db() {
    return this._db || getDatabase();
  }

  get dao() {
    if (!this._dao) {
      this._dao = new AgentHandoffDAO(this.db);
    }
    return this._dao;
  }

  generateId(prefix = 'handoff') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Create a new handoff or return an existing active one for idempotent delegation.
   */
  async createHandoff({
    taskId,
    sourceRunId,
    targetRunId = null,
    sourceAgent,
    targetAgent,
    objective,
    contextRefs = [],
    artifactRefs = [],
    constraints = {},
    expectedOutput = null,
    expiresAt = null
  }) {
    if (!taskId || !sourceRunId || !sourceAgent || !targetAgent || !objective) {
      throw new Error('Missing required fields for handoff creation: taskId, sourceRunId, sourceAgent, targetAgent, objective');
    }

    // 1. Check logical idempotency: if an active handoff with the same parameters exists, return it
    const existingActive = this.dao.findActiveHandoff(taskId, sourceRunId, targetAgent, objective);
    if (existingActive) {
      logger.info(`[AgentHandoffService] Returning existing active handoff ${existingActive.id} for task ${taskId}`);
      return existingActive;
    }

    // 2. Create new handoff record
    const id = this.generateId('handoff');
    const created = this.dao.create({
      id,
      taskId,
      sourceRunId,
      targetRunId,
      sourceAgent,
      targetAgent,
      objective,
      status: 'PENDING',
      contextRefs,
      artifactRefs,
      constraints,
      expectedOutput,
      expiresAt
    });

    logger.info(`[AgentHandoffService] Created handoff ${id} from ${sourceAgent} (${sourceRunId}) to ${targetAgent}`);
    return created;
  }

  /**
   * Accept a pending handoff by assigning a target run.
   */
  async acceptHandoff(handoffId, targetRunId) {
    const handoff = this.dao.getById(handoffId);
    if (!handoff) throw new Error(`Handoff ${handoffId} not found`);

    if (handoff.status === 'CANCELLED') {
      throw new Error(`Cannot accept cancelled handoff ${handoffId}`);
    }

    if (handoff.status !== 'PENDING' && handoff.status !== 'ACCEPTED') {
      throw new Error(`Invalid state transition: Cannot accept handoff from ${handoff.status}`);
    }

    return this.dao.updateTargetRun(handoffId, targetRunId, 'ACCEPTED');
  }

  /**
   * Start handoff execution.
   */
  async startHandoff(handoffId) {
    const handoff = this.dao.getById(handoffId);
    if (!handoff) throw new Error(`Handoff ${handoffId} not found`);

    if (handoff.status === 'CANCELLED') {
      throw new Error(`Cannot start cancelled handoff ${handoffId}`);
    }

    return this.dao.updateStatus(handoffId, 'IN_PROGRESS');
  }

  /**
   * Complete handoff with canonical structured result.
   */
  async completeHandoff(handoffId, resultObj) {
    const handoff = this.dao.getById(handoffId);
    if (!handoff) throw new Error(`Handoff ${handoffId} not found`);

    // Late completion race protection: If already cancelled, do not revert to COMPLETED
    if (handoff.status === 'CANCELLED') {
      logger.warn(`[AgentHandoffService] Late completion rejected: handoff ${handoffId} is already CANCELLED`);
      return handoff;
    }

    // Validate result contract
    const validated = ResultValidator.validate(resultObj);
    return this.dao.updateResult(handoffId, validated, 'COMPLETED');
  }

  /**
   * Fail handoff with structured failure result.
   */
  async failHandoff(handoffId, errorInfo, resultObj = null) {
    const handoff = this.dao.getById(handoffId);
    if (!handoff) throw new Error(`Handoff ${handoffId} not found`);

    if (handoff.status === 'CANCELLED') {
      logger.warn(`[AgentHandoffService] Late failure rejected: handoff ${handoffId} is already CANCELLED`);
      return handoff;
    }

    const structuredResult = resultObj 
      ? ResultValidator.validate(resultObj)
      : ResultValidator.formatFailureResult(
          typeof errorInfo === 'string' ? errorInfo : 'Worker execution failed',
          [{ code: 'WORKER_FAILED', message: typeof errorInfo === 'string' ? errorInfo : 'Unknown worker error' }]
        );

    const errorMessage = typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo);
    this.dao.updateStatus(handoffId, 'FAILED', errorMessage, null, new Date().toISOString());
    return this.dao.updateResult(handoffId, structuredResult, 'FAILED');
  }

  /**
   * Cancel handoff.
   */
  async cancelHandoff(handoffId, reason = 'Worker run cancelled') {
    const handoff = this.dao.getById(handoffId);
    if (!handoff) throw new Error(`Handoff ${handoffId} not found`);

    const cancellationResult = ResultValidator.formatFailureResult(
      `Handoff cancelled: ${reason}`,
      [{ code: 'HANDOFF_CANCELLED', message: reason }],
      { status: 'CANCELLED', verification_status: 'SKIPPED' }
    );

    this.dao.updateStatus(handoffId, 'CANCELLED', reason, null, new Date().toISOString());
    return this.dao.updateResult(handoffId, cancellationResult, 'CANCELLED');
  }

  getHandoff(handoffId) {
    return this.dao.getById(handoffId);
  }

  listByTask(taskId) {
    return this.dao.listByTask(taskId);
  }

  listBySourceRun(sourceRunId) {
    return this.dao.listBySourceRun(sourceRunId);
  }

  listByTargetRun(targetRunId) {
    return this.dao.listByTargetRun(targetRunId);
  }
}

module.exports = AgentHandoffService;
