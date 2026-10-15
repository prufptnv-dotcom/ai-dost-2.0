'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentProvider
 * 
 * Abstract interface for deployment adapters.
 * Guarantees standard lifecycle hooks across Docker, Mock, and future cloud targets.
 */

class DeploymentProvider {
  /**
   * Provider identifier
   */
  get name() {
    throw new Error('DeploymentProvider: name getter must be implemented');
  }

  /**
   * Check if the deployment environment / daemon is available
   * @returns {Promise<{ available: boolean, reason?: string }>}
   */
  async checkAvailability() {
    throw new Error('DeploymentProvider: checkAvailability() must be implemented');
  }

  /**
   * Build container or deployment bundle
   * @param {object} plan - DeploymentPlan
   * @param {string} workspaceRoot - Absolute path to project workspace
   * @returns {Promise<{ success: boolean, imageTag?: string, error?: string, buildLogs?: string[] }>}
   */
  async build(plan, workspaceRoot) {
    throw new Error('DeploymentProvider: build() must be implemented');
  }

  /**
   * Deploy and start the container
   * @param {object} plan - DeploymentPlan
   * @param {string} imageTag - Built image or artifact identifier
   * @returns {Promise<{ success: boolean, containerId?: string, hostPort?: number, error?: string }>}
   */
  async deploy(plan, imageTag) {
    throw new Error('DeploymentProvider: deploy() must be implemented');
  }

  /**
   * Stop running deployment
   * @param {string} containerId - Container or deployment ID
   * @returns {Promise<boolean>}
   */
  async stop(containerId) {
    throw new Error('DeploymentProvider: stop() must be implemented');
  }

  /**
   * Fetch logs from deployed service
   * @param {string} containerId
   * @param {number} lines
   * @returns {Promise<string[]>}
   */
  async getLogs(containerId, lines = 50) {
    throw new Error('DeploymentProvider: getLogs() must be implemented');
  }

  /**
   * Clean up container and associated ephemeral resources
   * @param {string} containerId
   * @returns {Promise<boolean>}
   */
  async destroy(containerId) {
    throw new Error('DeploymentProvider: destroy() must be implemented');
  }
}

module.exports = {
  DeploymentProvider
};
