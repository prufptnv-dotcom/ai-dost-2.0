'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: OwnershipValidator
 * 
 * Resource ownership & tenant isolation validator preventing IDOR / BOLA attacks.
 */

class OwnershipValidator {
  /**
   * Validate that the requesting user owns the resource or has administrative override
   * @param {Object} resource
   * @param {Object} user
   * @param {string} [ownerField='userId']
   * @returns {{ allowed: boolean, notFound?: boolean, error?: string, status?: number }}
   */
  static validateOwnership(resource, user, ownerField = 'userId') {
    if (!user || typeof user !== 'object') {
      return { allowed: false, error: 'Authentication required', status: 401 };
    }

    if (!resource || typeof resource !== 'object') {
      // Return 404 to avoid leaking resource existence
      return { allowed: false, notFound: true, error: 'Resource not found', status: 404 };
    }

    // Admin has administrative override
    if (user.role === 'admin') {
      return { allowed: true };
    }

    const resourceOwnerId = resource[ownerField] || resource.ownerId || resource.user_id;
    if (!resourceOwnerId || String(resourceOwnerId) !== String(user.id)) {
      return {
        allowed: false,
        error: 'Access denied: Resource ownership mismatch',
        status: 403,
        statusCode: 403
      };
    }

    return { allowed: true, isAdminOverride: user.role === 'admin' };
  }

  static checkOwnership(resource, user, options = {}) {
    const ownerField = typeof options === 'string' ? options : (options.ownerField || 'userId');
    const res = this.validateOwnership(resource, user, ownerField);
    return {
      ...res,
      statusCode: res.status || 200,
      isAdminOverride: user && user.role === 'admin'
    };
  }
}

module.exports = {
  OwnershipValidator
};
