'use strict';

const crypto = require('crypto');

const TEST_PLAN_VERSION = '1.0.0';
const CAPABILITY_ID = 'coding.test_case_generation';

const SUPPORTED_FRAMEWORKS = Object.freeze([
  'node:test',
  'jest',
  'playwright'
]);

const SUPPORTED_LANGUAGES = Object.freeze([
  'javascript',
  'typescript'
]);

const SUPPORTED_TEST_TYPES = Object.freeze([
  'unit',
  'integration',
  'e2e',
  'security',
  'database'
]);

/**
 * Normalizes and masks sensitive credentials in environment/connection values
 */
function maskSecret(val, key = '') {
  if (!val || typeof val !== 'string') return val;
  if (/key|secret|token|password|auth|credential/i.test(key) && val.length > 0) {
    return '***REDACTED***';
  }
  return val
    .replace(/:([^:@]+)@/, ':***REDACTED***@')
    .replace(/(?:key|secret|token|password)=[^&\s]+/gi, '$1=***REDACTED***');
}

/**
 * Creates a normalized, validated TestGenerationPlan spec
 */
function createTestGenerationPlan(spec = {}) {
  const planId = spec.planId || `test_plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const requestId = spec.requestId || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const projectId = spec.projectId || spec.projectName || 'default_project';
  const workspacePath = spec.workspacePath || null;

  const rawFramework = String(spec.framework || 'node:test').toLowerCase().trim();
  const framework = rawFramework;

  const rawLanguage = String(spec.language || 'javascript').toLowerCase().trim();
  const language = rawLanguage;

  const rawTestType = String(spec.testType || 'unit').toLowerCase().trim();
  const testType = rawTestType;

  const targetFiles = Array.isArray(spec.targetFiles) ? spec.targetFiles.map(String) : [];
  const outputDir = spec.outputDir || 'tests';

  const timeoutMs = typeof spec.timeoutMs === 'number' ? spec.timeoutMs : 10000;
  const retries = typeof spec.retries === 'number' ? spec.retries : 1;

  const coverageGoal = spec.coverageGoal ? {
    enabled: Boolean(spec.coverageGoal.enabled),
    threshold: typeof spec.coverageGoal.threshold === 'number' ? spec.coverageGoal.threshold : 80
  } : { enabled: false, threshold: 0 };

  const schemaMetadata = spec.schemaMetadata || spec.databaseSchema || null;

  const options = {
    includeHappyPath: spec.options?.includeHappyPath !== false,
    includeEdgeCases: spec.options?.includeEdgeCases !== false,
    includeErrorPaths: spec.options?.includeErrorPaths !== false,
    includeSecurityTests: Boolean(spec.options?.includeSecurityTests),
    includeDatabaseTests: Boolean(spec.options?.includeDatabaseTests || schemaMetadata),
    mockExternalCalls: spec.options?.mockExternalCalls !== false,
    dryRun: Boolean(spec.options?.dryRun),
    autoExecute: spec.options?.autoExecute !== false
  };

  if (spec.options && typeof spec.options === 'object') {
    for (const [k, v] of Object.entries(spec.options)) {
      if (typeof v === 'string') {
        options[k] = maskSecret(v, k);
      } else {
        options[k] = v;
      }
    }
  }

  const environment = {};
  if (spec.environment && typeof spec.environment === 'object') {
    for (const [k, v] of Object.entries(spec.environment)) {
      environment[k] = maskSecret(String(v), k);
    }
  }

  return {
    version: spec.version || TEST_PLAN_VERSION,
    planVersion: TEST_PLAN_VERSION,
    capabilityId: CAPABILITY_ID,
    planId,
    requestId,
    projectId,
    workspacePath,
    framework,
    language,
    testType,
    targetFiles,
    outputDir,
    timeoutMs,
    retries,
    coverageGoal,
    schemaMetadata,
    databaseTarget: spec.databaseTarget || spec.connectionUrl || null,
    connectionUrl: spec.connectionUrl || spec.databaseTarget || null,
    options,
    environment,
    createdAt: new Date().toISOString()
  };
}

class TestGenerationPlan {
  constructor(spec = {}) {
    const raw = createTestGenerationPlan(spec);
    Object.assign(this, raw);
  }

  toJSON() {
    return {
      version: this.version || TEST_PLAN_VERSION,
      planVersion: this.planVersion || TEST_PLAN_VERSION,
      capabilityId: this.capabilityId,
      planId: this.planId,
      requestId: this.requestId,
      projectId: this.projectId,
      workspacePath: this.workspacePath,
      framework: this.framework,
      language: this.language,
      testType: this.testType,
      targetFiles: this.targetFiles,
      outputDir: this.outputDir,
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      coverageGoal: this.coverageGoal,
      schemaMetadata: this.schemaMetadata,
      options: this.options,
      environment: this.environment,
      createdAt: this.createdAt
    };
  }

  freeze() {
    Object.freeze(this);
    if (this.targetFiles) Object.freeze(this.targetFiles);
    if (this.options) Object.freeze(this.options);
    if (this.environment) Object.freeze(this.environment);
    if (this.coverageGoal) Object.freeze(this.coverageGoal);
    if (this.schemaMetadata) {
      Object.freeze(this.schemaMetadata);
      if (Array.isArray(this.schemaMetadata.tables)) {
        Object.freeze(this.schemaMetadata.tables);
        this.schemaMetadata.tables.forEach(t => {
          Object.freeze(t);
          if (Array.isArray(t.columns)) Object.freeze(t.columns);
        });
      }
    }
    return this;
  }

  clone(overrides = {}) {
    const current = this.toJSON();
    return new TestGenerationPlan({
      ...current,
      planId: `test_plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
      ...overrides
    });
  }
}

TestGenerationPlan.TestGenerationPlan = TestGenerationPlan;
TestGenerationPlan.TEST_PLAN_VERSION = TEST_PLAN_VERSION;
TestGenerationPlan.CAPABILITY_ID = CAPABILITY_ID;
TestGenerationPlan.SUPPORTED_FRAMEWORKS = SUPPORTED_FRAMEWORKS;
TestGenerationPlan.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
TestGenerationPlan.SUPPORTED_TEST_TYPES = SUPPORTED_TEST_TYPES;
TestGenerationPlan.createTestGenerationPlan = createTestGenerationPlan;

module.exports = TestGenerationPlan;
module.exports.TestGenerationPlan = TestGenerationPlan;
module.exports.TEST_PLAN_VERSION = TEST_PLAN_VERSION;
module.exports.CAPABILITY_ID = CAPABILITY_ID;
module.exports.SUPPORTED_FRAMEWORKS = SUPPORTED_FRAMEWORKS;
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
module.exports.SUPPORTED_TEST_TYPES = SUPPORTED_TEST_TYPES;
module.exports.createTestGenerationPlan = createTestGenerationPlan;
