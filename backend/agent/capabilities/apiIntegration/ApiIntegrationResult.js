'use strict';

const { deepFreeze } = require('./ApiIntegrationPlan');

class ApiIntegrationResult {
  constructor(payload = {}) {
    this.ok = Boolean(payload.ok);
    this.capability_id = 'coding.api_integration';
    this.planId = payload.planId || null;
    this.files = Array.isArray(payload.files) ? payload.files : [];
    this.openapiSpec = payload.openapiSpec || null;
    this.contractChecksum = payload.contractChecksum || null;
    this.driftReport = payload.driftReport || null;
    this.metrics = Object.assign({
      routesParsed: 0,
      methodsGenerated: 0,
      schemasCreated: 0,
      durationMs: 0
    }, payload.metrics);
    this.warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
    this.error = payload.error || null;
    this.timestamp = payload.timestamp || new Date().toISOString();

    deepFreeze(this);
  }

  static success(data = {}) {
    return new ApiIntegrationResult({
      ok: true,
      ...data,
      error: null
    });
  }

  static failure(error, data = {}) {
    const errorObj = typeof error === 'string'
      ? { code: 'API_INTEGRATION_ERROR', message: error, retryable: false }
      : {
          code: error.code || 'API_INTEGRATION_ERROR',
          message: error.message || String(error),
          retryable: Boolean(error.retryable)
        };

    return new ApiIntegrationResult({
      ok: false,
      ...data,
      error: errorObj
    });
  }

  toJSON() {
    return {
      ok: this.ok,
      capability_id: this.capability_id,
      planId: this.planId,
      files: this.files,
      openapiSpec: this.openapiSpec,
      contractChecksum: this.contractChecksum,
      driftReport: this.driftReport,
      metrics: this.metrics,
      warnings: this.warnings,
      error: this.error,
      timestamp: this.timestamp
    };
  }
}

module.exports = {
  ApiIntegrationResult
};
