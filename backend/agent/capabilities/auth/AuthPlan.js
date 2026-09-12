'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: AuthPlan
 * 
 * Formal, versioned, deeply immutable specification for project authentication,
 * session lifecycle, password security, and access control.
 */

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

const AUTH_PLAN_SCHEMA_VERSION = '1.0.0';

const ALLOWED_HASH_ALGORITHMS = Object.freeze(['scrypt', 'bcrypt']);
const ALLOWED_JWT_ALGORITHMS = Object.freeze(['HS256']);
const ALLOWED_SESSION_STRATEGIES = Object.freeze(['jwt_stateless', 'session_cookie']);

const WEAK_SECRETS_BLACKLIST = new Set([
  'secret',
  'password',
  '12345678',
  'changeme',
  'admin',
  'default_secret',
  'jwt_secret',
  'mysecretkey',
  'supersecret'
]);

class AuthPlan {
  /**
   * Create and normalize an immutable AuthPlan
   * @param {Object} spec
   * @returns {AuthPlan}
   */
  static create(spec = {}) {
    const schemaVersion = spec.schemaVersion || AUTH_PLAN_SCHEMA_VERSION;
    if (schemaVersion !== AUTH_PLAN_SCHEMA_VERSION) {
      throw new Error(`INVALID_AUTH_PLAN: Unsupported schemaVersion '${schemaVersion}'`);
    }

    const rawProj = spec.projectId !== undefined ? spec.projectId : spec.projectName;
    if (rawProj !== undefined && (typeof rawProj !== 'string' || !rawProj.trim())) {
      throw new Error('INVALID_AUTH_PLAN: projectName must be a non-empty string');
    }
    const projectId = typeof rawProj === 'string' && rawProj.trim()
      ? rawProj.trim()
      : 'app';

    const sessionStrategy = spec.sessionStrategy || (spec.session && spec.session.strategy) || 'jwt_stateless';
    if (!ALLOWED_SESSION_STRATEGIES.includes(sessionStrategy)) {
      throw new Error(`INVALID_AUTH_PLAN: Unsupported sessionStrategy '${sessionStrategy}'. Allowed: [${ALLOWED_SESSION_STRATEGIES.join(', ')}]`);
    }

    // Rate limit bounds check on rateLimitMax if provided
    if (spec.rateLimitMax !== undefined) {
      if (typeof spec.rateLimitMax !== 'number' || spec.rateLimitMax < 1 || spec.rateLimitMax > 100) {
        throw new Error('INVALID_AUTH_PLAN: rateLimitMax must be between 1 and 100');
      }
    }

    // Password Hashing Configuration
    const hashConfig = spec.passwordHashing || spec.passwordHash || {};
    const hashAlgorithm = (hashConfig.algorithm || 'scrypt').toLowerCase();
    if (!ALLOWED_HASH_ALGORITHMS.includes(hashAlgorithm)) {
      throw new Error(`INVALID_AUTH_PLAN: Unsupported password hash algorithm '${hashAlgorithm}'. Allowed: [${ALLOWED_HASH_ALGORITHMS.join(', ')}]`);
    }

    const maxPasswordLength = typeof hashConfig.maxPasswordLength === 'number'
      ? Math.min(hashConfig.maxPasswordLength, 72)
      : 72; // Enforce max 72 bytes strictly

    const minPasswordLength = typeof hashConfig.minPasswordLength === 'number'
      ? Math.max(hashConfig.minPasswordLength, 8)
      : 8;

    const hashCost = hashConfig.cost || (hashAlgorithm === 'scrypt'
      ? { N: 16384, r: 8, p: 1 }
      : { rounds: 12 });

    // JWT Configuration
    const jwtConfig = spec.jwt || {};
    const jwtAlgorithm = jwtConfig.algorithm || 'HS256';
    if (!ALLOWED_JWT_ALGORITHMS.includes(jwtAlgorithm)) {
      throw new Error(`INVALID_AUTH_PLAN: Unsupported JWT algorithm '${jwtAlgorithm}'. Only approved allowlist: [${ALLOWED_JWT_ALGORITHMS.join(', ')}]`);
    }

    const jwtSecret = jwtConfig.secret || null;
    if (jwtSecret) {
      if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
        throw new Error('INVALID_AUTH_PLAN: jwt.secret must be at least 32 characters (256 bits)');
      }
      if (WEAK_SECRETS_BLACKLIST.has(jwtSecret.toLowerCase())) {
        throw new Error('INVALID_AUTH_PLAN: jwt.secret matches a known weak secret wordlist');
      }
    }

