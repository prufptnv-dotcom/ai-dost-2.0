'use strict';

const crypto = require('crypto');

const API_PLAN_VERSION = '1.0.0';
const CAPABILITY_ID = 'coding.api_integration';

const SUPPORTED_CLIENT_STYLES = Object.freeze([
  'fetch',
  'axios'
]);

const SUPPORTED_SCHEMA_FORMATS = Object.freeze([
  'openapi-3.0.3',
  'json'
]);

const SUPPORTED_VALIDATOR_MODES = Object.freeze([
  'runtime-js',
  'zod'
]);

const SUPPORTED_LANGUAGES = Object.freeze([
  'javascript',
  'typescript'
]);

/**
 * Deeply freezes an object to guarantee immutability
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

/**
 * Masks secrets and tokens in URLs, headers, and credentials
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
 * Creates a normalized, validated ApiIntegrationPlan
 */
function createApiIntegrationPlan(spec = {}) {
  const planId = spec.planId || `api_plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const requestId = spec.requestId || `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const projectId = spec.projectId || spec.projectName || 'default_project';
  const workspacePath = spec.workspacePath || null;

  const rawClientStyle = String(spec.clientStyle || 'fetch').toLowerCase().trim();
  const clientStyle = rawClientStyle;

  const rawSchemaFormat = String(spec.schemaFormat || 'openapi-3.0.3').toLowerCase().trim();
  const schemaFormat = rawSchemaFormat;

  const rawValidatorMode = String(spec.validatorMode || 'runtime-js').toLowerCase().trim();
  const validatorMode = rawValidatorMode;

  const rawLanguage = String(spec.language || 'javascript').toLowerCase().trim();
  const language = rawLanguage;

  const routeFiles = Array.isArray(spec.routeFiles) ? spec.routeFiles.map(String) : [];
  const routeDescriptors = Array.isArray(spec.routeDescriptors) ? spec.routeDescriptors : [];
  const schemaMetadata = spec.schemaMetadata || null; // Phase 4B database metadata
  const previousSpec = spec.previousSpec || null; // For drift detection

  const clientOutputDir = spec.clientOutputDir || 'frontend/services/api';
  const openapiOutputDir = spec.openapiOutputDir || 'backend/docs';
  const clientFileName = spec.clientFileName || 'apiClient.js';
  const openapiFileName = spec.openapiFileName || 'openapi.json';

  const baseUrl = spec.baseUrl || '/api';
  const timeoutMs = typeof spec.timeoutMs === 'number' ? Math.max(100, Math.min(spec.timeoutMs, 60000)) : 15000;
  const maxRetries = typeof spec.maxRetries === 'number' ? Math.max(0, Math.min(spec.maxRetries, 5)) : 3;

  const generateMock = spec.generateMock !== false;
  const detectDrift = spec.detectDrift !== false;

  // Mask sensitive header fields or URL credentials
  const defaultHeaders = {};
  if (spec.defaultHeaders && typeof spec.defaultHeaders === 'object') {
    for (const [k, v] of Object.entries(spec.defaultHeaders)) {
      defaultHeaders[k] = maskSecret(v, k);
    }
  }

  const plan = {
    version: API_PLAN_VERSION,
    capability_id: CAPABILITY_ID,
    planId,
    requestId,
    projectId,
    workspacePath,
    clientStyle,
    schemaFormat,
    validatorMode,
    language,
    routeFiles,
    routeDescriptors,
    schemaMetadata,
    previousSpec,
    clientOutputDir,
    openapiOutputDir,
    clientFileName,
    openapiFileName,
    baseUrl: maskSecret(baseUrl),
    timeoutMs,
    maxRetries,
    generateMock,
    detectDrift,
    defaultHeaders,
    createdAt: new Date().toISOString()
  };

  return plan;
}

class ApiIntegrationPlan {
  constructor(spec = {}) {
    this._data = createApiIntegrationPlan(spec);
    this._frozen = false;
  }

  get version() { return this._data.version; }
  get capability_id() { return this._data.capability_id; }
  get planId() { return this._data.planId; }
  get requestId() { return this._data.requestId; }
  get projectId() { return this._data.projectId; }
  get workspacePath() { return this._data.workspacePath; }
  get clientStyle() { return this._data.clientStyle; }
  get schemaFormat() { return this._data.schemaFormat; }
  get validatorMode() { return this._data.validatorMode; }
  get language() { return this._data.language; }
  get routeFiles() { return this._data.routeFiles; }
  get routeDescriptors() { return this._data.routeDescriptors; }
  get schemaMetadata() { return this._data.schemaMetadata; }
  get previousSpec() { return this._data.previousSpec; }
  get clientOutputDir() { return this._data.clientOutputDir; }
  get openapiOutputDir() { return this._data.openapiOutputDir; }
  get clientFileName() { return this._data.clientFileName; }
  get openapiFileName() { return this._data.openapiFileName; }
  get baseUrl() { return this._data.baseUrl; }
  get timeoutMs() { return this._data.timeoutMs; }
  get maxRetries() { return this._data.maxRetries; }
  get generateMock() { return this._data.generateMock; }
  get detectDrift() { return this._data.detectDrift; }
  get defaultHeaders() { return this._data.defaultHeaders; }
  get createdAt() { return this._data.createdAt; }

  freeze() {
    if (!this._frozen) {
      deepFreeze(this._data);
      this._frozen = true;
    }
    return this;
  }

  clone(overrides = {}) {
    const raw = JSON.parse(JSON.stringify(this._data));
    const merged = Object.assign({}, raw, overrides, {
      planId: `api_plan_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    });
    return new ApiIntegrationPlan(merged);
  }

  toJSON() {
    return JSON.parse(JSON.stringify(this._data));
  }
}

module.exports = {
  ApiIntegrationPlan,
  API_PLAN_VERSION,
  CAPABILITY_ID,
  SUPPORTED_CLIENT_STYLES,
  SUPPORTED_SCHEMA_FORMATS,
  SUPPORTED_VALIDATOR_MODES,
  SUPPORTED_LANGUAGES,
  deepFreeze,
  maskSecret
};
