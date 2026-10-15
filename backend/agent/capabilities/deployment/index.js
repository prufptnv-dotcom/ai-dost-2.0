'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: Deployment Capability Public Facade
 */

const { SecretRedactor } = require('./SecretRedactor');
const { DeploymentPlan, DEPLOYMENT_PLAN_SCHEMA_VERSION, ALLOWED_TARGET_ENVS, ALLOWED_PROVIDERS } = require('./DeploymentPlan');
const { DeploymentValidator } = require('./DeploymentValidator');
const { DeploymentProvider } = require('./DeploymentProvider');
const { MockDeploymentAdapter } = require('./MockDeploymentAdapter');
const { LocalDockerAdapter } = require('./LocalDockerAdapter');
const { DeploymentHealthChecker } = require('./DeploymentHealthChecker');
const { DeploymentRollbackManager } = require('./DeploymentRollbackManager');
const { ApprovalTokenManager, defaultApprovalTokenManager, TOKEN_STATES } = require('./ApprovalTokenManager');
const { DeploymentAuditLogger } = require('./DeploymentAuditLogger');
const { DeploymentResult, DEPLOYMENT_STATUS, OPERATIONAL_LABELS } = require('./DeploymentResult');
const { DeploymentExecutor } = require('./DeploymentExecutor');

module.exports = {
  SecretRedactor,
  DeploymentPlan,
  DEPLOYMENT_PLAN_SCHEMA_VERSION,
  ALLOWED_TARGET_ENVS,
  ALLOWED_PROVIDERS,
  DeploymentValidator,
  DeploymentProvider,
  MockDeploymentAdapter,
  LocalDockerAdapter,
  DeploymentHealthChecker,
  DeploymentRollbackManager,
  ApprovalTokenManager,
  defaultApprovalTokenManager,
  TOKEN_STATES,
  DeploymentAuditLogger,
  DeploymentResult,
  DEPLOYMENT_STATUS,
  OPERATIONAL_LABELS,
  DeploymentExecutor
};
