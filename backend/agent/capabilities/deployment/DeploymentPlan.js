'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentPlan
 * 
 * Schema v1.0.0 for autonomous container deployment.
 * Enforces immutable contract, allowlisted providers, environments, and resource quotas.
 */

const crypto = require('crypto');

const DEPLOYMENT_PLAN_SCHEMA_VERSION = '1.0.0';

const ALLOWED_TARGET_ENVS = Object.freeze(['staging', 'production']);
const ALLOWED_PROVIDERS = Object.freeze(['docker', 'mock']);

const DEFAULT_RESOURCE_LIMITS = Object.freeze({
  memoryBytes: 1024 * 1024 * 1024, // 1GB
  cpus: 1.0,
  pidsLimit: 128,
  timeoutMs: 60000 // 60s startup timeout
});

const DEFAULT_RECOVERY_POLICY = Object.freeze({
  maxHealthRetries: 3,
  healthRetryIntervalsMs: Object.freeze([1000, 2000, 4000]),
  maxRestarts: 1,
  maxRollbacks: 1,
  rollbackOnFailure: true
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

class DeploymentPlan {
  /**
   * Normalize and freeze a DeploymentPlan
   * @param {object} params
   * @returns {object} Immutable DeploymentPlan
   */
  static create(params = {}) {
    if (!params || typeof params !== 'object') {
      throw new Error('DeploymentPlan: params must be an object');
    }

    const planId = params.planId || `dplan-${crypto.randomUUID()}`;
    const projectId = params.projectId || 'default-project';
    const targetEnv = (params.targetEnv || 'staging').toLowerCase();

    if (!ALLOWED_TARGET_ENVS.includes(targetEnv)) {
      throw new Error(`DeploymentPlan: targetEnv "${targetEnv}" is not allowed. Must be one of: ${ALLOWED_TARGET_ENVS.join(', ')}`);
    }

    const provider = (params.provider || 'docker').toLowerCase();
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      throw new Error(`DeploymentPlan: provider "${provider}" is not allowed. Must be one of: ${ALLOWED_PROVIDERS.join(', ')}`);
    }

    const deploymentVersion = params.deploymentVersion || '1.0.0';
    const artifactHash = params.artifactHash || crypto.createHash('sha256').update(projectId).digest('hex');

    // Service & network configuration
    const serviceConfig = params.serviceConfig || {};
    const hostPort = parseInt(serviceConfig.hostPort, 10) || (targetEnv === 'production' ? 5000 : 4000);
    const containerPort = parseInt(serviceConfig.containerPort, 10) || 3000;
    const containerName = serviceConfig.containerName || `aidost_c_${targetEnv}_${projectId}_${deploymentVersion.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    const networkName = serviceConfig.networkName || `aidost_net_${targetEnv}_${projectId}`;
    const baseImage = serviceConfig.baseImage || 'node:20-alpine';
    const dockerfilePath = serviceConfig.dockerfilePath || 'Dockerfile';
    const composeFilePath = serviceConfig.composeFilePath || null;

    const envVars = { ...(serviceConfig.envVars || {}) };
    // Force NODE_ENV to match targetEnv
    envVars.NODE_ENV = targetEnv === 'production' ? 'production' : 'staging';
    envVars.PORT = String(containerPort);

    const volumes = Array.isArray(serviceConfig.volumes) ? [...serviceConfig.volumes] : [];

    const normalizedPlan = {
      schemaVersion: DEPLOYMENT_PLAN_SCHEMA_VERSION,
      planId,
      projectId,
      targetEnv,
      provider,
      deploymentVersion,
      artifactHash,
      serviceConfig: {
        containerName,
        networkName,
        baseImage,
        dockerfilePath,
        composeFilePath,
        hostPort,
        containerPort,
        envVars,
        volumes,
        healthCheck: {
          path: serviceConfig.healthCheck?.path || '/health',
          expectedStatus: 200,
          expectedSchema: { status: 'ok' },
          timeoutMs: 3000
        }
      },
      resourceLimits: {
        memoryBytes: params.resourceLimits?.memoryBytes || DEFAULT_RESOURCE_LIMITS.memoryBytes,
        cpus: params.resourceLimits?.cpus || DEFAULT_RESOURCE_LIMITS.cpus,
        pidsLimit: params.resourceLimits?.pidsLimit || DEFAULT_RESOURCE_LIMITS.pidsLimit,
        timeoutMs: params.resourceLimits?.timeoutMs || DEFAULT_RESOURCE_LIMITS.timeoutMs
      },
      recoveryPolicy: {
        maxHealthRetries: params.recoveryPolicy?.maxHealthRetries || DEFAULT_RECOVERY_POLICY.maxHealthRetries,
        healthRetryIntervalsMs: params.recoveryPolicy?.healthRetryIntervalsMs || DEFAULT_RECOVERY_POLICY.healthRetryIntervalsMs,
        maxRestarts: params.recoveryPolicy?.maxRestarts !== undefined ? params.recoveryPolicy.maxRestarts : DEFAULT_RECOVERY_POLICY.maxRestarts,
        maxRollbacks: params.recoveryPolicy?.maxRollbacks !== undefined ? params.recoveryPolicy.maxRollbacks : DEFAULT_RECOVERY_POLICY.maxRollbacks,
        rollbackOnFailure: params.recoveryPolicy?.rollbackOnFailure !== false
      },
      createdAt: params.createdAt || Date.now()
    };

    return deepFreeze(normalizedPlan);
  }
}

module.exports = {
  DeploymentPlan,
  DEPLOYMENT_PLAN_SCHEMA_VERSION,
  ALLOWED_TARGET_ENVS,
  ALLOWED_PROVIDERS,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_RECOVERY_POLICY,
  deepFreeze
};
