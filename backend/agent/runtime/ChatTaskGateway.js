'use strict';

const ChatTaskAdapter = require('./ChatTaskAdapter');

/**
 * Boundary between Universal Chat and the canonical autonomous execution
 * runtime. The gateway owns no tools and no second planner; it validates the
 * chat plan and delegates execution to PlannerExecutionLoop.
 */
class ChatTaskGateway {
  constructor({ plannerExecutionLoop, adapter } = {}) {
    if (!plannerExecutionLoop || typeof plannerExecutionLoop.runWithPlan !== 'function') {
      throw new Error('ChatTaskGateway requires PlannerExecutionLoop.runWithPlan');
    }
    this.plannerExecutionLoop = plannerExecutionLoop;
    this.adapter = adapter || null;
  }

  async run({ projectId, userId, taskPlan, context = {}, signal, maxRepairs = 3, onEvent = null } = {}) {
    if (!projectId || !userId) throw new Error('projectId and userId are required');
    if (!taskPlan || taskPlan.type !== 'task') throw new Error('ChatTaskGateway requires an autonomous chat task');

    const emit = (event) => {
      if (typeof onEvent === 'function') onEvent({ ...event, taskId: taskPlan.taskId || null });
    };

    if (signal?.aborted) throw new Error('Chat task canceled before execution');

    const agentPlan = this.adapter
      ? this.adapter.validateAgentPlan(this.adapter.toAgentPlan(taskPlan, context))
      : taskPlan;

    if (!Array.isArray(agentPlan.steps) || agentPlan.steps.length === 0) {
      throw new Error('Chat task has no executable tool steps');
    }

    emit({ type: 'task_phase', phase: 'planning', status: 'Plan validated' });

    try {
      const result = await this.plannerExecutionLoop.runWithPlan(
        projectId,
        userId,
        agentPlan,
        maxRepairs,
        () => Boolean(signal?.aborted)
      );

      if (result?.status === 'SUCCEEDED') {
        emit({ type: 'task_phase', phase: 'success', status: 'Task completed' });
      } else if (result?.status === 'CANCELLED') {
        emit({ type: 'task_canceled', reason: 'canceled' });
      } else {
        emit({ type: 'task_phase', phase: 'error', status: result?.reason || 'Task failed' });
      }

      return this.adapter ? this.adapter.validateResult(result) : result;
    } catch (error) {
      if (signal?.aborted) {
        emit({ type: 'task_canceled', reason: 'canceled' });
      } else {
        emit({ type: 'task_phase', phase: 'error', status: error.message });
      }
      throw error;
    }
  }
}

module.exports = ChatTaskGateway;
