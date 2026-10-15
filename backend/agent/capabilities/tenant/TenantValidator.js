'use strict';

/**
 * AI-Dost 2.0 — Phase 5C: TenantValidator
 * 
 * Validates tenant metadata, slugs, roles, status transitions, and membership bounds.
 */

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'system',
  'app',
  'auth',
  'billing',
  'root',
  'default',
  'login',
  'register',
  'public',
  'dashboard',
  'settings',
  'health',
  'status',
  'internal'
]);

const TENANT_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
});

const ROLE_LEVELS = Object.freeze({
  owner: 100,
  admin: 50,
  member: 10
});

const TENANT_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived'
});

const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: 'active',
  INVITED: 'invited',
  SUSPENDED: 'suspended'
});

class TenantValidator {
  static normalizeSlug(slug) {
    if (!slug || typeof slug !== 'string') return '';
    return slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  static validateSlug(slug) {
    if (!slug || typeof slug !== 'string') {
      return { valid: false, error: 'Slug is required and must be a string', code: 'SLUG_REQUIRED' };
    }

    const trimmed = slug.trim().toLowerCase();

    if (trimmed.length < 3 || trimmed.length > 48) {
      return { valid: false, error: 'Slug must be between 3 and 48 characters', code: 'SLUG_LENGTH_INVALID' };
    }

    // Must start and end with alphanumeric character, only lowercase alphanumeric and single hyphens allowed
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
      return { valid: false, error: 'Slug must contain only lowercase alphanumeric characters and single hyphens', code: 'SLUG_FORMAT_INVALID' };
    }

    if (RESERVED_SLUGS.has(trimmed)) {
      return { valid: false, error: `Slug "${trimmed}" is reserved and cannot be used`, code: 'SLUG_RESERVED' };
    }

    return { valid: true, slug: trimmed };
  }

  static validateName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Tenant name is required and must be a string', code: 'NAME_REQUIRED' };
    }
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 100) {
      return { valid: false, error: 'Tenant name must be between 2 and 100 characters', code: 'NAME_LENGTH_INVALID' };
    }
    return { valid: true, name: clean };
  }

  static validateRole(role) {
    if (!role || typeof role !== 'string') {
      return { valid: false, error: 'Role is required', code: 'ROLE_REQUIRED' };
    }
    const clean = role.trim().toLowerCase();
    if (!Object.values(TENANT_ROLES).includes(clean)) {
      return { valid: false, error: `Invalid role "${role}". Allowed roles: owner, admin, member`, code: 'ROLE_INVALID' };
    }
    return { valid: true, role: clean, level: ROLE_LEVELS[clean] };
  }

  static validateStatus(status) {
    if (!status || typeof status !== 'string') {
      return { valid: false, error: 'Status is required', code: 'STATUS_REQUIRED' };
    }
    const clean = status.trim().toLowerCase();
    if (!Object.values(TENANT_STATUS).includes(clean)) {
      return { valid: false, error: `Invalid status "${status}". Allowed: active, suspended, archived`, code: 'STATUS_INVALID' };
    }
    return { valid: true, status: clean };
  }

  static hasSufficientRole(userRole, requiredRole) {
    const userLevel = ROLE_LEVELS[userRole?.toLowerCase()] || 0;
    const requiredLevel = ROLE_LEVELS[requiredRole?.toLowerCase()] || 999;
    return userLevel >= requiredLevel;
  }

  static canPerform(userRole, requiredRole) {
    return this.hasSufficientRole(userRole, requiredRole);
  }
}

module.exports = {
  TenantValidator,
  RESERVED_SLUGS,
  TENANT_ROLES,
  ROLE_LEVELS,
  TENANT_STATUS,
  MEMBERSHIP_STATUS
};
