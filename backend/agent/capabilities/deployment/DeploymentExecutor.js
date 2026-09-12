'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentExecutor
 * 
 * Main orchestrator executing the full staged deployment pipeline:
 * 1. Plan compilation & validation (Dockerfile, Compose, ports, mounts).
 * 2. Concurrency locking per (projectId, targetEnv).
 * 3. Staging vs Production separation & approval token reservation.
 * 4. Image building with offline boundary (--network=none).
 * 5. Container deployment with loopback IP binding (127.0.0.1).
 * 6. Runtime health verification (TCP, HTTP /health schema, smoke).
 * 7. Bounded self-recovery & best-effort rollback with post-rollback health checks.
 * 8. Idempotent cleanup across all terminal paths.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { DeploymentPlan } = require('./DeploymentPlan');
const { DeploymentValidator } = require('./DeploymentValidator');
const { DeploymentHealthChecker } = require('./DeploymentHealthChecker');
const { DeploymentRollbackManager } = require('./DeploymentRollbackManager');
const { ApprovalTokenManager, defaultApprovalTokenManager } = require('./ApprovalTokenManager');
const { DeploymentAuditLogger } = require('./DeploymentAuditLogger');
const { DeploymentResult, DEPLOYMENT_STATUS, OPERATIONAL_LABELS } = require('./DeploymentResult');
const { MockDeploymentAdapter } = require('./MockDeploymentAdapter');
const { LocalDockerAdapter } = require('./LocalDockerAdapter');

class DeploymentExecutor {
  constructor(options = {}) {
    this.tokenManager = options.tokenManager || defaultApprovalTokenManager;
    this.rollbackManager = options.rollbackManager || new DeploymentRollbackManager();
    this.auditLogger = options.auditLogger || new DeploymentAuditLogger();
    this.mockProvider = options.mockProvider || new MockDeploymentAdapter();
    this.dockerProvider = options.dockerProvider || new LocalDockerAdapter();

    // Active execution concurrency locks: `${projectId}:${targetEnv}` -> deploymentId
    this._activeLocks = new Map();
  }

  /**
   * Acquire execution lock
   * @param {string} projectId
   * @param {string} targetEnv
   * @param {string} deploymentId
   * @returns {boolean}
   */
  _acquireLock(projectId, targetEnv, deploymentId) {
    const key = `${projectId}:${targetEnv}`;
    if (this._activeLocks.has(key)) {
      return false;
    }
    this._activeLocks.set(key, deploymentId);
    return true;
  }

  /**
   * Release execution lock
   * @param {string} projectId
   * @param {string} targetEnv
   */
  _releaseLock(projectId, targetEnv) {
    const key = `${projectId}:${targetEnv}`;
    this._activeLocks.delete(key);
  }

  /**
   * Resolve appropriate provider
   * @param {string} providerName
   * @returns {DeploymentProvider}
   */
  _getProvider(providerName) {
    if (providerName === 'mock') {
      return this.mockProvider;
    }
    return this.dockerProvider;
  }