    const accessTokenTtlSec = typeof jwtConfig.accessTokenTtlSec === 'number'
      ? Math.max(60, Math.min(jwtConfig.accessTokenTtlSec, 3600)) // 1m - 1h
      : 900; // 15 minutes default

    const refreshTtlSec = typeof jwtConfig.refreshTtlSec === 'number'
      ? Math.max(3600, Math.min(jwtConfig.refreshTtlSec, 2592000)) // 1h - 30d
      : 604800; // 7 days default

    const issuer = jwtConfig.issuer || `ai-dost:${projectId}`;
    const audience = jwtConfig.audience || `ai-dost-client:${projectId}`;

    // Cookie Security Configuration
    const cookieConfig = spec.cookies || spec.cookie || spec.cookieOptions || {};
    const cookies = {
      httpOnly: true, // Always true (non-configurable for security)
      secure: cookieConfig.secure !== undefined ? Boolean(cookieConfig.secure) : process.env.NODE_ENV === 'production',
      sameSite: cookieConfig.sameSite || 'Strict',
      path: cookieConfig.path || '/api/auth'
    };

    // Rate Limiting Policy
    const rateLimitConfig = spec.rateLimiting || spec.rateLimit || (spec.rateLimitMax !== undefined ? { ipMaxPerMinute: spec.rateLimitMax } : {});
    const rateLimiting = {
      ipMaxPerMinute: typeof rateLimitConfig.ipMaxPerMinute === 'number' ? Math.max(1, rateLimitConfig.ipMaxPerMinute) : 10,
      accountMaxConsecutiveFails: typeof rateLimitConfig.accountMaxConsecutiveFails === 'number' ? Math.max(1, rateLimitConfig.accountMaxConsecutiveFails) : 5,
      progressiveDelayBaseMs: 1000
    };

    // RBAC & Roles Configuration
    const rbacConfig = spec.rbac || (spec.roles ? { roles: spec.roles } : {});
    const roles = Array.isArray(rbacConfig.roles) && rbacConfig.roles.length > 0
      ? [...rbacConfig.roles]
      : ['admin', 'user', 'guest'];
    const defaultRole = rbacConfig.defaultRole || 'user';
    if (!roles.includes(defaultRole)) {
      throw new Error(`INVALID_AUTH_PLAN: defaultRole '${defaultRole}' must be in roles list: [${roles.join(', ')}]`);
    }

    const passwordHashingObj = {
      algorithm: hashAlgorithm,
      cost: hashCost,
      minPasswordLength,
      maxPasswordLength
    };

    const rateLimitObj = {
      ...rateLimiting,
      maxRequestsPerMinute: rateLimiting.ipMaxPerMinute
    };

    const plan = {
      schemaVersion: AUTH_PLAN_SCHEMA_VERSION,
      projectId,
      projectName: projectId,
      sessionStrategy,
      session: {
        strategy: sessionStrategy
      },
      passwordHashing: passwordHashingObj,
      passwordHash: passwordHashingObj,
      jwt: {
        algorithm: jwtAlgorithm,
        secret: jwtSecret,
        accessTokenTtlSec,
        refreshTtlSec,
        issuer,
        audience
      },
      cookies,
      cookie: cookies,
      rateLimiting,
      rateLimit: rateLimitObj,
      rbac: {
        roles,
        defaultRole
      },
      roles,
      adminBootstrap: {
        enabled: true,
        method: 'cli_or_token'
      },
      csrf: {
        enabled: true,
        headerName: 'X-CSRF-Token',
        cookieName: 'csrf_token'
      }
    };

    return deepFreeze(plan);
  }
}

module.exports = {
  AuthPlan,
  AUTH_PLAN_SCHEMA_VERSION,
  ALLOWED_HASH_ALGORITHMS,
  ALLOWED_JWT_ALGORITHMS,
  ALLOWED_SESSION_STRATEGIES
};
