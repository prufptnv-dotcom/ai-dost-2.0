'use strict';

const PlannerExecutionLoop = require('./PlannerExecutionLoop');

/**
 * Chat-specific facade over the canonical PlannerExecutionLoop.
 * It does not duplicate execution, repair, verification, or tool handling.
 */
class ChatPlannerExecutionLoop extends PlannerExecutionLoop {
  async runWithPlan(projectId, userId, plan, maxRepairs = 3, isCanceled = () => false) {
    if (!plan || typeof plan !== 'object' || typeof plan.goal !== 'string') {
      throw new Error('runWithPlan requires a validated agent plan');
    }
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('runWithPlan requires at least one executable step');
    }
    if (typeof isCanceled !== 'function') throw new Error('isCanceled must be a function');

    if (isCanceled()) {
      return { runId: null, taskId: null, status: 'CANCELLED', reason: 'Canceled before execution' };
    }

    const context = await this.contextAssembler.assemble(projectId, userId, plan.goal);

    if (isCanceled()) {
      return { runId: null, taskId: null, status: 'CANCELLED', reason: 'Canceled before execution' };
    }

    const taskId = this.executionController.generateId('task_chat');
    this.agentTaskDao.create({
      id: taskId,
      projectId,
      userId,
      title: plan.goal,
      status: 'PENDING'
    });

    const runId = this.executionController.generateId('run_chat');
    this.agentRunDao.create({
      id: runId,
      taskId,
      status: 'PENDING',
      metadata: { source: 'universal-chat' }
    });

    try {
      await this.executionController.startRun(runId);
      this.agentTaskDao.updateStatus(taskId, 'RUNNING');
      this.activeRuns.add(runId);

      const result = await this.executeQueueWithCancellation(
        runId,
        taskId,
        context,
        [...plan.steps],
        0,
        plan.goal,
        maxRepairs,
        isCanceled
      );

      return { ...result, taskId, runId };
    } finally {
      this.activeRuns.delete(runId);
    }
  }
}

module.exports = ChatPlannerExecutionLoop;
