'use strict';

/**
 * AI-Dost 2.0 — Phase 4F: FactoryContext
 * 
 * Versioned, schema-validated, immutable context snapshot for the
 * Autonomous Software Factory pipeline.
 * 
 * Rejects unknown fields, enforces deep immutability, and redacts secrets.
 */

const crypto = require('crypto');

const FACTORY_CONTEXT_SCHEMA_VERSION = '1.0.0';

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'executionId',
  'timestamp',
  'workspaceRoot',
  'transactionId',
  'projectSpec',
  'stages',
  'verification',
  'manifest',
  'approval',
  'metadata'
]);

const ALLOWED_PROJECT_SPEC_KEYS = new Set([
  'name',
  'description',
  'frontendFramework',
  'backendFramework',
  'databaseType',
  'prompt'
]);

const ALLOWED_STAGE_NAMES = new Set([
  'fullStack',
  'database',
  'api',
  'auth',
  'tests',
  'ciCd'
]);

const ALLOWED_STAGE_STATUSES = new Set([
  'PENDING',
  'GENERATED',
  'SKIPPED',
  'FAILED'
]);

const ALLOWED_VERIFICATION_STATUSES = new Set([
  'PENDING',
  'VERIFIED',
  'SYNTHESIS_COMPLETE',
  'SKIPPED',
  'SKIPPED_MISSING_DEPS',
  'SKIPPED_CONFIG_DISABLED',
  'VERIFIED_CLEAN',
  'HEALED_VERIFIED',
  'PARTIAL_STATIC_ANALYSIS',
  'SKIPPED_MISSING_BROWSER',
  'UNRESOLVED_DEFECTS',
  'MOCK_VERIFIED',
  'DOCKER_VERIFIED',
  'SKIPPED_MISSING_DOCKER',
  'FAILED'
]);

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

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const copy = {};
  for (const [k, v] of Object.entries(obj)) {
    copy[k] = deepClone(v);
  }
  return copy;
}

class FactoryContext {
  /**
   * Constructs and validates a FactoryContext instance
   * @param {object} raw
   */
  constructor(raw = {}) {
    // 1. Unknown top-level key rejection
    for (const key of Object.keys(raw)) {
      if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
        const err = new Error(`Unknown top-level FactoryContext key: '${key}'`);
        err.code = 'INVALID_CONTEXT_PAYLOAD';
        throw err;
      }
    }

    this.schemaVersion = raw.schemaVersion || FACTORY_CONTEXT_SCHEMA_VERSION;
    if (this.schemaVersion !== FACTORY_CONTEXT_SCHEMA_VERSION) {
      const err = new Error(`Unsupported schemaVersion '${this.schemaVersion}'. Expected '${FACTORY_CONTEXT_SCHEMA_VERSION}'`);
      err.code = 'INVALID_CONTEXT_PAYLOAD';
      throw err;
    }

    this.executionId = raw.executionId || crypto.randomUUID();
    this.timestamp = raw.timestamp || new Date().toISOString();
    this.workspaceRoot = raw.workspaceRoot || process.cwd();
    this.transactionId = raw.transactionId || crypto.randomUUID();

    // 2. Project Spec validation
    this.projectSpec = this._validateProjectSpec(raw.projectSpec || {});

    // 3. Stages tracking
    this.stages = this._validateStages(raw.stages || {});

    // 4. Verification tracking
    this.verification = this._validateVerification(raw.verification || {});

    // 5. Manifest tracking
    this.manifest = this._validateManifest(raw.manifest || {});

    // 6. Approval metadata
    this.approval = raw.approval ? deepClone(raw.approval) : {
      required: false,
      status: 'NOT_REQUESTED',
      token: null,
      cumulativeRisk: 'LOW',
      stagesRequiringApproval: []
    };

    // 7. Sanitized arbitrary metadata (redacted)
    this.metadata = raw.metadata ? deepClone(raw.metadata) : {};

