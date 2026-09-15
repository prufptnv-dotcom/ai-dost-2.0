'use strict';

const TaskIdempotencyStore = require('./TaskIdempotencyStore');
const defaultIdempotencyStore = new TaskIdempotencyStore({
  ttlMs: Number(process.env.AGENT_TASK_IDEMPOTENCY_TTL_MS) || 10 * 60 * 1000,
  maxEntries: Number(process.env.AGENT_TASK_IDEMPOTENCY_MAX_ENTRIES) || 2000,
});

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

    const taskId = typeof taskPlan.taskId === 'string' && taskPlan.taskId.trim() ? taskPlan.taskId.trim() : null;
    const identity = taskId ? { taskId, projectId, userId } : null;
    const existing = identity ? this.idempotencyStore.begin(identity) : { state: 'untracked' };
    if (existing.state === 'running') {
      const error = new Error(`Task ${taskId} is already running`);
      error.code = 'TASK_IN_PROGRESS';
      throw error;
    }
    if (existing.state === 'completed' || existing.state === 'canceled') {
      if (typeof onEvent === 'function') {
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
      if (identity) this.idempotencyStore.recordEvent(identity, enriched);
      if (typeof onEvent === 'function') onEvent(enriched);
    };

    if (signal?.aborted) {
      if (identity) this.idempotencyStore.complete(identity, { status: 'CANCELLED', taskId });
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
      throw error;
    }

    if (!Array.isArray(agentPlan?.steps) || agentPlan.steps.length === 0) {
      const error = new Error('Canonical chat task has no executable tool steps');
      if (identity) this.idempotencyStore.fail(identity, error);
      throw error;
    }

    emit({ type: 'task_phase', phase: 'planning', status: 'Canonical plan validated' });

    try {
      const result = await this.plannerExecutionLoop.runWithPlan(
        projectId, userId, agentPlan, maxRepairs,
        () => Boolean(signal?.aborted), taskId
      );

      if (identity) this.idempotencyStore.complete(identity, result);
      if (result?.status === 'SUCCEEDED') {
        emit({ type: 'task_phase', phase: 'success', status: 'Task completed' });
      } else if (result?.status === 'CANCELLED') {
        emit({ type: 'task_canceled', reason: 'canceled' });
      } else {
        emit({ type: 'task_phase', phase: 'error', status: result?.reason || 'Task failed' });
      }

      return this.adapter && typeof this.adapter.validateResult === 'function'
        ? this.adapter.validateResult(result) : result;
    } catch (error) {
      if (identity) this.idempotencyStore.fail(identity, error);
      if (signal?.aborted) emit({ type: 'task_canceled', reason: 'canceled' });
      else emit({ type: 'task_phase', phase: 'error', status: error.message });
      throw error;
    }
  }
}

module.exports = ChatTaskGateway;
