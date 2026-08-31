class PlannerExecutionLoop {
  constructor({ contextAssembler, taskPlanner, executionController, toolRegistry, agentTaskDao, agentRunDao }) {
    this.contextAssembler = contextAssembler;
    this.taskPlanner = taskPlanner;
    this.executionController = executionController;
    this.toolRegistry = toolRegistry;
    this.agentTaskDao = agentTaskDao;
    this.agentRunDao = agentRunDao;
    this.activeRuns = new Set();
  }

  async run(projectId, userId, intent, maxRepairs = 3) {
    const context = await this.contextAssembler.assemble(projectId, userId, intent);

    const taskId = this.executionController.generateId('task');
    this.agentTaskDao.create({
      id: taskId,
      projectId: projectId,
      userId: userId,
      title: intent,
      status: 'PENDING'
    });

    let plan;
    try {
      plan = await this.taskPlanner.generatePlan(intent, context);
    } catch (err) {
      this.agentTaskDao.updateStatus(taskId, 'FAILED');
      throw err;
    }

    const runId = this.executionController.generateId('run');
    this.agentRunDao.create({
      id: runId,
      taskId: taskId,
      status: 'PENDING'
    });

    if (this.activeRuns.has(runId)) {
      throw new Error(`Run ${runId} is already actively executing`);
    }

    await this.executionController.startRun(runId);
    this.agentTaskDao.updateStatus(taskId, 'RUNNING');

    let stepQueue = [...plan.steps];
    let repairAttempts = 0;
    let goal = plan.goal;

    return this.executeQueue(runId, taskId, context, stepQueue, repairAttempts, goal, maxRepairs);
  }

  async resume(runId, projectId, userId, maxRepairs = 3) {
    if (this.activeRuns.has(runId)) {
      throw new Error(`Run ${runId} is already actively executing`);
    }
    this.activeRuns.add(runId);

    try {
      const run = this.agentRunDao.getById(runId);
      if (!run) throw new Error(`Run ${runId} not found`);
      const task = this.agentTaskDao.getById(run.task_id);
      const intent = task ? (task.title || task.prompt || "") : "";
      const context = await this.contextAssembler.assemble(projectId, userId, intent);
      if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) {
        throw new Error(`Cannot resume a run that is ${run.status}`);
      }

      // Recover any steps that were in RUNNING state during a crash
      await this.executionController.recoverStaleSteps(runId);

      const checkpoint = await this.executionController.loadCheckpoint(runId);
      if (!checkpoint) {
        throw new Error(`Cannot resume run ${runId}: No checkpoint found.`);
      }

      const { stepQueue, repairAttempts, goal } = checkpoint;

      // Ensure run is correctly marked as RUNNING or VERIFYING based on state
      if (run.status === 'PENDING' || run.status === 'WAITING') {
        await this.executionController.startRun(runId);
      }

      return await this.executeQueue(runId, run.task_id, context, stepQueue || [], repairAttempts || 0, goal, maxRepairs);
    } catch (err) {
      this.activeRuns.delete(runId);
      throw err;
    }
  }

  async executeQueue(runId, taskId, context, initialStepQueue, initialRepairAttempts, goal, maxRepairs) {
    this.activeRuns.add(runId);
    let stepQueue = initialStepQueue;
    let repairAttempts = initialRepairAttempts;
    
    try {
      while (true) {
        await this.executionController.saveCheckpoint(runId, { stepQueue, repairAttempts, goal });

        // 1. Drain the execution step queue
        while (stepQueue.length > 0) {
          const stepDef = stepQueue.shift();
          await this.executionController.saveCheckpoint(runId, { stepQueue, repairAttempts, goal });

          const step = await this.executionController.recordStep(runId, 'TOOL', stepDef.input);
          await this.executionController.startStep(step.id);
          
          try {
            const output = await this.executionController.executeTool(
              step.id, stepDef.tool, stepDef.input, context, this.toolRegistry
            );
            
            await this.executionController.recordObservation(step.id, 'TOOL_OUTPUT', output);
            await this.executionController.completeStep(step.id, 'SUCCEEDED', output);
          } catch (err) {
            await this.executionController.recordObservation(step.id, 'TOOL_ERROR', err.message);
            await this.executionController.completeStep(step.id, 'FAILED', null, err.message);
            
            if (repairAttempts >= maxRepairs) {
              await this.executionController.completeRun(runId, 'FAILED', `Step ${step.id} failed: max repairs reached.`);
              this.agentTaskDao.updateStatus(taskId, 'FAILED');
              return { runId, status: 'FAILED', reason: 'Max repairs reached' };
            }
            
            repairAttempts++;
            await this.executionController.recordObservation(step.id, 'REPAIR_REQUEST', `Attempt ${repairAttempts}/${maxRepairs}`);
            
            const repairPlan = await this.taskPlanner.generateRepairPlan(stepDef, err.message, context);
            stepQueue.unshift(...repairPlan.steps); 
            await this.executionController.saveCheckpoint(runId, { stepQueue, repairAttempts, goal });
          }
        }

        // 2. Transition to VERIFYING state
        const run = this.agentRunDao.getById(runId);
        if (run.status !== 'VERIFYING') {
          await this.executionController.verifyRun(runId);
        }
        
        let verifyPlan;
        try {
           verifyPlan = await this.taskPlanner.generateVerificationPlan(goal, context);
        } catch (err) {
           await this.executionController.completeRun(runId, 'FAILED', `Verification planning failed: ${err.message}`);
           this.agentTaskDao.updateStatus(taskId, 'FAILED');
           return { runId, status: 'FAILED', reason: `Verification planning failed: ${err.message}` };
        }

        let allVerified = true;
        let verificationError = null;
        let failedVerifyStep = null;

        for (const vStep of verifyPlan.steps) {
           const step = await this.executionController.recordStep(runId, 'VERIFY', vStep.input);
           await this.executionController.startStep(step.id);
           try {
              const output = await this.executionController.executeTool(
                step.id, vStep.tool, vStep.input, context, this.toolRegistry
              );
              await this.executionController.recordObservation(step.id, 'VERIFICATION_OUTPUT', output);
              await this.executionController.recordVerificationResult(step.id, 'PASSED', 'Tool executed successfully', output);
              await this.executionController.completeStep(step.id, 'SUCCEEDED', output);
           } catch (err) {
              await this.executionController.recordObservation(step.id, 'VERIFICATION_FAILED', err.message);
              await this.executionController.recordVerificationResult(step.id, 'FAILED', err.message);
              await this.executionController.completeStep(step.id, 'FAILED', null, err.message);
              allVerified = false;
              verificationError = err.message;
              failedVerifyStep = vStep;
              break;
           }
        }

        if (allVerified) {
          await this.executionController.completeRun(runId, 'SUCCEEDED');
          this.agentTaskDao.updateStatus(taskId, 'COMPLETED');
          return { runId, status: 'SUCCEEDED' };
        } else {
          if (repairAttempts >= maxRepairs) {
              await this.executionController.completeRun(runId, 'FAILED', 'Verification failed and max repairs reached.');
              this.agentTaskDao.updateStatus(taskId, 'FAILED');
              return { runId, status: 'FAILED', reason: 'Verification failed, max repairs' };
          }
          
          repairAttempts++;
          await this.executionController.startRun(runId); // Transitions VERIFYING -> RUNNING
          const repairPlan = await this.taskPlanner.generateRepairPlan(failedVerifyStep, `Verification failed: ${verificationError}`, context);
          stepQueue.push(...repairPlan.steps);
          await this.executionController.saveCheckpoint(runId, { stepQueue, repairAttempts, goal });
        }
      }
    } catch (criticalError) {
      await this.executionController.completeRun(runId, 'FAILED', criticalError.message).catch(() => {});
      this.agentTaskDao.updateStatus(taskId, 'FAILED');
      return { runId, status: 'FAILED', reason: criticalError.message };
    } finally {
      this.activeRuns.delete(runId);
    }
  }
}

module.exports = PlannerExecutionLoop;
