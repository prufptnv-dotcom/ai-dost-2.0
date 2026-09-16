'use strict';

const logger = require('../../logger');
const TaskIdempotencyStore = require('./TaskIdempotencyStore');
const defaultIdempotencyStore = new TaskIdempotencyStore({
  ttlMs: Number(process.env.AGENT_TASK_IDEMPOTENCY_TTL_MS) || 10 * 60 * 1000,
  maxEntries: Number(process.env.AGENT_TASK_IDEMPOTENCY_MAX_ENTRIES) || 2000,
});

function durationMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

class ChatTaskGateway {
  constructor({ plannerExecutionLoop, adapter, taskPlanner, contextAssembler, idempotencyStore } = {}) {
    if (!plannerExecutionLoop || typeof plannerExecutionLoop.runWithPlan !== 'function') {
      throw new Error('ChatTaskGateway requires PlannerExecutionLoop.runWithPlan');
    }
    this.plannerExecutionLoop = plannerExecutionLoop;
    this.adapter = adapter || null;
    this.taskPlanner = taskPlanner || null;
    this.contextAssembler = contextAssembler || null;
    this.idempotencyStore = idempotencyStore || defaultIdempotencyStore;
  }

  async run({ projectId, userId, taskPlan, context = {}, signal, maxRepairs = 3, onEvent = null } = {}) {
    if (!projectId || !userId) throw new Error('projectId and userId are required');
    if (!taskPlan || taskPlan.intent?.type !== 'task') throw new Error('ChatTaskGateway requires an autonomous chat task');

    const startedAt = Date.now();
    const taskId = typeof taskPlan.taskId === 'string' && taskPlan.taskId.trim() ? taskPlan.taskId.trim() : null;
    const identity = taskId ? { taskId, projectId, userId } : null;
    const existing = identity ? this.idempotencyStore.begin(identity) : { state: 'untracked' };
    if (existing.state === 'running') {
      const error = new Error(`Task ${taskId} is already running`);
      error.code = 'TASK_IN_PROGRESS';
      logger.warn('[AgentTask] duplicate task rejected', { taskId, projectId });
      throw error;
    }
    if (existing.state === 'completed' || existing.state === 'canceled') {
      if (typeof onEvent === 'function') {
        onEvent({ type: 'task_replay', taskId, status: existing.state, durationMs: durationMs(startedAt) });
        for (const event of existing.entry.events || []) onEvent({ ...event, taskId });
      }
      logger.info('[AgentTask] terminal result replayed', { taskId, projectId, state: existing.state });
      return existing.entry.result;
    }
    if (existing.state === 'failed') {
      const error = new Error(existing.entry.error || 'Task previously failed');
      error.code = 'TASK_REPLAY_FAILED';
      logger.warn('[AgentTask] failed task replay rejected', { taskId, projectId });
      throw error;
    }

    const emit = (event) => {
      const enriched = { ...event, taskId };
      if (identity) this.idempotencyStore.recordEvent(identity, enriched);
      if (typeof onEvent === 'function') onEvent(enriched);
    };

    if (signal?.aborted) {
      const result = { status: 'CANCELLED', taskId };
      if (identity) this.idempotencyStore.complete(identity, result);
      logger.info('[AgentTask] task canceled before planning', { taskId, projectId, durationMs: durationMs(startedAt) });
      throw new Error('Chat task canceled before execution');
    }

    let agentPlan;
    try {
      if (this.taskPlanner && this.contextAssembler && taskPlan.intent?.originalMessage) {
        const intent = String(taskPlan.intent.originalMessage);
        const plannerContext = { ...(context || {}), chatTaskPlan: taskPlan };
        const assembledContext = await this.contextAssembler.assemble(projectId, userId, intent);
        agentPlan = await this.taskPlanner.generatePlan(intent, { ...assembledContext, ...plannerContext });
      } else {
        if (!this.adapter) throw new Error('ChatTaskGateway requires a canonical TaskPlanner or adapter');
        agentPlan = this.adapter.validateAgentPlan(this.adapter.toAgentPlan(taskPlan, context));
      }
    } catch (error) {
      if (identity) this.idempotencyStore.fail(identity, error);
      logger.error('[AgentTask] planning failed', { taskId, projectId, durationMs: durationMs(startedAt), error: error.message });
      throw error;
    }

    if (!Array.isArray(agentPlan?.steps) || agentPlan.steps.length === 0) {
      const error = new Error('Canonical chat task has no executable tool steps');
      if (identity) this.idempotencyStore.fail(identity, error);
      logger.error('[AgentTask] empty execution plan', { taskId, projectId, durationMs: durationMs(startedAt) });
      throw error;
    }

    emit({ type: 'task_phase', phase: 'planning', status: 'Canonical plan validated' });

    try {
      const result = await this.plannerExecutionLoop.runWithPlan(
        projectId, userId, agentPlan, maxRepairs,
        () => Boolean(signal?.aborted), taskId
      );

      // Validate the result before recording terminal idempotency state. If
      // validation fails, the catch block marks the task as failed instead of
      // incorrectly persisting an apparently completed result.
      const validatedResult = this.adapter && typeof this.adapter.validateResult === 'function'
        ? this.adapter.validateResult(result)
        : result;

      if (identity) this.idempotencyStore.complete(identity, validatedResult);
      const elapsed = durationMs(startedAt);
      if (validatedResult?.status === 'SUCCEEDED') {
        emit({ type: 'task_phase', phase: 'success', status: 'Task completed', durationMs: elapsed });
        logger.info('[AgentTask] task completed', { taskId, projectId, durationMs: elapsed });
      } else if (validatedResult?.status === 'CANCELLED') {
        emit({ type: 'task_canceled', reason: 'canceled', durationMs: elapsed });
        logger.info('[AgentTask] task canceled', { taskId, projectId, durationMs: elapsed });
      } else {
        emit({ type: 'task_phase', phase: 'error', status: validatedResult?.reason || 'Task failed', durationMs: elapsed });
        logger.warn('[AgentTask] task failed', { taskId, projectId, durationMs: elapsed, status: validatedResult?.status });
      }

      return validatedResult;
    } catch (error) {
      if (identity) this.idempotencyStore.fail(identity, error);
      const elapsed = durationMs(startedAt);
      if (signal?.aborted) {
        emit({ type: 'task_canceled', reason: 'canceled', durationMs: elapsed });
        logger.info('[AgentTask] task canceled during execution', { taskId, projectId, durationMs: elapsed });
      } else {
        emit({ type: 'task_phase', phase: 'error', status: error.message, durationMs: elapsed });
        logger.error('[AgentTask] task execution error', { taskId, projectId, durationMs: elapsed, error: error.message });
      }
      throw error;
    }
  }
}

module.exports = ChatTaskGateway;
