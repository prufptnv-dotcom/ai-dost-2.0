'use strict';

/**
 * AI-Dost 2.0 — Phase 4E: CI/CD Plan Model
 * Schema v1.0.0
 * 
 * Normalizes user and orchestrator inputs into an immutable, validated plan.
 * Strictly enforces GitHub Actions as sole platform in Phase 4E.
 * Enforces structured least-privilege permissions: { contents: "read" }.
 */

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

const SUPPORTED_CI_PLATFORMS = Object.freeze(['github_actions']);
const SUPPORTED_RUNTIMES = Object.freeze(['node']);
const ACTIVE_NODE_LTS_VERSIONS = Object.freeze(['18.x', '20.x', '22.x']);
const SUPPORTED_TEST_FRAMEWORKS = Object.freeze(['node:test', 'jest', 'playwright']);
const SUPPORTED_DATABASE_ENGINES = Object.freeze(['sqlite', 'postgresql', 'mysql']);
const SUPPORTED_INSTALL_POLICIES = Object.freeze(['ignore-scripts', 'standard']);

// Standard official action SHA pinning defaults (immutable commit SHAs)
const OFFICIAL_ACTION_SHAS = Object.freeze({
  'actions/checkout': 'b4ffde65f46336ab88eb53be808477a3936bae11', // v4.1.1
  'actions/setup-node': '60edb5dd545a775178f525247059d6428237b465', // v4.0.0
  'actions/upload-artifact': '5d5d22a31266ced268874388b861e4b58bb5c2f3', // v4.3.1
  'actions/download-artifact': 'c850b08b16a805eb263aa16507e43d45c22923b4', // v4.1.4
  'actions/cache': '0c45773b623bea8c8e75f6c82b208c3cf94ea4f9' // v4.0.2
});

class CiCdPlan {
  constructor(options = {}) {
    this.planId = options.planId || `plan_cicd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.projectId = String(options.projectId || 'project').trim();
    this.workspacePath = options.workspacePath ? String(options.workspacePath).trim() : '';
    
    // Platform: Strictly GitHub Actions
    this.platform = options.platform || 'github_actions';

    // Permissions: Structured least privilege ONLY
    this.permissions = this._normalizePermissions(options.permissions);

    // Triggers
    const rawTriggers = options.triggers || {};
    this.triggers = {
      push: Array.isArray(rawTriggers.push) ? rawTriggers.push.slice() : ['main', 'master'],
      pullRequest: Array.isArray(rawTriggers.pullRequest) ? rawTriggers.pullRequest.slice() : ['main', 'master'],
      workflowDispatch: rawTriggers.workflowDispatch !== false
    };

    // Runtime & Matrix
    this.runtime = options.runtime || 'node';
    this.nodeVersions = Array.isArray(options.nodeVersions) && options.nodeVersions.length > 0
      ? options.nodeVersions.map(String)
      : null; // null means dynamically resolve from package.json engines / framework

    // Workflow Stages enabled
    const rawStages = options.stages || {};
    this.stages = {
      lint: rawStages.lint !== false,
      test: rawStages.test !== false,
      contractDrift: rawStages.contractDrift === true,
      databaseMigration: rawStages.databaseMigration === true,
      build: rawStages.build !== false,
      deploymentTemplate: rawStages.deploymentTemplate === true
    };

    // npm lifecycle install policy (default: ignore-scripts)
    this.installScriptPolicy = options.installScriptPolicy || 'ignore-scripts';

    // Action pinning mode: 'sha' (default) or 'major_tag'
    this.actionPinningMode = options.actionPinningMode || 'sha';

    // Test Framework: 'node:test', 'jest', 'playwright', or auto-detect
    this.testFramework = options.testFramework || null;

    // Database metadata from Phase 4B if available
    this.databaseConfig = options.databaseConfig
      ? Object.assign({}, options.databaseConfig)
      : (options.databaseEngine ? { engine: options.databaseEngine } : null);
    this.databaseEngine = options.databaseEngine || (this.databaseConfig ? this.databaseConfig.engine : null);

    // Output directory for workflows
    this.workflowOutputDir = options.workflowOutputDir || '.github/workflows';

    // Freeze instance for strict immutability
    this.freeze();
  }

  _normalizePermissions(perms) {
    // If not specified, default to least privilege: contents: "read"
    if (!perms) {
      return { contents: 'read' };
    }

    // Must be an object and not an array or string
    if (typeof perms !== 'object' || Array.isArray(perms)) {
      return null; // Will trigger INVALID_PIPELINE_PERMISSIONS in validator
    }

    const clean = {};
    for (const [k, v] of Object.entries(perms)) {
      clean[String(k).toLowerCase()] = String(v).toLowerCase();
    }
    return clean;
  }

  freeze() {
    return deepFreeze(this);
  }

  clone(overrides = {}) {
    const json = JSON.parse(JSON.stringify(this));
    return new CiCdPlan(Object.assign({}, json, overrides, {
      planId: `plan_cicd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    }));
  }

  toJSON() {
    return {
      planId: this.planId,
      projectId: this.projectId,
      workspacePath: this.workspacePath,
      platform: this.platform,
      permissions: this.permissions,
      triggers: this.triggers,
      runtime: this.runtime,
      nodeVersions: this.nodeVersions,
      stages: this.stages,
      installScriptPolicy: this.installScriptPolicy,
      actionPinningMode: this.actionPinningMode,
      testFramework: this.testFramework,
      databaseConfig: this.databaseConfig,
      workflowOutputDir: this.workflowOutputDir
    };
  }
}

module.exports = {
  CiCdPlan,
  SUPPORTED_CI_PLATFORMS,
  SUPPORTED_RUNTIMES,
  ACTIVE_NODE_LTS_VERSIONS,
  SUPPORTED_TEST_FRAMEWORKS,
  SUPPORTED_DATABASE_ENGINES,
  SUPPORTED_INSTALL_POLICIES,
  OFFICIAL_ACTION_SHAS,
  deepFreeze
};
