'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentResult
 * 
 * Immutable result envelope for deployment operations.
 * Holds final status, operational verification labels, health results, and audit traces.
 */

const DEPLOYMENT_STATUS = Object.freeze({
  PLANNED: 'PLANNED',
  VALIDATED: 'VALIDATED',
  APPROVAL_PENDING: 'APPROVAL_PENDING',
  APPROVAL_RESERVED: 'APPROVAL_RESERVED',
  BUILDING: 'BUILDING',
  BUILT: 'BUILT',
  DEPLOYING: 'DEPLOYING',
  DEPLOYED: 'DEPLOYED',
  HEALTH_CHECKING: 'HEALTH_CHECKING',
  HEALTHY: 'HEALTHY',
  UNHEALTHY: 'UNHEALTHY',
  HEALTH_CHECK_TIMEOUT: 'HEALTH_CHECK_TIMEOUT',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  ROLLBACK_PENDING: 'ROLLBACK_PENDING',
  ROLLED_BACK: 'ROLLED_BACK',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  RECOVERY_EXHAUSTED: 'RECOVERY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BUILD_FAILED: 'BUILD_FAILED',
  DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED',
  CANCELLED: 'CANCELLED',
  CLEANUP_PENDING: 'CLEANUP_PENDING',
  CLEANUP_FAILED: 'CLEANUP_FAILED'
});

const OPERATIONAL_LABELS = Object.freeze({
  MOCK_VERIFIED: 'MOCK_VERIFIED',
  DOCKER_VERIFIED: 'DOCKER_VERIFIED',
  SKIPPED_MISSING_DOCKER: 'SKIPPED_MISSING_DOCKER',
  IMPLEMENTED_NOT_FULLY_VERIFIED: 'IMPLEMENTED_NOT_FULLY_VERIFIED'
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

class DeploymentResult {
  /**
   * Create an immutable DeploymentResult
   * @param {object} params
   * @returns {object} Frozen result envelope
   */
  static create(params = {}) {
    const result = {
      deploymentId: params.deploymentId || `dep-${Date.now()}`,
      projectId: params.projectId || 'default-project',
      targetEnv: params.targetEnv || 'staging',
      provider: params.provider || 'mock',
      status: params.status || DEPLOYMENT_STATUS.VALIDATION_FAILED,
      operationalLabel: params.operationalLabel || OPERATIONAL_LABELS.MOCK_VERIFIED,
      endpoint: params.endpoint || null,
      hostPort: params.hostPort || null,
      containerId: params.containerId || null,
      imageTag: params.imageTag || null,
      deploymentVersion: params.deploymentVersion || '1.0.0',
      artifactHash: params.artifactHash || null,
      healthProbes: params.healthProbes || { tcp: false, httpHealth: false, frontend: false },
      recoveryAttempts: params.recoveryAttempts || 0,
      rollbackPerformed: Boolean(params.rollbackPerformed),
      rolledBackTo: params.rolledBackTo || null,
      errors: Array.isArray(params.errors) ? [...params.errors] : (params.error ? [params.error] : []),
      auditTrail: Array.isArray(params.auditTrail) ? [...params.auditTrail] : [],
      durationMs: params.durationMs || 0,
      timestamp: params.timestamp || Date.now()
    };

    return deepFreeze(result);
  }
}

module.exports = {
  DeploymentResult,
  DEPLOYMENT_STATUS,
  OPERATIONAL_LABELS,
  deepFreeze
};
