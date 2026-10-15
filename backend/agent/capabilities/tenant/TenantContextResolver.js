'use strict';

/**
 * TenantContextResolver.js - Authoritative Server-Side Tenant Context Resolution
 *
 * Resolves tenant identifier from headers (x-tenant-id / x-tenant-slug) or route params,
 * and validates user membership against the persistent tenant store.
 *
 * Security Invariant:
 * The client header or route parameter is NEVER treated as authorization authority.
 * Active membership and role are rigorously verified against the database.
 */

const { TenantValidator } = require('./TenantValidator');
const TenantResult = require('./TenantResult');

class TenantContextResolver {
  /**
   * @param {import('./TenantStore')} tenantStore
   * @param {object} [options]
   * @param {boolean} [options.allowDefault=false]
   */
  constructor(tenantStore, options = {}) {
    if (!tenantStore) {
      throw new Error('TenantContextResolver requires a valid tenantStore instance');
    }
    this.tenantStore = tenantStore;
    this.allowDefault = options.allowDefault ?? false;
  }

  /**
   * Resolves tenant context for a given authenticated user request.
   *
   * @param {object} req - Express request or mock request
   * @param {string} userId - Authenticated user ID (from JWT/session)
   * @param {object} [overrideOptions]
   * @returns {Promise<{ ok: boolean, status?: number, context?: object, error?: string, code?: string }>}
   */
  async resolve(req, userId, overrideOptions = {}) {
    if (!userId) {
      return {
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        error: 'Authentication required for tenant context resolution'
      };
    }

    const allowDefault = overrideOptions.allowDefault ?? this.allowDefault;

    // 1. Extract tenant identifier candidate from headers, params, or query
    const rawTenantId = req.headers?.['x-tenant-id'] ||
      req.params?.tenantId ||
      req.query?.tenantId ||
      null;

    const rawTenantSlug = req.headers?.['x-tenant-slug'] ||
      req.params?.tenantSlug ||
      req.query?.tenantSlug ||
      null;

    let targetTenant = null;

    if (rawTenantId) {
      targetTenant = await this.tenantStore.findTenantById(String(rawTenantId).trim());
      if (!targetTenant) {
        return {
          ok: false,
          status: 404,
          code: 'TENANT_NOT_FOUND',
          error: 'Specified tenant does not exist'
        };
      }
    } else if (rawTenantSlug) {
      const slugValidation = TenantValidator.validateSlug(String(rawTenantSlug).trim());
      if (!slugValidation.valid) {
        return {
          ok: false,
          status: 400,
          code: 'INVALID_TENANT_SLUG',
          error: slugValidation.error
        };
      }
      targetTenant = await this.tenantStore.findTenantBySlug(slugValidation.slug);
      if (!targetTenant) {
        return {
          ok: false,
          status: 404,
          code: 'TENANT_NOT_FOUND',
          error: 'Specified tenant does not exist'
        };
      }
    } else if (allowDefault) {
      // Fallback to user's first active tenant membership
      const memberships = await this.tenantStore.getUserMemberships(userId);
      const activeMembership = memberships.find((m) => m.status === 'active' && m.tenantStatus === 'active');
      if (!activeMembership) {
        return {
          ok: false,
          status: 403,
          code: 'NO_ACTIVE_TENANT_MEMBERSHIP',
          error: 'User has no active tenant memberships'
        };
      }
      targetTenant = await this.tenantStore.findTenantById(activeMembership.tenantId);
    } else {
      return {
        ok: false,
        status: 400,
        code: 'MISSING_TENANT_IDENTIFIER',
        error: 'Tenant context header (x-tenant-id / x-tenant-slug) or parameter is required'
      };
    }

    // 2. Enforce Tenant Status lifecycle
    if (targetTenant.status === 'suspended') {
      return {
        ok: false,
        status: 403,
        code: 'TENANT_SUSPENDED',
        error: 'Tenant account is currently suspended'
      };
    }

    if (targetTenant.status === 'archived') {
      return {
        ok: false,
        status: 404,
        code: 'TENANT_ARCHIVED',
        error: 'Tenant has been archived'
      };
    }

    // 3. Verify user's membership in this tenant
    const membership = await this.tenantStore.getMembership(targetTenant.id, userId);
    if (!membership) {
      return {
        ok: false,
        status: 404, // Use 404 to avoid tenant membership probing / IDOR enumeration
        code: 'TENANT_MEMBERSHIP_NOT_FOUND',
        error: 'Tenant not found or access denied'
      };
    }

    if (membership.status !== 'active') {
      return {
        ok: false,
        status: 403,
        code: 'MEMBERSHIP_INACTIVE',
        error: `Tenant membership status is ${membership.status}`
      };
    }

    // 4. Build authoritative context object
    const context = Object.freeze({
      tenantId: targetTenant.id,
      tenantSlug: targetTenant.slug,
      tenantName: targetTenant.name,
      role: membership.role,
      status: targetTenant.status,
      membershipStatus: membership.status,
      userId,
      maxProjects: targetTenant.maxProjects || 20,
      maxStorageBytes: targetTenant.maxStorageBytes || 524288000,
      maxConcurrentSandboxes: targetTenant.maxConcurrentSandboxes || 2,
      resolvedAt: new Date().toISOString()
    });

    return {
      ok: true,
      context
    };
  }
}

module.exports = TenantContextResolver;
