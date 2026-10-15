'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: TenantResult
 * 
 * Standardized outcome envelope for multi-tenant operations,
 * membership changes, role updates, and cross-tenant access checks.
 */

class TenantResult {
  constructor(ok, data = {}) {
    this.ok = !!ok;
    this.code = data.code || (this.ok ? 'SUCCESS' : 'ERROR');
    this.error = data.error || null;
    this.tenant = data.tenant || null;
    this.membership = data.membership || null;
    this.memberships = data.memberships || null;
    this.members = data.members || null;
    this.tenants = data.tenants || null;
    this.context = data.context || null;
    this.resource = data.resource || null;
    this.quota = data.quota || (data.allowed !== undefined ? data : null);
    this.details = data.details || null;
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  static success(data = {}, code = 'SUCCESS') {
    return new TenantResult(true, { ...data, code });
  }

  static failure(error, code = 'TENANT_ERROR', details = null) {
    return new TenantResult(false, {
      error: typeof error === 'string' ? error : (error?.message || 'Tenant error'),
      code,
      details
    });
  }

  static fail(error, code = 'TENANT_ERROR', details = null) {
    return TenantResult.failure(error, code, details);
  }

  static notFound(message = 'Tenant or resource not found') {
    return new TenantResult(false, {
      error: message,
      code: 'NOT_FOUND'
    });
  }

  static accessDenied(message = 'Access denied: user is not a member of this tenant', code = 'TENANT_ACCESS_DENIED') {
    return new TenantResult(false, {
      error: message,
      code
    });
  }

  static lastOwnerViolation(message = 'Cannot demote or remove the last remaining active owner of a tenant') {
    return new TenantResult(false, {
      error: message,
      code: 'LAST_OWNER_PROTECTION'
    });
  }

  static quotaExceeded(message = 'Tenant quota exceeded', details = null) {
    return new TenantResult(false, {
      error: message,
      code: 'TENANT_QUOTA_EXCEEDED',
      details
    });
  }
}

module.exports = TenantResult;
