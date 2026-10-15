'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: TenantStore
 * 
 * Abstract base class and contract for tenant and membership persistence adapters.
 */

class TenantStore {
  constructor() {
    if (new.target === TenantStore) {
      throw new Error('TenantStore is an abstract class and cannot be instantiated directly');
    }
  }

  async init() {
    throw new Error('TenantStore.init must be implemented by subclass');
  }

  async createTenant(tenantData, ownerUserId) {
    throw new Error('TenantStore.createTenant must be implemented by subclass');
  }

  async getTenantById(tenantId) {
    throw new Error('TenantStore.getTenantById must be implemented by subclass');
  }

  async findTenantById(tenantId) {
    throw new Error('TenantStore.findTenantById must be implemented by subclass');
  }

  async getTenantBySlug(slug) {
    throw new Error('TenantStore.getTenantBySlug must be implemented by subclass');
  }

  async findTenantBySlug(slug) {
    throw new Error('TenantStore.findTenantBySlug must be implemented by subclass');
  }

  async updateTenant(tenantId, updates, requestingUserId) {
    throw new Error('TenantStore.updateTenant must be implemented by subclass');
  }

  async addMembership(tenantId, userId, role, status) {
    throw new Error('TenantStore.addMembership must be implemented by subclass');
  }

  async updateMembershipRole(tenantId, userId, newRole, requestingUserId) {
    throw new Error('TenantStore.updateMembershipRole must be implemented by subclass');
  }

  async updateMemberRole(tenantId, userId, newRole, requestingUserId) {
    throw new Error('TenantStore.updateMemberRole must be implemented by subclass');
  }

  async removeMembership(tenantId, userId, requestingUserId) {
    throw new Error('TenantStore.removeMembership must be implemented by subclass');
  }

  async getMembership(tenantId, userId) {
    throw new Error('TenantStore.getMembership must be implemented by subclass');
  }

  async listUserTenants(userId) {
    throw new Error('TenantStore.listUserTenants must be implemented by subclass');
  }

  async getUserMemberships(userId) {
    throw new Error('TenantStore.getUserMemberships must be implemented by subclass');
  }

  async listTenantMembers(tenantId) {
    throw new Error('TenantStore.listTenantMembers must be implemented by subclass');
  }

  async getActiveOwnerCount(tenantId) {
    throw new Error('TenantStore.getActiveOwnerCount must be implemented by subclass');
  }

  async close() {
    throw new Error('TenantStore.close must be implemented by subclass');
  }
}

module.exports = TenantStore;
