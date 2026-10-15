'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: AuthMiddleware
 * 
 * Production-hardened Express-compatible middleware suite implementing:
 * - JWT Bearer token authentication with token_version and account status checks
 * - Role-Based Access Control (RBAC) enforcement
 * - Resource ownership (IDOR) verification
 * - Double-Submit CSRF protection
 * - Rate limiting for authentication endpoints
 */

const { JwtEngine } = require('./JwtEngine');
const { RbacEngine } = require('./RbacEngine');
const { OwnershipValidator } = require('./OwnershipValidator');
const { CsrfManager } = require('./CsrfManager');

class AuthMiddleware {
  static createAuthenticate(options = {}) {
    return this.authenticateJwt(options);
  }

  /**
   * Middleware to authenticate incoming JWT Bearer token
   * @param {Object} options { secret, jwtSecret, userStore, issuer, audience }
   */
  static authenticateJwt(options = {}) {
    const secret = options.jwtSecret || options.secret;
    return async (req, res, next) => {
      const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
      if (!authHeader || typeof authHeader !== 'string') {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_HEADER_MISSING'
        });
      }

      const parts = authHeader.trim().split(' ');
      if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({
          error: 'Malformed Authorization header: must follow "Bearer <token>"',
          code: 'MALFORMED_AUTH_HEADER'
        });
      }

      const rawToken = parts[1];
      const result = JwtEngine.verifySafe(rawToken, secret, {
        issuer: options.issuer,
        audience: options.audience
      });

      if (!result.valid) {
        return res.status(401).json({
          error: result.error || 'Invalid or expired token',
          code: result.code || 'INVALID_TOKEN'
        });
      }

      req.user = result.payload;
      const payload = result.payload;

      // Verify user against store/db if userStore is provided
      if (options.userStore) {
        const user = await options.userStore.findById(payload.sub);
        if (!user) {
          return res.status(401).json({
            error: 'User account not found',
            code: 'USER_NOT_FOUND'
          });
        }

        // Suspended users must fail protected-route checks even if token signature is valid!
        if (user.status !== 'active') {
          return res.status(403).json({
            error: 'User account is suspended or pending activation',
            code: 'ACCOUNT_SUSPENDED'
          });
        }

        // Check token_version to ensure token hasn't been revoked by logout-all or password change
        if (typeof user.token_version === 'number' && typeof payload.tokenVersion === 'number') {
          if (payload.tokenVersion < user.token_version) {
            return res.status(401).json({
              error: 'Token has been invalidated by a credential update or logout-all event',
              code: 'TOKEN_REVOKED'
            });
          }
        }

        req.user = user;
      } else {
        req.user = {
          ...payload,
          id: payload.sub,
          sub: payload.sub,
          email: payload.email,
          role: payload.role || 'user',
          status: payload.status || 'active'
        };
      }

      next();
    };
  }

  /**
   * Middleware requiring a minimum role privilege level
   * @param {string} requiredRole
   */
  static requireRole(requiredRole) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!RbacEngine.hasRole(req.user.role, requiredRole)) {
        return res.status(403).json({
          error: `Access denied: requires '${requiredRole}' role or higher`,
          code: 'FORBIDDEN_INSUFFICIENT_ROLE'
        });
      }

      next();
    };
  }

  /**
   * Middleware validating resource ownership (IDOR prevention)
   * @param {Function} resourceFetcher async (req) => resource
   * @param {string} [ownerField='userId']
   */
  static requireOwnership(resourceFetcher, ownerField = 'userId') {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      let resource;
      try {
        resource = await resourceFetcher(req);
      } catch (err) {
        return res.status(500).json({ error: 'Failed to inspect resource ownership' });
      }

      const check = OwnershipValidator.validateOwnership(resource, req.user, ownerField);
      if (!check.allowed) {
        return res.status(check.status || 403).json({
          error: check.error,
          code: check.notFound ? 'RESOURCE_NOT_FOUND' : 'OWNERSHIP_MISMATCH'
        });
      }

      req.resource = resource;
      next();
    };
  }

  /**
   * Middleware enforcing Double-Submit CSRF protection on mutating routes
   * @param {Object} [options]
   */
  static verifyCsrf(options = {}) {
    return (req, res, next) => {
      const check = CsrfManager.validateRequest(req, options);
      if (!check.valid) {
        return res.status(403).json({
          error: check.error,
          code: check.code
        });
      }
      next();
    };
  }

  /**
   * Middleware applying dual-dimensional rate limiting
   * @param {Object} rateLimiter AuthRateLimiter instance
   */
  static rateLimitAuth(rateLimiter) {
    return (req, res, next) => {
      const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const ipCheck = rateLimiter.checkIpLimit(ip);
      if (!ipCheck.allowed) {
        res.setHeader('Retry-After', ipCheck.retryAfterSec || 60);
        return res.status(429).json({
          error: 'Too many requests from this IP address. Please try again later.',
          code: 'TOO_MANY_REQUESTS'
        });
      }

      const identifier = req.body?.email || req.body?.username;
      if (identifier) {
        const accCheck = rateLimiter.checkAccountDelay(identifier);
        if (!accCheck.allowed) {
          res.setHeader('Retry-After', accCheck.delaySec || 5);
          return res.status(429).json({
            error: 'Account temporarily delayed due to repeated failed attempts. Please wait.',
            code: 'ACCOUNT_DELAYED'
          });
        }
      }

      next();
    };
  }
}

module.exports = {
  AuthMiddleware
};
