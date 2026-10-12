const CapabilityPolicy = require('../policy/CapabilityPolicy');

class Supervisor {
  constructor({ runId, taskId, projectId, userId, coordinator }) {
    this.runId = runId;
    this.taskId = taskId;
    this.projectId = projectId;
    this.userId = userId;
    this.coordinator = coordinator;
    this.role = 'SUPERVISOR';
  }

  /**
   * Check whether supervisor role has permission for a capability.
   */
  canExecute(capability) {
    return CapabilityPolicy.isAllowed(this.role, capability);
  }

  /**
   * Delegate a sub-objective to a specialized worker.
   */
  async delegate({ role, objective, contextRefs = [], artifactRefs = [], constraints = {}, expectedOutput = null }) {
    CapabilityPolicy.assertAllowed(this.role, 'orchestration.manage');
    return this.coordinator.delegate({
      supervisorRunId: this.runId,
      role,
      objective,
      contextRefs,
      artifactRefs,
      constraints,
      expectedOutput
    });
  }

  /**
   * Collect worker result.
   */
  async collectResult(workerRunId) {
    CapabilityPolicy.assertAllowed(this.role, 'orchestration.manage');
    return this.coordinator.collectWorkerResult(workerRunId, this.userId);
  }

  /**
   * Cancel a worker run.
   */
  async cancelWorker(workerRunId) {
    CapabilityPolicy.assertAllowed(this.role, 'orchestration.manage');
    return this.coordinator.cancelWorker(workerRunId);
  }

  /**
   * Independently verify a worker result through a VERIFIER agent.
   */
  async verifyWorker(workerRunId, checks = [], options = {}) {
    CapabilityPolicy.assertAllowed(this.role, 'orchestration.manage');
    return this.coordinator.verifyWorkerResult({
      supervisorRunId: this.runId,
      workerRunId,
      checks,
      options
    });
  }

  /**
   * Execute bounded repair cycle.
   */
  async executeRepair(workerRunId, repairPayload, options = {}) {
    CapabilityPolicy.assertAllowed(this.role, 'orchestration.manage');
    return this.coordinator.executeRepairCycle({
      supervisorRunId: this.runId,
      workerRunId,
      repairPayload,
      options
    });
  }
}

module.exports = Supervisor;
