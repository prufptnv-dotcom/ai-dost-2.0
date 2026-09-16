'use strict';

const logger = require('../../logger');
const TaskIdempotencyStore = require('./TaskIdempotencyStore');
const DurableTaskStore = require('./DurableTaskStore');
const defaultIdempotencyStore = new TaskIdempotencyStore({
  ttlMs: Number(process.env.AGENT_TASK_IDEMPOTENCY_TTL_MS) || 10 * 60 * 1000,
  maxEntries: Number(process.env.AGENT_TASK_IDEMPOTENCY_MAX_ENTRIES) || 2000,
});
const defaultDurableStore = new DurableTaskStore();

function durationMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

class ChatTaskGateway {
  constructor({ plannerExecutionLoop, adapter, taskPlanner, contextAssembler, idempotencyStore, durableTaskStore } = {}) {
    if (!plannerExecutionLoop || typeof plannerExecutionLoop.runWithPlan !== 'function') {
      throw new Error('ChatTaskGateway requires PlannerExecutionLoop.runWithPlan');
    }
    this.plannerExecutionLoop = plannerExecutionLoop;
    this.adapter = adapter || null;
    this.taskPlanner = taskPlanner || null;
    this.contextAssembler = contextAssembler || null;
    this.idempotencyStore = idempotencyStore || defaultIdempotencyStore;
    this.durableTaskStore = durableTaskStore || defaultDurableStore;
  }

  async run({ projectId, userId, taskPlan, context = {}, signal, maxRepairs = 3, onEvent = null } = {}) {
    if (!projectId || !userId) throw new Error('projectId and userId are required');
    if (!taskPlan || taskPlan.intent?.type !== 'task') throw new Error('ChatTaskGateway requires an autonomous chat task');

    const startedAt = Date.now();
    const taskId = typeof taskPlan.taskId === 'string' && taskPlan.taskId.trim() ? taskPlan.taskId.trim() : null;
    const identity = taskId ? { taskId, projectId, userId } : null;
    const durable = identity ? this.durableTaskStore.begin(identity, { runId: context.runId }) : { state: 'untracked' };

    if (durable.state === 'RUNNING' || durable.state === 'WAITING' || durable.state === 'VERIFYING') {
      const error = new Error(`Task ${taskId} is already active`);
      error.code = 'TASK_IN_PROGRESS';
      throw error;
    }
    if (durable.state === 'RECOVERY_REQUIRED') {
      const error = new Error('Task requires explicit recovery review after process interruption');
      error.code = 'TASK_RECOVERY_REQUIRED';
      throw error;
    }
    if (durable.state === 'SUCCEEDED' || durable.state === 'CANCELLED') {
      const result = durable.entry.result || { status: durable.state, taskId };
      if (typeof onEvent === 'function') onEvent({ type: 'task_replay', taskId, status: durable.state });
      return result;
    }
    if (durable.state === 'FAILED') {
      const error = new Error(durable.entry.errorMessage || 'Task previously failed');
      error.code = 'TASK_REPLAY_FAILED';
      throw error;
    }

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
      return existing.entry.result;
    }
    if (existing.state === 'failed') {
      const error = new Error(existing.entry.error || 'Task previously failed');
      error.code = 'TASK_REPLAY_FAILED';
      throw error;
    }

    const emit = (event) => {
      const enriched = { ...event, taskId };
      if (identity) {
        this.idempotencyStore.recordEvent(identity, enriched);
        this.durableTaskStore.event(identity, enriched);
        this.durableTaskStore.update(identity, {
          currentPhase: enriched.phase || enriched.type || 'executing',
          currentStepId: enriched.stepId || null,
        });
      }
      if (typeof onEvent === 'function') onEvent(enriched);
    };

    if (signal?.aborted) {
      const result = { status: 'CANCELLED', taskId, reason: 'canceled_before_planning' };
      emit({ type: 'task_canceled', reason: 'canceled_before_planning', durationMs: durationMs(startedAt) });
      if (identity) {
        this.idempotencyStore.complete(identity, result);
        this.durableTaskStore.complete(identity, result);
      }
      throw Object.assign(new Error('Chat task canceled before execution'), { code: 'TASK_CANCELLED' });
    }

    let agentPlan;
    try {
      this.durableTaskStore.update(identity, { currentPhase: 'planning' });
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
      if (identity) {
        this.idempotencyStore.fail(identity, error);
        this.durableTaskStore.fail(identity, error, 'TASK_PLANNING_FAILED');
      }
      throw error;
    }

    if (!Array.isArray(agentPlan?.steps) || agentPlan.steps.length === 0) {
      const error = new Error('Canonical chat task has no executable tool steps');
      if (identity) {
        this.idempotencyStore.fail(identity, error);
        this.durableTaskStore.fail(identity, error, 'EMPTY_EXECUTION_PLAN');
      }
      throw error;
    }

    emit({ type: 'task_phase', phase: 'planning', status: 'Canonical plan validated' });

    try {
      this.durableTaskStore.update(identity, { currentPhase: 'executing', attempt: 1 });
      const result = await this.plannerExecutionLoop.runWithPlan(
        projectId, userId, agentPlan, maxRepairs,
        () => Boolean(signal?.aborted), taskId
      );

      const validatedResult = this.adapter && typeof this.adapter.validateResult === 'function'
        ? this.adapter.validateResult(result)
        : result;
      const elapsed = durationMs(startedAt);
      if (validatedResult?.status === 'SUCCEEDED') {
        emit({ type: 'task_phase', phase: 'success', status: 'Task completed', durationMs: elapsed });
      } else if (validatedResult?.status === 'CANCELLED') {
        emit({ type: 'task_canceled', reason: 'canceled', durationMs: elapsed });
      } else {
        emit({ type: 'task_phase', phase: 'error', status: validatedResult?.reason || 'Task failed', durationMs: elapsed });
      }
      if (identity) {
        this.idempotencyStore.complete(identity, validatedResult);
        this.durableTaskStore.complete(identity, validatedResult);
      }
      return validatedResult;
    } catch (error) {
      if (identity) {
        this.idempotencyStore.fail(identity, error);
        this.durableTaskStore.fail(identity, error, signal?.aborted ? 'TASK_CANCELLED' : 'TASK_EXECUTION_FAILED');
      }
      const elapsed = durationMs(startedAt);
      if (signal?.aborted) emit({ type: 'task_canceled', reason: 'canceled', durationMs: elapsed });
      else emit({ type: 'task_phase', phase: 'error', status: error.message, durationMs: elapsed });
      throw error;
    }
  }
}

module.exports = ChatTaskGateway;
