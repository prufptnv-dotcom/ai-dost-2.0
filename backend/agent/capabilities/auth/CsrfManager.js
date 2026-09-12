'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: CsrfManager
 * 
 * Cryptographic Double-Submit Cookie CSRF protection manager.
 * Requires both a matching CSRF cookie and header for state-changing HTTP requests.
 */

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

class CsrfManager {
  /**
   * Generate a new cryptographically secure CSRF token
   * @returns {string}
   */
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate double-submit CSRF token on mutating requests
   * Supports both (req, options) and (method, headerToken, cookieToken)
   * @param {Object|string} reqOrMethod
   * @param {Object|string} [headerOrOptions]
   * @param {string} [maybeCookie]
   * @returns {{ valid: boolean, error?: string, code?: string }|boolean}
   */
  static validateRequest(reqOrMethod, headerOrOptions = {}, maybeCookie = null) {
    let req;
    let options = {};
    const isDirectCall = typeof reqOrMethod === 'string';

    if (isDirectCall) {
      req = {
        method: reqOrMethod,
        headers: { 'x-csrf-token': headerOrOptions },
        cookies: { csrf_token: maybeCookie }
      };
    } else {
      req = reqOrMethod || {};
      options = headerOrOptions || {};
    }

    const method = (req.method || 'GET').toUpperCase();
    if (SAFE_METHODS.has(method)) {
      return isDirectCall ? true : { valid: true };
    }

    const headerName = (options.headerName || 'x-csrf-token').toLowerCase();
    const cookieName = options.cookieName || 'csrf_token';

    const cookieToken = req.cookies ? req.cookies[cookieName] : null;
    const headerToken = (req.headers && req.headers[headerName]) || (req.body && req.body._csrf);

    if (!cookieToken || typeof cookieToken !== 'string') {
      return isDirectCall ? false : { valid: false, error: 'Missing CSRF cookie', code: 'CSRF_COOKIE_MISSING' };
    }

    if (!headerToken || typeof headerToken !== 'string') {
      return isDirectCall ? false : { valid: false, error: 'Missing CSRF token in header or body', code: 'CSRF_TOKEN_MISSING' };
    }

    const bufCookie = Buffer.from(cookieToken, 'utf8');
    const bufHeader = Buffer.from(headerToken, 'utf8');

    if (bufCookie.length !== bufHeader.length) {
      // Dummy compare to avoid timing leak
      crypto.timingSafeEqual(bufCookie, bufCookie);
      return isDirectCall ? false : { valid: false, error: 'CSRF token mismatch', code: 'CSRF_MISMATCH' };
    }

    if (!crypto.timingSafeEqual(bufCookie, bufHeader)) {
      return isDirectCall ? false : { valid: false, error: 'CSRF token mismatch', code: 'CSRF_MISMATCH' };
    }

    return isDirectCall ? true : { valid: true };
  }
}

module.exports = {
  CsrfManager,
  SAFE_METHODS
};
