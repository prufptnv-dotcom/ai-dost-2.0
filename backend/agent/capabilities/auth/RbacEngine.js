'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: RbacEngine
 * 
 * Role-Based Access Control hierarchy, permission enforcement,
 * parameter stripping (anti-mass assignment), self-elevation guard,
 * and last-admin protection.
 */

const ROLE_LEVELS = Object.freeze({
  admin: 100,
  user: 10,
  guest: 1,
  anonymous: 0
});

const FORBIDDEN_CLIENT_FIELDS = Object.freeze([
  'role',
  'roles',
  'permission',
  'permissions',
  'isAdmin',
  'is_admin',
  'admin',
  'status',
  'token_version',
  'tokenVersion',
  'id',
  '_id',
  'created_at',
  'updated_at'
]);

class RbacEngine {
  /**
   * Check if role A has at least the privilege level of role B
   * @param {string} role
   * @param {string} requiredRole
   * @returns {boolean}
   */
  static hasRole(role, requiredRole) {
    const userLevel = ROLE_LEVELS[role] !== undefined ? ROLE_LEVELS[role] : 0;
    const requiredLevel = ROLE_LEVELS[requiredRole] !== undefined ? ROLE_LEVELS[requiredRole] : 0;
    return userLevel >= requiredLevel;
  }

  /**
   * Strip all forbidden security/role fields from client request body
   * Prevents mass assignment privilege escalation.
   * @param {Object} input
   * @returns {Object} Cleaned object
   */
  static sanitizeInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    const clean = {};
    for (const [k, v] of Object.entries(input)) {
      if (!FORBIDDEN_CLIENT_FIELDS.includes(k)) {
        clean[k] = v;
      }
    }
    return clean;
  }

  static sanitizeUserInput(input) {
    return this.sanitizeInput(input);
  }

  /**
   * Check whether input contains any forbidden client fields
   * @param {Object} input
   * @returns {boolean}
   */
  static hasForbiddenFields(input) {
    if (!input || typeof input !== 'object') return false;
    return Object.keys(input).some(k => FORBIDDEN_CLIENT_FIELDS.includes(k));
  }

  /**
   * Enforce last-admin protection
   * @param {Array<Object>} allUsers
   * @param {string} targetUserId
   * @param {string} newRole
   * @returns {{ allowed: boolean, error?: string }}
   */
  static validateAdminDemotionOrDeletion(allUsers, targetUserId, newRole = null) {
    const activeAdmins = allUsers.filter(u => u.role === 'admin' && (u.status === undefined || u.status === 'active'));
    const isTargetAdmin = activeAdmins.some(u => u.id === targetUserId);

    if (isTargetAdmin && activeAdmins.length <= 1) {
      if (newRole !== 'admin') {
        return {
          allowed: false,
          error: 'CANNOT_REMOVE_LAST_ADMIN: At least one active administrator must exist in the system'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * One-time admin bootstrap flow
   * Allows bootstrapping the first administrator only when 0 admins currently exist.
   * @param {Array<Object>} allUsers
   * @param {string} targetUserId
   * @returns {{ ok: boolean, error?: string }}
   */
  static bootstrapInitialAdmin(allUsers, targetUserId) {
    const existingAdmins = allUsers.filter(u => u.role === 'admin');
    if (existingAdmins.length > 0) {
      return {
        ok: false,
        error: 'ADMIN_BOOTSTRAP_LOCKED: Administrator account already exists; bootstrap is permanently closed'
      };
    }

    const user = allUsers.find(u => u.id === targetUserId);
    if (!user) {
      return { ok: false, error: 'User not found' };
    }

    user.role = 'admin';
    return { ok: true, user };
  }

  static canRemoveAdmin(allUsers, targetUserId) {
    const res = this.validateAdminDemotionOrDeletion(allUsers, targetUserId, 'user');
    return res.allowed;
  }

  static canBootstrapAdmin(adminCount) {
    return adminCount === 0;
  }
}

module.exports = {
  RbacEngine,
  ROLE_LEVELS,
  FORBIDDEN_CLIENT_FIELDS
};