    // Validate no functions or non-serializable objects
    this._assertSerializable(this);
  }

  _validateProjectSpec(spec) {
    for (const key of Object.keys(spec)) {
      if (!ALLOWED_PROJECT_SPEC_KEYS.has(key)) {
        const err = new Error(`Unknown projectSpec key: '${key}'`);
        err.code = 'INVALID_CONTEXT_PAYLOAD';
        throw err;
      }
    }
    return {
      name: String(spec.name || 'app'),
      description: String(spec.description || 'Full-stack application'),
      frontendFramework: spec.frontendFramework || 'react-vite',
      backendFramework: spec.backendFramework || 'express',
      databaseType: spec.databaseType || 'sqlite',
      prompt: String(spec.prompt || '')
    };
  }

  _validateStages(stages) {
    const res = {};
    for (const stageName of ALLOWED_STAGE_NAMES) {
      const s = stages[stageName] || {};
      const status = s.status || 'PENDING';
      if (!ALLOWED_STAGE_STATUSES.has(status)) {
        const err = new Error(`Invalid status '${status}' for stage '${stageName}'`);
        err.code = 'INVALID_CONTEXT_PAYLOAD';
        throw err;
      }
      res[stageName] = {
        status,
        entrypoint: s.entrypoint || null,
        routes: Array.isArray(s.routes) ? deepClone(s.routes) : [],
        packageJson: s.packageJson ? deepClone(s.packageJson) : null,
        filesGenerated: Array.isArray(s.filesGenerated) ? [...s.filesGenerated] : [],
        metrics: s.metrics ? deepClone(s.metrics) : {}
      };
    }
    return res;
  }

  _validateVerification(v) {
    const res = {
      staticAnalysis: Boolean(v.staticAnalysis),
      databaseMigration: v.databaseMigration || 'PENDING',
      httpRoundtrip: v.httpRoundtrip || 'PENDING',
      clientRoundtrip: v.clientRoundtrip || 'PENDING',
      testsExecution: v.testsExecution || 'PENDING',
      frontendBuild: v.frontendBuild || 'PENDING',
      ciYamlSemantic: v.ciYamlSemantic || 'PENDING',
      auth: v.auth || 'PENDING',
      visualVerification: v.visualVerification || 'PENDING',
      deployment: v.deployment || 'PENDING'
    };

    for (const [key, val] of Object.entries(res)) {
      if (key === 'staticAnalysis') continue;
      if (!ALLOWED_VERIFICATION_STATUSES.has(val)) {
        const err = new Error(`Invalid verification status '${val}' for tier '${key}'`);
        err.code = 'INVALID_CONTEXT_PAYLOAD';
        throw err;
      }
    }
    return res;
  }

  _validateManifest(m) {
    return {
      filesGenerated: Array.isArray(m.filesGenerated) ? [...m.filesGenerated] : [],
      checksums: m.checksums && typeof m.checksums === 'object' ? deepClone(m.checksums) : {},
      zipPath: m.zipPath || null,
      zipSha256: m.zipSha256 || null,
      totalBytes: typeof m.totalBytes === 'number' ? m.totalBytes : 0
    };
  }

  _assertSerializable(val, pathStr = 'root') {
    if (val === null || typeof val === 'undefined') return;
    if (typeof val === 'function') {
      const err = new Error(`Executable functions are forbidden in FactoryContext at '${pathStr}'`);
      err.code = 'INVALID_CONTEXT_PAYLOAD';
      throw err;
    }
    if (typeof val === 'symbol') {
      const err = new Error(`Symbols are forbidden in FactoryContext at '${pathStr}'`);
      err.code = 'INVALID_CONTEXT_PAYLOAD';
      throw err;
    }
    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) {
        this._assertSerializable(v, `${pathStr}.${k}`);
      }
    }
  }

  /**
   * Creates a mutable clone for staging transitions
   */
  clone() {
    return new FactoryContext({
      schemaVersion: this.schemaVersion,
      executionId: this.executionId,
      timestamp: this.timestamp,
      workspaceRoot: this.workspaceRoot,
      transactionId: this.transactionId,
      projectSpec: deepClone(this.projectSpec),
      stages: deepClone(this.stages),
      verification: deepClone(this.verification),
      manifest: deepClone(this.manifest),
      approval: deepClone(this.approval),
      metadata: deepClone(this.metadata)
    });
  }

  /**
   * Produces a deep-frozen, immutable snapshot of current state
   */
  toImmutableSnapshot() {
    const clone = this.clone();
    return deepFreeze(clone);
  }
}

module.exports = {
  FactoryContext,
  FACTORY_CONTEXT_SCHEMA_VERSION,
  ALLOWED_STAGE_NAMES,
  ALLOWED_STAGE_STATUSES,
  ALLOWED_VERIFICATION_STATUSES,
  deepFreeze,
  deepClone
};
