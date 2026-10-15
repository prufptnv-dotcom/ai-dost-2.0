/**
 * DatabaseSchemaResult
 * Standardized result envelope for database schema generation and migration workflows.
 */

class DatabaseSchemaResult {
  static STATUS = {
    COMPLETED: 'COMPLETED',
    APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
    BLOCKED_BY_POLICY: 'BLOCKED_BY_POLICY',
    FAILED_ROLLED_BACK: 'FAILED_ROLLED_BACK',
    UNSUPPORTED: 'UNSUPPORTED'
  };

  /**
   * @param {Object} params
   * @param {string} params.status
   * @param {string} params.engine
   * @param {Array<string>} [params.tables]
   * @param {Array<Object>} [params.migrations]
   * @param {boolean} [params.applied]
   * @param {Array<Object>} [params.drift]
   * @param {Array<string|Object>} [params.artifacts]
   * @param {Object} [params.security]
   * @param {Object|null} [params.error]
   * @param {Object} [params.metadata]
   */
  constructor({
    status = DatabaseSchemaResult.STATUS.COMPLETED,
    engine = 'sqlite',
    tables = [],
    migrations = [],
    applied = false,
    drift = [],
    artifacts = [],
    security = {},
    error = null,
    metadata = {}
  }) {
    if (!Object.values(DatabaseSchemaResult.STATUS).includes(status)) {
      throw new Error(`Invalid DatabaseSchemaResult status: ${status}`);
    }

    this.status = status;
    this.engine = engine;
    this.tables = Array.isArray(tables) ? tables : [];
    this.migrations = Array.isArray(migrations) ? migrations : [];
    this.applied = Boolean(applied);
    this.drift = Array.isArray(drift) ? drift : [];
    this.artifacts = Array.isArray(artifacts) ? artifacts : [];
    this.security = {
      destructiveDetected: Boolean(security.destructiveDetected),
      approvalRequired: Boolean(security.approvalRequired),
      sanitizedInput: security.sanitizedInput ?? true,
      redactedSecrets: security.redactedSecrets ?? true,
      warnings: Array.isArray(security.warnings) ? security.warnings : []
    };
    this.error = error ? {
      code: error.code || 'DATABASE_SCHEMA_ERROR',
      message: error.message || 'Unknown database schema error',
      details: error.details || {},
      retryable: Boolean(error.retryable)
    } : null;
    this.metadata = {
      timestamp: metadata.timestamp || new Date().toISOString(),
      executionTimeMs: metadata.executionTimeMs || 0,
      ...metadata
    };
  }

  static success(data = {}) {
    return new DatabaseSchemaResult({
      status: DatabaseSchemaResult.STATUS.COMPLETED,
      ...data
    });
  }

  static approvalRequired(reason, data = {}) {
    return new DatabaseSchemaResult({
      status: DatabaseSchemaResult.STATUS.APPROVAL_REQUIRED,
      security: {
        destructiveDetected: true,
        approvalRequired: true,
        warnings: [reason]
      },
      ...data
    });
  }

  static blockedByPolicy(code, message, details = {}) {
    return new DatabaseSchemaResult({
      status: DatabaseSchemaResult.STATUS.BLOCKED_BY_POLICY,
      error: { code, message, details, retryable: false }
    });
  }

  static failedRolledBack(code, message, details = {}) {
    return new DatabaseSchemaResult({
      status: DatabaseSchemaResult.STATUS.FAILED_ROLLED_BACK,
      error: { code, message, details, retryable: true }
    });
  }

  static unsupportedEngine(engine) {
    return new DatabaseSchemaResult({
      status: DatabaseSchemaResult.STATUS.UNSUPPORTED,
      engine,
      error: {
        code: 'UNSUPPORTED_DATABASE_ENGINE',
        message: `Database engine "${engine}" is not supported. Supported engines are: sqlite, postgresql, mysql, none`,
        details: { engine, supported: ['sqlite', 'postgresql', 'mysql', 'none'] },
        retryable: false
      }
    });
  }

  toJSON() {
    return {
      status: this.status,
      engine: this.engine,
      tables: this.tables,
      migrations: this.migrations,
      applied: this.applied,
      drift: this.drift,
      artifacts: this.artifacts,
      security: this.security,
      error: this.error,
      metadata: this.metadata
    };
  }
}

module.exports = {
  DatabaseSchemaResult
};
