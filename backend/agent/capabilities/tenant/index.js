'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: Multi-Tenant Capability Facade
 */

const TenantResult = require('./TenantResult');
const { TenantValidator, TENANT_ROLES, TENANT_STATUSES, RESERVED_SLUGS } = require('./TenantValidator');
const { TenantPlan, TENANT_PLAN_SCHEMA_VERSION, TENANT_LIMIT_DEFAULTS } = require('./TenantPlan');
const TenantStore = require('./TenantStore');
const SqliteTenantStore = require('./SqliteTenantStore');
const PostgresTenantStore = require('./PostgresTenantStore');
const TenantContextResolver = require('./TenantContextResolver');
const { createTenantMiddleware } = require('./TenantAuthorizationMiddleware');
const TenantOwnershipValidator = require('./TenantOwnershipValidator');
const TenantQuotaManager = require('./TenantQuotaManager');
const TenantAuditLogger = require('./TenantAuditLogger');
const TenantMigrationManager = require('./TenantMigrationManager');

module.exports = {
  TenantResult,
  TenantValidator,
  TENANT_ROLES,
  TENANT_STATUSES,
  RESERVED_SLUGS,
  TenantPlan,
  TENANT_PLAN_SCHEMA_VERSION,
  TENANT_LIMIT_DEFAULTS,
  TenantStore,
  SqliteTenantStore,
  PostgresTenantStore,
  TenantContextResolver,
  createTenantMiddleware,
  TenantOwnershipValidator,
  TenantQuotaManager,
  TenantAuditLogger,
  TenantMigrationManager
};
