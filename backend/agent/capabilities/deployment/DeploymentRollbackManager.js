'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentRollbackManager
 * 
 * Enforces best-effort transactional deployment rollback with verified post-rollback health checks.
 * Manages registry of verified known-good deployments per (projectId, targetEnv).
 * Strictly terminates only deployment-owned containers/processes.
 */

const { DeploymentHealthChecker } = require('./DeploymentHealthChecker');

class DeploymentRollbackManager {
  constructor() {
    // Registry of active known-good deployments: `${projectId}:${targetEnv}` -> deploymentRecord
    this._knownGoodDeployments = new Map();
    // Registry of deployment-owned container IDs and host ports: containerId -> { port, projectId }
    this._ownedContainers = new Map();
  }

  /**
   * Register a verified healthy deployment as the current known-good record
   * @param {object} deploymentRecord
   */
  registerKnownGood(deploymentRecord) {
    if (!deploymentRecord || !deploymentRecord.projectId || !deploymentRecord.targetEnv) return;
    const key = `${deploymentRecord.projectId}:${deploymentRecord.targetEnv}`;
    this._knownGoodDeployments.set(key, { ...deploymentRecord, registeredAt: Date.now() });
    if (deploymentRecord.containerId) {
      this._ownedContainers.set(deploymentRecord.containerId, {
        port: deploymentRecord.hostPort,
        projectId: deploymentRecord.projectId,
        targetEnv: deploymentRecord.targetEnv
      });
    }
  }

  /**
   * Get the current known-good deployment for a project and environment
   * @param {string} projectId
   * @param {string} targetEnv
   * @returns {object|null}
   */
  getKnownGood(projectId, targetEnv) {
    const key = `${projectId}:${targetEnv}`;
    return this._knownGoodDeployments.get(key) || null;
  }

  /**
   * Verify if a container ID is strictly owned by this deployment system
   * @param {string} containerId
   * @returns {boolean}
   */
  isOwnedContainer(containerId) {
    return this._ownedContainers.has(containerId);
  }

  /**
   * Execute best-effort rollback:
   * 1. Teardown failed new container.
   * 2. If no prior known-good deployment exists, return RECOVERY_EXHAUSTED.
   * 3. Start / reactivate previous known-good deployment.
   * 4. Perform post-rollback health checks to confirm verified recovery.
   * 
   * @param {object} failedDeployment - { provider, failedContainerId, plan }
   * @param {object} provider - DeploymentProvider instance
   * @returns {Promise<{ success: boolean, status: string, error?: string, rolledBackRecord?: object }>}
   */
  async executeRollback(failedDeployment, provider) {
    const { plan, failedContainerId } = failedDeployment;
    const { projectId, targetEnv } = plan;

    // 1. Safe teardown of failed container
    if (failedContainerId) {
      try {
        await provider.destroy(failedContainerId);
        this._ownedContainers.delete(failedContainerId);
      } catch (err) {
        // Log cleanup warning, proceed with recovery
      }
    }

    // 2. Check for known-good record
    const prior = this.getKnownGood(projectId, targetEnv);
    if (!prior) {
      return {
        success: false,
        status: 'RECOVERY_EXHAUSTED',
        error: 'NO_PREVIOUS_KNOWN_GOOD: Cannot roll back because no previous healthy deployment exists for this project/environment'
      };
    }

    // 3. Reactivate previous deployment container
    try {
      const restartRes = await provider.deploy(prior.plan, prior.imageTag);
      if (!restartRes.success) {
        return {
          success: false,
          status: 'ROLLBACK_FAILED',
          error: `ROLLBACK_RESTART_FAILED: Could not reactivate prior container: ${restartRes.error}`
        };
      }

      // 4. Verify post-rollback health checks
      const healthRes = await DeploymentHealthChecker.verifyWithRetries(prior.hostPort, prior.plan.recoveryPolicy);
      if (!healthRes.healthy) {
        return {
          success: false,
          status: 'ROLLBACK_FAILED',
          error: `POST_ROLLBACK_HEALTH_FAILED: Restored container failed health verification: ${healthRes.error}`
        };
      }

      // Rollback is verified healthy
      return {
        success: true,
        status: 'ROLLED_BACK',
        rolledBackRecord: {
          containerId: restartRes.containerId,
          hostPort: prior.hostPort,
          imageTag: prior.imageTag,
          version: prior.deploymentVersion
        }
      };
    } catch (err) {
      return {
        success: false,
        status: 'ROLLBACK_FAILED',
        error: `ROLLBACK_EXCEPTION: ${err.message}`
      };
    }
  }

  /**
   * Clear registry (used during testing)
   */
  clear() {
    this._knownGoodDeployments.clear();
    this._ownedContainers.clear();
  }
}

module.exports = {
  DeploymentRollbackManager
};
