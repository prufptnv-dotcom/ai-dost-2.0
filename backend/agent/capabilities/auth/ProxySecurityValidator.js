'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: ProxySecurityValidator
 * 
 * Hardens reverse-proxy configurations, cookie attributes, CORS allowlists,
 * Host header injection defenses, and client IP spoofing protection.
 */

class ProxySecurityValidator {
  /**
   * @param {Object} [options]
   * @param {string[]} [options.allowedOrigins]
   * @param {string[]} [options.allowedHosts]
   * @param {string|string[]|number|boolean} [options.trustProxy]
   * @param {boolean} [options.isProduction]
   */
  constructor(options = {}) {
    this.isProduction = options.isProduction !== undefined ? options.isProduction : (process.env.NODE_ENV === 'production');
    this.allowedOrigins = new Set(
      (options.allowedOrigins || ['http://localhost:3000', 'http://127.0.0.1:3000'])
        .map(o => o.toLowerCase().trim())
    );
    this.allowedHosts = new Set(
      (options.allowedHosts || ['localhost:5000', '127.0.0.1:5000', 'localhost:3000', '127.0.0.1:3000'])
        .map(h => h.toLowerCase().trim())
    );
    this.trustProxy = options.trustProxy !== undefined ? options.trustProxy : (process.env.TRUST_PROXY || false);
  }

  /**
   * Validate trust-proxy configuration
   * @param {*} setting 
   * @returns {{ valid: boolean, error?: string, code?: string, recommendation?: string }}
   */
  validateTrustProxy(setting = this.trustProxy) {
    if (setting === true && this.isProduction) {
      return {
        valid: false,
        code: 'TRUST_PROXY_WILDCARD',
        error: 'Wildcard "trust proxy: true" in production allows client IP spoofing via forged X-Forwarded-For headers',
        recommendation: 'Configure trust proxy with specific CIDR subnets (e.g. "loopback, linklocal, uniquelocal") or hop count (1)'
      };
    }

    return { valid: true };
  }

  /**
   * Validate cookie attributes for security compliance
   * @param {Object} cookieOptions 
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validateCookieOptions(cookieOptions = {}) {
    const errors = [];

    if (!cookieOptions.httpOnly) {
      errors.push('Cookie must specify httpOnly: true to prevent XSS credential theft');
    }

    if (this.isProduction && !cookieOptions.secure) {
      errors.push('Cookie must specify secure: true in production to prevent cleartext transmission');
    }

    if (!cookieOptions.sameSite || !['strict', 'lax'].includes(String(cookieOptions.sameSite).toLowerCase())) {
      errors.push('Cookie must specify sameSite: "Strict" or "Lax" to prevent CSRF exploitation');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate CORS Origin against allowlist
   * @param {string} origin 
   * @returns {{ allowed: boolean, origin?: string, reason?: string }}
   */
  validateOrigin(origin) {
    if (!origin) {
      // Direct non-browser requests (curl, server-to-server) without Origin
      return { allowed: true, origin: null };
    }

    const cleanOrigin = origin.toLowerCase().trim();
    if (cleanOrigin === 'null') {
      return { allowed: false, reason: 'Null origin is disallowed' };
    }

    if (this.allowedOrigins.has(cleanOrigin)) {
      return { allowed: true, origin: cleanOrigin };
    }

    return {
      allowed: false,
      reason: `Origin "${cleanOrigin}" is not in the CORS allowlist`
    };
  }

  /**
   * Validate Host header against allowed domains
   * @param {string} host 
   * @returns {{ valid: boolean, error?: string }}
   */
  validateHostHeader(host) {
    if (!host) {
      return { valid: false, error: 'Host header is missing' };
    }

    const cleanHost = host.toLowerCase().trim().split(':')[0]; // strip port for matching
    const hasExact = this.allowedHosts.has(host.toLowerCase().trim());
    const hasHostOnly = this.allowedHosts.has(cleanHost);

    if (hasExact || hasHostOnly) {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Host header "${host}" is not recognized or allowed (Host poisoning prevention)`
    };
  }

  /**
   * Safely extract client IP respecting trusted proxy boundaries
   * @param {Object} req Express request object
   * @returns {string} Sanitized client IP
   */
  getClientIp(req) {
    if (!req) return '127.0.0.1';

    const socketIp = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';

    // If trust proxy is disabled, strictly use socket IP
    if (!this.trustProxy || this.trustProxy === 'false') {
      return socketIp;
    }

    // If trust proxy is configured, inspect X-Forwarded-For
    const xForwardedFor = req.headers?.['x-forwarded-for'];
    if (xForwardedFor && typeof xForwardedFor === 'string') {
      const parts = xForwardedFor.split(',').map(s => s.trim());
      // The leftmost IP is client IP if upstream proxies are trusted
      if (parts[0]) return parts[0];
    }

    return socketIp;
  }
}

module.exports = ProxySecurityValidator;
