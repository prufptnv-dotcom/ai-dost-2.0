'use strict';

/**
 * TenantQuotaManager.js - Organization-Level Quota & Anti-Bypass Aggregator
 *
 * Enforces resource quotas at the tenant boundary:
 * - Prevents multiple accounts within the same tenant from bypassing limits
 * - Manages max projects, max storage bytes, and max concurrent sandboxes
 * - Integrates with distributed rate limiter using tenant-scoped keys
 */

const TenantResult = require('./TenantResult');

class TenantQuotaManager {
  /**
   * @param {import('./TenantStore')} tenantStore
   * @param {object} [options]
   * @param {object} [options.rateLimiter] - RobustRedisRateLimiter or compatible
   */
  constructor(tenantStore, options = {}) {
    if (!tenantStore) {
      throw new Error('TenantQuotaManager requires a valid tenantStore');
    }
    this.tenantStore = tenantStore;
    this.rateLimiter = options.rateLimiter || null;
  }

  /**
   * Checks if tenant has reached project creation quota
   * @param {string} tenantId
   * @param {number} currentProjectCount
   * @returns {Promise<TenantResult>}
   */
  async checkProjectQuota(tenantId, currentProjectCount) {
    const tenant = await this.tenantStore.findTenantById(tenantId);
    if (!tenant) {
      return TenantResult.fail('Tenant not found', 'TENANT_NOT_FOUND');
    }

    const limit = tenant.maxProjects || 20;
    if (currentProjectCount >= limit) {
      return TenantResult.quotaExceeded(
        `Tenant project limit reached (${currentProjectCount}/${limit})`,
        { current: currentProjectCount, limit, resource: 'projects' }
      );
    }

    return TenantResult.success({ allowed: true, current: currentProjectCount, limit });
  }

  /**
   * Checks if tenant has reached concurrent sandbox limit
   * @param {string} tenantId
   * @param {number} activeSandboxCount
   * @returns {Promise<TenantResult>}
   */
  async checkSandboxQuota(tenantId, activeSandboxCount) {
    const tenant = await this.tenantStore.findTenantById(tenantId);
    if (!tenant) {
      return TenantResult.fail('Tenant not found', 'TENANT_NOT_FOUND');
    }

    const limit = tenant.maxConcurrentSandboxes || 2;
    if (activeSandboxCount >= limit) {
      return TenantResult.quotaExceeded(
        `Tenant concurrent sandbox limit reached (${activeSandboxCount}/${limit})`,
        { current: activeSandboxCount, limit, resource: 'sandboxes' }
      );
    }

    return TenantResult.success({ allowed: true, current: activeSandboxCount, limit });
  }

  /**
   * Checks if tenant has sufficient storage quota
   * @param {string} tenantId
   * @param {number} currentBytesUsed
   * @param {number} additionalBytesRequested
   * @returns {Promise<TenantResult>}
   */
  async checkStorageQuota(tenantId, currentBytesUsed, additionalBytesRequested = 0) {
    const tenant = await this.tenantStore.findTenantById(tenantId);
    if (!tenant) {
      return TenantResult.fail('Tenant not found', 'TENANT_NOT_FOUND');
    }

    const limit = tenant.maxStorageBytes || 524288000; // 500 MB default
    const projected = currentBytesUsed + additionalBytesRequested;

    if (projected > limit) {
      return TenantResult.quotaExceeded(
        `Tenant storage limit exceeded (${projected} bytes > ${limit} bytes limit)`,
        { current: currentBytesUsed, requested: additionalBytesRequested, limit, resource: 'storage' }
      );
    }

    return TenantResult.success({ allowed: true, projected, limit });
  }

  /**
   * Checks tenant-level distributed rate limit if rateLimiter is available
   * @param {string} tenantId
   * @param {string} [category='api']
   * @returns {Promise<{ allowed: boolean, remaining?: number, resetTime?: number, error?: string }>}
   */
  async checkRateLimit(tenantId, category = 'api') {
    if (!this.rateLimiter || typeof this.rateLimiter.isAllowed !== 'function') {
      return { allowed: true };
    }

    const tenantKey = `tenant:${tenantId}:${category}`;
    try {
      return await this.rateLimiter.isAllowed(tenantKey, category);
    } catch (err) {
      return { allowed: false, error: err.message };
    }
  }
}

module.exports = TenantQuotaManager;
