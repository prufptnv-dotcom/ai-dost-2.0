'use strict';

const crypto = require('crypto');

const PLAN_VERSION = '1.0.0';
const CAPABILITY_ID = 'coding.full_stack_delivery';

const STAGE_IDS = Object.freeze([
  'PLAN_CREATED',
  'PLAN_VALIDATED',
  'APPROVAL_CHECKED',
  'WORKSPACE_INITIALIZED',
  'SCAFFOLD_GENERATED',
  'FRONTEND_GENERATED',
  'BACKEND_GENERATED',
  'DATABASE_PREPARED',
  'ENVIRONMENT_PREPARED',
  'DEPENDENCIES_INSTALLED',
  'STATIC_CHECKS_PASSED',
  'TESTS_EXECUTED',
  'BUILD_COMPLETED',
  'PREVIEW_STARTED',
  'VISUAL_VERIFICATION_COMPLETED',
  'FINAL_VALIDATION_COMPLETED',
  'DELIVERY_COMPLETED'
]);

const STAGE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED'
});

function sanitizeProjectName(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'ai-dost-app';
  const cleaned = rawName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return cleaned || 'ai-dost-app';
}

function sanitizeString(val, fallback = '') {
  if (typeof val !== 'string') return fallback;
  return val.trim();
}

/**
 * Creates a normalized, validated, serializable FullStackDeliveryPlan data object.
 */
function createFullStackDeliveryPlan(spec = {}) {
  const planId = spec.planId || `fsd_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const requestId = spec.requestId || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const projectName = sanitizeProjectName(spec.projectName || spec.name);
  const workspaceId = spec.workspaceId || `ws_${projectName}`;

  // Framework resolution with safe defaults
  const frontendFw = sanitizeString(spec.frontend?.framework || spec.framework?.frontend || spec.framework || 'react-vite').toLowerCase();
  const backendFw = sanitizeString(spec.backend?.framework || spec.framework?.backend || 'express').toLowerCase();
  const language = sanitizeString(spec.language || 'javascript').toLowerCase();
  const packageManager = sanitizeString(spec.packageManager || 'npm').toLowerCase();

  // Database engine
  const dbEngine = sanitizeString(spec.database?.engine || spec.database || 'sqlite').toLowerCase();

  // Environment variables
  const rawEnvVars = Array.isArray(spec.environmentVariables) ? spec.environmentVariables : [];
  const environmentVariables = rawEnvVars.map(v => {
    const key = String(v.key || v.name || '').trim();
    const isSecret = Boolean(v.isSecret || /key|secret|token|password|auth/i.test(key));
    return {
      key,
      value: String(v.value || ''),
      isSecret,
      required: Boolean(v.required)
    };
  });

  const stages = STAGE_IDS.map(id => ({
    id,
    status: STAGE_STATUS.PENDING,
    startedAt: null,
    completedAt: null,
    error: null
  }));

  const plan = {
    version: spec.version || 1,
    planVersion: PLAN_VERSION,
    capabilityId: CAPABILITY_ID,
    planId,
    requestId,
    projectName,
    workspaceId,
    prompt: sanitizeString(spec.prompt, '1-Click Full-Stack Application'),
    framework: {
      frontend: frontendFw,
      backend: backendFw,
      language,
      packageManager
    },
    frontend: {
      framework: frontendFw,
      components: Array.isArray(spec.frontend?.components) ? spec.frontend.components : ['App', 'Navbar', 'Dashboard', 'Footer'],
      stateManagement: spec.frontend?.stateManagement || 'context',
      styling: spec.frontend?.styling || 'css-modules'
    },
    backend: {
      framework: backendFw,
      routes: Array.isArray(spec.backend?.routes) ? spec.backend.routes : ['/api/health', '/api/items'],
      controllers: Array.isArray(spec.backend?.controllers) ? spec.backend.controllers : ['healthController', 'itemsController'],
      middleware: Array.isArray(spec.backend?.middleware) ? spec.backend.middleware : ['cors', 'json']
    },
    database: {
      engine: dbEngine,
      schemaFile: dbEngine === 'sqlite' ? 'server/db/schema.sql' : 'prisma/schema.prisma',
      models: Array.isArray(spec.database?.models) ? spec.database.models : []
    },
    authentication: {
      type: sanitizeString(spec.authentication?.type || 'none').toLowerCase(),
      provider: spec.authentication?.provider || null
    },
    integrations: Array.isArray(spec.integrations) ? spec.integrations : [],
    environmentVariables,
    routes: Array.isArray(spec.routes) ? spec.routes : ['/api/health'],
    pages: Array.isArray(spec.pages) ? spec.pages : ['Home'],
    components: Array.isArray(spec.components) ? spec.components : [],
    dataModels: Array.isArray(spec.dataModels) ? spec.dataModels : [],
    apiContracts: Array.isArray(spec.apiContracts) ? spec.apiContracts : [{ path: '/api/health', method: 'GET' }],
    testPlan: {
      runner: 'node:test',
      testFiles: Array.isArray(spec.testPlan?.testFiles) ? spec.testPlan.testFiles : ['tests/app.test.js'],
      coverageThreshold: spec.testPlan?.coverageThreshold || 0
    },
    verificationPlan: {
      buildRequired: true,
      previewRequired: true,
      visualRequired: true
    },
    exportPlan: {
      zipExport: true
    },
    gitPlan: {
      autoCommit: true,
      commitMessage: `feat: scaffold ${projectName} application`
    },
    riskLevel: 'MEDIUM',
    requiredApprovals: ['terminal:execute', 'workspace:write'],
    dependencies: ['coding.production_code', 'devops.terminal'],
    stages,
    createdAt: new Date().toISOString(),
    getSanitizedView: function() {
      return {
        ...this,
        environmentVariables: this.environmentVariables.map(env => ({
          ...env,
          value: env.isSecret ? '***MASKED***' : env.value
        }))
      };
    }
  };

  return plan;
}

class FullStackDeliveryPlan {
  constructor(spec = {}) {
    const raw = createFullStackDeliveryPlan(spec);
    Object.assign(this, raw);
    this.version = spec.version || 1;
    this.stages = raw.stages.map(s => ({ ...s }));
    this.environmentVariables = raw.environmentVariables.map(e => ({ ...e }));
  }

  updateStage(stageId, status, details = {}) {
    const stage = this.stages.find(s => s.id === stageId);
    if (stage) {
      stage.status = status;
      stage.updatedAt = new Date().toISOString();
      Object.assign(stage, details);
      this.version += 1;
    }
  }

  getStage(stageId) {
    return this.stages.find(s => s.id === stageId);
  }

  getSanitizedView() {
    return {
      ...this,
      environmentVariables: this.environmentVariables.map(env => ({
        ...env,
        value: env.isSecret ? '***MASKED***' : env.value
      }))
    };
  }
}

module.exports = {
  PLAN_VERSION,
  CAPABILITY_ID,
  STAGE_IDS,
  STAGE_STATUS,
  DELIVERY_STAGES: STAGE_IDS,
  FullStackDeliveryPlan,
  createFullStackDeliveryPlan,
  sanitizeProjectName
};
