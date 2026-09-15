'use strict';

/**
 * Boundary between Universal Chat and the canonical autonomous execution
 * runtime. The gateway validates chat intent and delegates planning/execution
 * to the canonical TaskPlanner + PlannerExecutionLoop stack.
 */
class ChatTaskGateway {
  constructor({ plannerExecutionLoop, adapter, taskPlanner, contextAssembler } = {}) {
    if (!plannerExecutionLoop || typeof plannerExecutionLoop.runWithPlan !== 'function') {
      throw new Error('ChatTaskGateway requires PlannerExecutionLoop.runWithPlan');
    }
    this.plannerExecutionLoop = plannerExecutionLoop;
    this.adapter = adapter || null;
    this.taskPlanner = taskPlanner || null;
    this.contextAssembler = contextAssembler || null;
  }

  async run({ projectId, userId, taskPlan, context = {}, signal, maxRepairs = 3, onEvent = null } = {}) {
    if (!projectId || !userId) throw new Error('projectId and userId are required');
    if (!taskPlan || taskPlan.intent?.type !== 'task') throw new Error('ChatTaskGateway requires an autonomous chat task');

    const emit = (event) => {
      if (typeof onEvent === 'function') onEvent({ ...event, taskId: taskPlan.taskId || null });
    };

    if (signal?.aborted) throw new Error('Chat task canceled before execution');

    let agentPlan;
    if (this.taskPlanner && this.contextAssembler && taskPlan.intent?.originalMessage) {
      const intent = String(taskPlan.intent.originalMessage);
      const plannerContext = {
        ...(context || {}),
        chatTaskPlan: taskPlan,
      };
      const assembledContext = await this.contextAssembler.assemble(projectId, userId, intent);
      agentPlan = await this.taskPlanner.generatePlan(intent, { ...assembledContext, ...plannerContext });
    } else {
      if (!this.adapter) throw new Error('ChatTaskGateway requires a canonical TaskPlanner or adapter');
      agentPlan = this.adapter.validateAgentPlan(this.adapter.toAgentPlan(taskPlan, context));
    }

    if (!Array.isArray(agentPlan?.steps) || agentPlan.steps.length === 0) {
      throw new Error('Canonical chat task has no executable tool steps');
    }

    emit({ type: 'task_phase', phase: 'planning', status: 'Canonical plan validated' });

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

      return this.adapter && typeof this.adapter.validateResult === 'function'
        ? this.adapter.validateResult(result)
        : result;
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