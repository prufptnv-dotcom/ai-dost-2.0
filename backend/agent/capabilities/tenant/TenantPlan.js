'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: TenantPlan
 * 
 * Immutable declarative specification for tenant creation and configuration.
 */

const { TenantValidator, TENANT_ROLES, TENANT_STATUS } = require('./TenantValidator');

const TENANT_PLAN_SCHEMA_VERSION = '1.0.0';

const TENANT_LIMIT_DEFAULTS = Object.freeze({
  maxProjects: 50,
  maxStorageBytes: 524288000, // 500 MB
  maxConcurrentSandboxes: 2,
  maxUsers: 10,
  maxConcurrentJobs: 5
});

class TenantPlan {
  /**
   * @param {Object} spec
   * @param {string} spec.name
   * @param {string} spec.slug
   * @param {string} [spec.ownerId]
   * @param {string} [spec.ownerUserId]
   * @param {number} [spec.maxUsers=10]
   * @param {number} [spec.maxProjects=50]
   * @param {number} [spec.maxStorageBytes=524288000]
   * @param {number} [spec.maxConcurrentSandboxes=2]
   * @param {number} [spec.maxConcurrentJobs=5]
   * @param {Object} [spec.settings={}]
   * @param {string} [spec.status='active']
   */
  constructor(spec = {}) {
    this.schemaVersion = TENANT_PLAN_SCHEMA_VERSION;

    const nameValidation = TenantValidator.validateName(spec.name);
    if (!nameValidation.valid) {
      throw new Error(`TENANT_PLAN_INVALID: ${nameValidation.error}`);
    }
    this.name = nameValidation.name;

    const slugValidation = TenantValidator.validateSlug(spec.slug || spec.name);
    if (!slugValidation.valid) {
      throw new Error(`TENANT_PLAN_INVALID: ${slugValidation.error}`);
    }
    this.slug = slugValidation.slug;

    const effectiveOwnerId = spec.ownerId || spec.ownerUserId;
    if (!effectiveOwnerId || typeof effectiveOwnerId !== 'string') {
      throw new Error('TENANT_PLAN_INVALID: ownerId is required');
    }
    this.ownerId = effectiveOwnerId.trim();

    this.maxUsers = Number.isInteger(spec.maxUsers) && spec.maxUsers > 0 ? spec.maxUsers : 10;
    this.maxProjects = Number.isInteger(spec.maxProjects) && spec.maxProjects > 0 ? spec.maxProjects : 50;
    this.maxStorageBytes = Number.isInteger(spec.maxStorageBytes) && spec.maxStorageBytes > 0 ? spec.maxStorageBytes : 524288000;
    this.maxConcurrentSandboxes = Number.isInteger(spec.maxConcurrentSandboxes) && spec.maxConcurrentSandboxes > 0 ? spec.maxConcurrentSandboxes : 2;
    this.maxConcurrentJobs = Number.isInteger(spec.maxConcurrentJobs) && spec.maxConcurrentJobs > 0 ? spec.maxConcurrentJobs : 5;

    this.limits = Object.freeze({
      maxProjects: this.maxProjects,
      maxStorageBytes: this.maxStorageBytes,
      maxConcurrentSandboxes: this.maxConcurrentSandboxes,
      maxUsers: this.maxUsers,
      maxConcurrentJobs: this.maxConcurrentJobs
    });

    this.settings = typeof spec.settings === 'object' && spec.settings !== null ? { ...spec.settings } : {};
    this.status = spec.status ? TenantValidator.validateStatus(spec.status).status : 'active';
    this.createdAt = spec.createdAt || new Date().toISOString();
  }

  static create(spec = {}) {
    const plan = new TenantPlan(spec);
    return plan.freeze();
  }

  freeze() {
    if (this.limits) Object.freeze(this.limits);
    Object.freeze(this.settings);
    Object.freeze(this);
    return this;
  }
}

module.exports = {
  TenantPlan,
  TENANT_PLAN_SCHEMA_VERSION,
  TENANT_LIMIT_DEFAULTS
};
