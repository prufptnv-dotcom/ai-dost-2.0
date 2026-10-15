'use strict';

/**
 * TenantAuthorizationMiddleware.js - Express Middleware for Multi-Tenant Scoping & RBAC
 *
 * Provides middleware for resolving tenant context, enforcing membership,
 * and checking tenant-specific role permissions (member, admin, owner).
 */

const { TenantValidator } = require('./TenantValidator');

/**
 * Creates tenant authorization middleware factory
 * @param {import('./TenantContextResolver')} contextResolver
 * @param {object} [options]
 */
function createTenantMiddleware(contextResolver, options = {}) {
  if (!contextResolver) {
    throw new Error('createTenantMiddleware requires a TenantContextResolver instance');
  }

  /**
   * Middleware to resolve and attach tenant context to req.tenantContext
   * Requires req.user (from auth middleware)
   */
  const resolveTenantContext = async (req, res, next) => {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          ok: false,
          error: 'Authentication required for tenant-scoped operations',
          code: 'UNAUTHENTICATED'
        });
      }

      const result = await contextResolver.resolve(req, userId, options);
      if (!result.ok) {
        return res.status(result.status || 403).json({
          ok: false,
          error: result.error,
          code: result.code
        });
      }

      req.tenantContext = result.context;
      next();
    } catch (err) {
      next(err);
    }
  };

  /**
   * Middleware requiring at least active member role in the resolved tenant
   */
  const requireTenantMember = (req, res, next) => {
    if (!req.tenantContext) {
      return res.status(400).json({
        ok: false,
        error: 'Tenant context must be resolved prior to membership check',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    if (!TenantValidator.canPerform(req.tenantContext.role, 'member')) {
      return res.status(403).json({
        ok: false,
        error: 'Tenant member role required',
        code: 'INSUFFICIENT_TENANT_PERMISSIONS'
      });
    }
    next();
  };

  /**
   * Higher-order middleware requiring a specific minimum role in the resolved tenant
   * @param {'member' | 'admin' | 'owner'} minRole
   */
  const requireTenantRole = (minRole) => {
    return (req, res, next) => {
      if (!req.tenantContext) {
        return res.status(400).json({
          ok: false,
          error: 'Tenant context must be resolved prior to role verification',
          code: 'MISSING_TENANT_CONTEXT'
        });
      }

      const userRole = req.tenantContext.role;
      if (!TenantValidator.canPerform(userRole, minRole)) {
        return res.status(403).json({
          ok: false,
          error: `Action requires '${minRole}' role in tenant '${req.tenantContext.tenantSlug}'. Your role: '${userRole}'`,
          code: 'INSUFFICIENT_TENANT_PERMISSIONS',
          details: { requiredRole: minRole, userRole }
        });
      }
      next();
    };
  };

  const requireTenantAdmin = requireTenantRole('admin');
  const requireTenantOwner = requireTenantRole('owner');

  return {
    resolveTenantContext,
    requireTenantMember,
    requireTenantRole,
    requireTenantAdmin,
    requireTenantOwner
  };
}

module.exports = {
  createTenantMiddleware
};
