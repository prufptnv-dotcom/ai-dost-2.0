'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: AuthAvailabilityPolicy
 * 
 * Defines strict availability and outage policies when distributed infrastructure
 * (Redis, PostgreSQL, network partitions) fails.
 * 
 * INVARIANT: Never silently disable security controls.
 */

const POLICY_MODES = {
  FAIL_CLOSED: 'FAIL_CLOSED',
  FAIL_SECURE_DEGRADED: 'FAIL_SECURE_DEGRADED'
};

class AuthAvailabilityPolicy {
  /**
   * @param {Object} [options]
   * @param {'FAIL_CLOSED'|'FAIL_SECURE_DEGRADED'} [options.defaultPolicy]
   * @param {Object.<string, 'FAIL_CLOSED'|'FAIL_SECURE_DEGRADED'>} [options.endpointOverrides]
   */
  constructor(options = {}) {
    this.defaultPolicy = options.defaultPolicy || POLICY_MODES.FAIL_SECURE_DEGRADED;
    this.endpointOverrides = {
      // Critical security endpoints must always FAIL_CLOSED by default
      '/api/auth/login': POLICY_MODES.FAIL_CLOSED,
      '/api/auth/register': POLICY_MODES.FAIL_CLOSED,
      '/api/auth/password-reset': POLICY_MODES.FAIL_CLOSED,
      '/api/auth/admin-bootstrap': POLICY_MODES.FAIL_CLOSED,
      ...(options.endpointOverrides || {})
    };
    this._outageCounts = new Map();
  }

  /**
   * Determine the policy for a given route/bucket.
   * @param {string} endpointOrBucket 
   * @returns {'FAIL_CLOSED'|'FAIL_SECURE_DEGRADED'}
   */
  getPolicyFor(endpointOrBucket) {
    if (!endpointOrBucket) return this.defaultPolicy;
    return this.endpointOverrides[endpointOrBucket] || this.defaultPolicy;
  }

  /**
   * Handle an outage occurrence according to policy.
   * @param {string} serviceName 'redis' | 'postgres'
   * @param {string} endpointOrBucket 
   * @param {Error} error 
   * @returns {{ action: 'BLOCK'|'DEGRADE', status: number, error: string, reason: string }}
   */
  handleOutage(serviceName, endpointOrBucket, error) {
    const policy = this.getPolicyFor(endpointOrBucket);
    const count = (this._outageCounts.get(serviceName) || 0) + 1;
    this._outageCounts.set(serviceName, count);

    const errorMessage = error && error.message ? error.message : 'Service unavailable';

    if (policy === POLICY_MODES.FAIL_CLOSED) {
      return {
        action: 'BLOCK',
        status: 503,
        error: 'SERVICE_UNAVAILABLE',
        reason: `Critical security service (${serviceName}) is offline. Fail-closed policy active for ${endpointOrBucket}`,
        service: serviceName,
        details: errorMessage
      };
    }

    // FAIL_SECURE_DEGRADED: Fallback to local in-memory gate with audit warning
    return {
      action: 'DEGRADE',
      status: 200,
      error: null,
      reason: `Distributed service (${serviceName}) offline. Degraded to local in-memory security gate`,
      service: serviceName,
      details: errorMessage
    };
  }

  resetOutageCounts() {
    this._outageCounts.clear();
  }
}

module.exports = {
  AuthAvailabilityPolicy,
  POLICY_MODES
};
