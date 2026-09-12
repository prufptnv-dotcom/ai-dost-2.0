'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: DeploymentAuditLogger
 * 
 * Structured audit log emitter for deployment state transitions,
 * approval events, and failure diagnostics. Redacts sensitive credentials.
 */

const crypto = require('crypto');
const { SecretRedactor } = require('./SecretRedactor');

class DeploymentAuditLogger {
  constructor(options = {}) {
    this._logs = [];
    this._onLog = options.onLog || null;
  }

  /**
   * Log an audit event
   * @param {string} eventType - e.g. STATE_TRANSITION, APPROVAL_VERIFIED, ROLLBACK_INITIATED
   * @param {object} data - Payload
   * @returns {object} Emitted record
   */
  log(eventType, data = {}) {
    const auditId = `audit-${crypto.randomUUID()}`;
    const timestamp = Date.now();

    const record = {
      auditId,
      timestamp,
      eventType,
      projectId: data.projectId || 'unknown',
      targetEnv: data.targetEnv || 'unknown',
      fromState: data.fromState || null,
      toState: data.toState || null,
      details: SecretRedactor.redactObject(data.details || {})
    };

    // If token is present, only log SHA-256 hash of token, never raw secret
    if (data.tokenSecret) {
      record.tokenHash = crypto.createHash('sha256').update(data.tokenSecret).digest('hex');
    }

    this._logs.push(record);

    if (typeof this._onLog === 'function') {
      try {
        this._onLog(record);
      } catch {
        // Ignored
      }
    }

    return record;
  }

  getLogs() {
    return [...this._logs];
  }

  clear() {
    this._logs = [];
  }
}

module.exports = {
  DeploymentAuditLogger
};