  /**
   * Main deployment execution method
   * @param {object|DeploymentPlan} planInput - Raw plan or normalized DeploymentPlan
   * @param {string} workspaceRoot - Absolute path to workspace
   * @param {object} context - Execution context { approvalTokenSecret, forceProvider }
   * @returns {Promise<DeploymentResult>}
   */
  async execute(planInput, workspaceRoot, context = {}) {
    const startTime = Date.now();
    let currentContainerId = null;
    let tokenReserved = false;
    let tokenConsumed = false;
    let plan;

    // 1. Normalize Plan
    try {
      plan = planInput.schemaVersion ? planInput : DeploymentPlan.create(planInput);
    } catch (err) {
      this.auditLogger.log('VALIDATION_FAILED', {
        projectId: planInput?.projectId,
        targetEnv: planInput?.targetEnv,
        details: { error: err.message }
      });
      return DeploymentResult.create({
        projectId: planInput?.projectId,
        targetEnv: planInput?.targetEnv,
        status: DEPLOYMENT_STATUS.VALIDATION_FAILED,
        errors: [err.message],
        durationMs: Date.now() - startTime
      });
    }

    const { projectId, targetEnv, provider: providerName } = plan;
    const deploymentId = `dep-${crypto.randomUUID()}`;

    // 2. Concurrency Lock
    if (!this._acquireLock(projectId, targetEnv, deploymentId)) {
      return DeploymentResult.create({
        deploymentId,
        projectId,
        targetEnv,
        status: DEPLOYMENT_STATUS.VALIDATION_FAILED,
        errors: [`DEPLOYMENT_IN_PROGRESS: Another deployment is currently active for ${projectId} in ${targetEnv}`],
        durationMs: Date.now() - startTime
      });
    }

    const provider = context.forceProvider ? this._getProvider(context.forceProvider) : this._getProvider(providerName);
    const operationalLabel = provider.name === 'mock' 
      ? OPERATIONAL_LABELS.MOCK_VERIFIED 
      : OPERATIONAL_LABELS.DOCKER_VERIFIED;

    this.auditLogger.log('STATE_TRANSITION', {
      projectId, targetEnv, fromState: DEPLOYMENT_STATUS.PLANNED, toState: DEPLOYMENT_STATUS.VALIDATED
    });

    try {
      // 3. Validate Port
      const portVal = DeploymentValidator.validatePort(plan.serviceConfig.hostPort);
      if (!portVal.valid) {
        throw new Error(portVal.error);
      }

      // 4. Validate Dockerfile if present
      const dockerfilePath = path.resolve(workspaceRoot, plan.serviceConfig.dockerfilePath);
      if (fs.existsSync(dockerfilePath)) {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        const dfVal = DeploymentValidator.validateDockerfile(content);
        if (!dfVal.valid) {
          throw new Error(`DOCKERFILE_VALIDATION_FAILED: ${dfVal.errors.join('; ')}`);
        }
      }

      // 5. Staging vs Production & Approval Token Gate
      if (targetEnv === 'production') {
        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.VALIDATED, toState: DEPLOYMENT_STATUS.APPROVAL_PENDING
        });

        if (!context.approvalTokenSecret) {
          throw new Error('APPROVAL_TOKEN_REQUIRED: Production deployment requires a valid single-use approval token');
        }

        const reserveRes = this.tokenManager.reserveToken(context.approvalTokenSecret, {
          projectId,
          currentArtifactHash: plan.artifactHash
        });

        if (!reserveRes.success) {
          throw new Error(`APPROVAL_RESERVATION_FAILED: ${reserveRes.error}`);
        }

        tokenReserved = true;
        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.APPROVAL_PENDING, toState: DEPLOYMENT_STATUS.APPROVAL_RESERVED,
          tokenSecret: context.approvalTokenSecret
        });
      }

      // 6. Check Provider Availability
      const avail = await provider.checkAvailability();
      if (!avail.available) {
        if (provider.name === 'docker') {
          this._releaseLock(projectId, targetEnv);
          return DeploymentResult.create({
            deploymentId,
            projectId,
            targetEnv,
            provider: provider.name,
            status: DEPLOYMENT_STATUS.VALIDATION_FAILED,
            operationalLabel: OPERATIONAL_LABELS.SKIPPED_MISSING_DOCKER,
            errors: [`SKIPPED_MISSING_DOCKER: ${avail.reason}`],
            durationMs: Date.now() - startTime
          });
        }
        throw new Error(`PROVIDER_UNAVAILABLE: ${avail.reason}`);
      }

      // 7. Building Stage
      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.VALIDATED, toState: DEPLOYMENT_STATUS.BUILDING
      });

      const buildRes = await provider.build(plan, workspaceRoot);
      if (!buildRes.success) {
        // Pre-mutation failure: release token reservation if reserved
        if (tokenReserved && !tokenConsumed) {
          const parsed = this.tokenManager._parseTokenSecret(context.approvalTokenSecret);
          this.tokenManager.releaseReservation(parsed.tokenId);
        }

        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.BUILDING, toState: DEPLOYMENT_STATUS.BUILD_FAILED
        });

        this._releaseLock(projectId, targetEnv);
        return DeploymentResult.create({
          deploymentId,
          projectId,
          targetEnv,
          provider: provider.name,
          status: DEPLOYMENT_STATUS.BUILD_FAILED,
          operationalLabel,
          errors: [buildRes.error],
          durationMs: Date.now() - startTime
        });
      }

      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.BUILDING, toState: DEPLOYMENT_STATUS.BUILT
      });

      // 8. Irreversible Mutation Point Reached: Burn Token
      if (tokenReserved && !tokenConsumed) {
        const parsed = this.tokenManager._parseTokenSecret(context.approvalTokenSecret);
        this.tokenManager.consumeToken(parsed.tokenId);
        tokenConsumed = true;
      }

      // 9. Deploying Stage
      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.BUILT, toState: DEPLOYMENT_STATUS.DEPLOYING
      });

      const deployRes = await provider.deploy(plan, buildRes.imageTag);
      if (!deployRes.success) {
        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.DEPLOYING, toState: DEPLOYMENT_STATUS.DEPLOYMENT_FAILED
        });

        this._releaseLock(projectId, targetEnv);
        return DeploymentResult.create({
          deploymentId,
          projectId,
          targetEnv,
          provider: provider.name,
          status: DEPLOYMENT_STATUS.DEPLOYMENT_FAILED,
          operationalLabel,
          errors: [deployRes.error],
          durationMs: Date.now() - startTime
        });
      }

      currentContainerId = deployRes.containerId;

      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.DEPLOYING, toState: DEPLOYMENT_STATUS.DEPLOYED
      });

      // 10. Health Checking Stage
      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.DEPLOYED, toState: DEPLOYMENT_STATUS.HEALTH_CHECKING
      });

      const healthRes = await DeploymentHealthChecker.verifyWithRetries(
        plan.serviceConfig.hostPort,
        plan.recoveryPolicy
      );

      if (healthRes.healthy) {
        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.HEALTH_CHECKING, toState: DEPLOYMENT_STATUS.HEALTHY
        });

        // Register as verified known-good deployment
        this.rollbackManager.registerKnownGood({
          deploymentId,
          projectId,
          targetEnv,
          containerId: currentContainerId,
          hostPort: plan.serviceConfig.hostPort,
          imageTag: buildRes.imageTag,
          deploymentVersion: plan.deploymentVersion,
          plan
        });

        this._releaseLock(projectId, targetEnv);
        return DeploymentResult.create({
          deploymentId,
          projectId,
          targetEnv,
          provider: provider.name,
          status: DEPLOYMENT_STATUS.HEALTHY,
          operationalLabel,
          endpoint: `http://127.0.0.1:${plan.serviceConfig.hostPort}`,
          hostPort: plan.serviceConfig.hostPort,
          containerId: currentContainerId,
          imageTag: buildRes.imageTag,
          deploymentVersion: plan.deploymentVersion,
          artifactHash: plan.artifactHash,
          healthProbes: healthRes.probes,
          auditTrail: this.auditLogger.getLogs(),
          durationMs: Date.now() - startTime
        });
      }

      // 11. Health Probes Failed -> Bounded Self-Recovery Loop
      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.HEALTH_CHECKING, toState: DEPLOYMENT_STATUS.UNHEALTHY,
        details: { error: healthRes.error }
      });

      // Attempt 1: Bounded Restart (if restart policy allows)
      if (plan.recoveryPolicy.maxRestarts > 0) {
        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.UNHEALTHY, toState: DEPLOYMENT_STATUS.STOPPING
        });

        await provider.stop(currentContainerId);

        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.STOPPING, toState: DEPLOYMENT_STATUS.DEPLOYING
        });

        const restartRes = await provider.deploy(plan, buildRes.imageTag);
        if (restartRes.success) {
          currentContainerId = restartRes.containerId;
          const recheckHealth = await DeploymentHealthChecker.verifyWithRetries(
            plan.serviceConfig.hostPort,
            plan.recoveryPolicy
          );

          if (recheckHealth.healthy) {
            this.auditLogger.log('STATE_TRANSITION', {
              projectId, targetEnv, fromState: DEPLOYMENT_STATUS.DEPLOYING, toState: DEPLOYMENT_STATUS.HEALTHY
            });

            this.rollbackManager.registerKnownGood({
              deploymentId,
              projectId,
              targetEnv,
              containerId: currentContainerId,
              hostPort: plan.serviceConfig.hostPort,
              imageTag: buildRes.imageTag,
              deploymentVersion: plan.deploymentVersion,
              plan
            });

            this._releaseLock(projectId, targetEnv);
            return DeploymentResult.create({
              deploymentId,
              projectId,
              targetEnv,
              provider: provider.name,
              status: DEPLOYMENT_STATUS.HEALTHY,
              operationalLabel,
              endpoint: `http://127.0.0.1:${plan.serviceConfig.hostPort}`,
              hostPort: plan.serviceConfig.hostPort,
              containerId: currentContainerId,
              imageTag: buildRes.imageTag,
              deploymentVersion: plan.deploymentVersion,
              artifactHash: plan.artifactHash,
              healthProbes: recheckHealth.probes,
              recoveryAttempts: 1,
              auditTrail: this.auditLogger.getLogs(),
              durationMs: Date.now() - startTime
            });
          }
        }
      }

      // 12. Restart Failed / Exhausted -> Best-Effort Rollback
      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.UNHEALTHY, toState: DEPLOYMENT_STATUS.ROLLBACK_PENDING
      });

      const rollbackRes = await this.rollbackManager.executeRollback({
        plan,
        failedContainerId: currentContainerId
      }, provider);

      if (rollbackRes.success && rollbackRes.status === 'ROLLED_BACK') {
        this.auditLogger.log('STATE_TRANSITION', {
          projectId, targetEnv, fromState: DEPLOYMENT_STATUS.ROLLBACK_PENDING, toState: DEPLOYMENT_STATUS.ROLLED_BACK
        });

        this._releaseLock(projectId, targetEnv);
        return DeploymentResult.create({
          deploymentId,
          projectId,
          targetEnv,
          provider: provider.name,
          status: DEPLOYMENT_STATUS.ROLLED_BACK,
          operationalLabel,
          endpoint: `http://127.0.0.1:${rollbackRes.rolledBackRecord.hostPort}`,
          hostPort: rollbackRes.rolledBackRecord.hostPort,
          containerId: rollbackRes.rolledBackRecord.containerId,
          imageTag: rollbackRes.rolledBackRecord.imageTag,
          deploymentVersion: rollbackRes.rolledBackRecord.version,
          rollbackPerformed: true,
          rolledBackTo: rollbackRes.rolledBackRecord,
          errors: [healthRes.error],
          auditTrail: this.auditLogger.getLogs(),
          durationMs: Date.now() - startTime
        });
      }

      // 13. Rollback Failed or No Prior Deployment Exists
      const finalFailState = rollbackRes.status === 'RECOVERY_EXHAUSTED'
        ? DEPLOYMENT_STATUS.RECOVERY_EXHAUSTED
        : DEPLOYMENT_STATUS.ROLLBACK_FAILED;

      this.auditLogger.log('STATE_TRANSITION', {
        projectId, targetEnv, fromState: DEPLOYMENT_STATUS.ROLLBACK_PENDING, toState: finalFailState,
        details: { error: rollbackRes.error }
      });

      this._releaseLock(projectId, targetEnv);
      return DeploymentResult.create({
        deploymentId,
        projectId,
        targetEnv,
        provider: provider.name,
        status: finalFailState,
        operationalLabel,
        errors: [healthRes.error, rollbackRes.error],
        auditTrail: this.auditLogger.getLogs(),
        durationMs: Date.now() - startTime
      });

    } catch (err) {
      // Idempotent exception cleanup
      if (currentContainerId) {
        try { await provider.destroy(currentContainerId); } catch {}
      }
      if (tokenReserved && !tokenConsumed) {
        try {
          const parsed = this.tokenManager._parseTokenSecret(context.approvalTokenSecret);
          this.tokenManager.releaseReservation(parsed.tokenId);
        } catch {}
      }

      this._releaseLock(projectId, targetEnv);
      return DeploymentResult.create({
        deploymentId,
        projectId,
        targetEnv,
        provider: provider.name,
        status: DEPLOYMENT_STATUS.VALIDATION_FAILED,
        operationalLabel,
        errors: [err.message],
        durationMs: Date.now() - startTime
      });
    }
  }
}

module.exports = {
  DeploymentExecutor
};
