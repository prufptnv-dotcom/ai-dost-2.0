'use strict';

/**
 * TenantOwnershipValidator.js - IDOR / BOLA Prevention Validator
 *
 * Verifies that resources (projects, files, sandboxes, chat sessions, tasks, artifacts)
 * strictly match the verified tenant context ID.
 *
 * Anti-Enumeration Principle:
 * When a resource exists under a different tenant than the requesting tenant context,
 * this validator returns 404 (RESOURCE_NOT_FOUND) instead of 403, preventing attackers
 * from enumerating valid resource IDs across foreign tenants.
 */

class TenantOwnershipValidator {
  /**
   * @param {object} [options]
   * @param {import('./TenantAuditLogger')} [options.auditLogger]
   */
  constructor(options = {}) {
    this.auditLogger = options.auditLogger || null;
  }

  /**
   * Validates whether a resource's tenantId strictly matches expected tenantId
   *
   * @param {object|null|undefined} resource - Resource retrieved from DB or service
   * @param {string} expectedTenantId - Verified tenantId from req.tenantContext
   * @param {string} [resourceType='resource'] - Type name (e.g. 'project', 'file', 'sandbox')
   * @param {object} [actorContext] - { userId, ipAddress } for audit logging on IDOR attempts
   * @returns {Promise<{ ok: boolean, status?: number, code?: string, error?: string }>}
   */
  async validateOwnership(resource, expectedTenantId, resourceType = 'resource', actorContext = {}) {
    if (!expectedTenantId) {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_TENANT_ID',
        error: 'Expected tenant ID must be provided for ownership verification'
      };
    }

    if (!resource) {
      return {
        ok: false,
        status: 404,
        code: `${resourceType.toUpperCase()}_NOT_FOUND`,
        error: `${resourceType} not found`
      };
    }

    const resourceTenantId = resource.tenant_id || resource.tenantId;

    if (!resourceTenantId || resourceTenantId !== expectedTenantId) {
      // IDOR / Cross-tenant access attempt detected
      if (this.auditLogger && actorContext.userId) {
        try {
          await this.auditLogger.logEvent({
            tenantId: expectedTenantId,
            userId: actorContext.userId,
            action: 'security.idor_attempt_blocked',
            resourceType,
            resourceId: resource.id || resource.projectId || 'unknown',
            status: 'DENIED',
            metadata: {
              attemptedTenantId: expectedTenantId,
              actualTenantId: resourceTenantId || 'unscoped',
              ipAddress: actorContext.ipAddress || 'unknown'
            }
          });
        } catch (_) {}
      }

      // Return 404 NOT_FOUND to prevent enumeration
      return {
        ok: false,
        status: 404,
        code: `${resourceType.toUpperCase()}_NOT_FOUND`,
        error: `${resourceType} not found`
      };
    }

    return { ok: true };
  }

  /**
   * Synchronous check when audit logging is not needed
   */
  validateOwnershipSync(resource, expectedTenantId, resourceType = 'resource') {
    if (!expectedTenantId) {
      return { ok: false, status: 400, code: 'MISSING_TENANT_ID', error: 'Expected tenant ID required' };
    }
    if (!resource) {
      return { ok: false, status: 404, code: `${resourceType.toUpperCase()}_NOT_FOUND`, error: `${resourceType} not found` };
    }
    const resourceTenantId = resource.tenant_id || resource.tenantId;
    if (!resourceTenantId || resourceTenantId !== expectedTenantId) {
      return { ok: false, status: 404, code: `${resourceType.toUpperCase()}_NOT_FOUND`, error: `${resourceType} not found` };
    }
    return { ok: true };
  }

  /**
   * Generates a SQL WHERE fragment ensuring strict tenant isolation
   *
   * @param {string} tenantId - Tenant ID
   * @param {string} resourceId - Resource ID
   * @param {string} [tenantIdColumn='tenant_id'] - Name of the tenantId column
   * @param {string} [idColumn='id'] - Name of resource ID column
   * @returns {{ sql: string, params: Array<string> }}
   */
  static buildScopedWhere(tenantId, resourceId, tenantIdColumn = 'tenant_id', idColumn = 'id') {
    return {
      sql: `${tenantIdColumn} = ? AND ${idColumn} = ?`,
      params: [tenantId, resourceId]
    };
  }
}

module.exports = TenantOwnershipValidator;
