'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: Authentication & Access Control Capability Facade
 */

const { AuthPlan, AUTH_PLAN_SCHEMA_VERSION, ALLOWED_HASH_ALGORITHMS, ALLOWED_JWT_ALGORITHMS, ALLOWED_SESSION_STRATEGIES } = require('./AuthPlan');
const { AuthCryptoEngine, DEFAULT_SCRYPT_PARAMS } = require('./AuthCryptoEngine');
const { JwtEngine, ALLOWED_ALGORITHMS } = require('./JwtEngine');
const { RefreshTokenManager } = require('./RefreshTokenManager');
const { CsrfManager, SAFE_METHODS } = require('./CsrfManager');
const { AuthRateLimiter } = require('./RateLimiter');
const { RbacEngine, ROLE_LEVELS, FORBIDDEN_CLIENT_FIELDS } = require('./RbacEngine');
const { OwnershipValidator } = require('./OwnershipValidator');
const { AuthMiddleware } = require('./AuthMiddleware');
const { AuthResult, AUTH_STATUS } = require('./AuthResult');
const { AuthSynthesizer } = require('./AuthSynthesizer');

const PersistentAuthStore = require('./PersistentAuthStore');
const SqliteAuthStore = require('./SqliteAuthStore');
const PostgresAuthStore = require('./PostgresAuthStore');
const { AuthStoreFactory, MemoryAuthStore } = require('./AuthStoreFactory');
const AuthPersistenceResult = require('./AuthPersistenceResult');
const { DistributedRateLimiter, NativeRespClient, DEFAULT_BUCKETS } = require('./DistributedRateLimiter');
const { AuthAvailabilityPolicy, POLICY_MODES } = require('./AuthAvailabilityPolicy');
const SecretConfigValidator = require('./SecretConfigValidator');
const JwtKeyManager = require('./JwtKeyManager');
const ProxySecurityValidator = require('./ProxySecurityValidator');

module.exports = {
  // Phase 5A
  AuthPlan,
  AUTH_PLAN_SCHEMA_VERSION,
  ALLOWED_HASH_ALGORITHMS,
  ALLOWED_JWT_ALGORITHMS,
  ALLOWED_SESSION_STRATEGIES,
  AuthCryptoEngine,
  DEFAULT_SCRYPT_PARAMS,
  JwtEngine,
  ALLOWED_ALGORITHMS,
  RefreshTokenManager,
  CsrfManager,
  SAFE_METHODS,
  AuthRateLimiter,
  RbacEngine,
  ROLE_LEVELS,
  FORBIDDEN_CLIENT_FIELDS,
  OwnershipValidator,
  AuthMiddleware,
  AuthResult,
  AUTH_STATUS,
  AuthSynthesizer,

  // Phase 5B
  PersistentAuthStore,
  SqliteAuthStore,
  PostgresAuthStore,
  AuthStoreFactory,
  MemoryAuthStore,
  AuthPersistenceResult,
  DistributedRateLimiter,
  NativeRespClient,
  DEFAULT_BUCKETS,
  AuthAvailabilityPolicy,
  POLICY_MODES,
  SecretConfigValidator,
  JwtKeyManager,
  ProxySecurityValidator
};

