const ROLE_CAPABILITIES = {
  SUPERVISOR: [
    'orchestration.manage'
  ],
  RESEARCHER: [
    'filesystem.read',
    'codebase.search',
    'web.search',
    'context.retrieve'
  ],
  CODER: [
    'filesystem.read',
    'filesystem.write',
    'code.edit',
    'terminal.execute',
    'codebase.search',
    'context.retrieve'
  ],
  VERIFIER: [
    'filesystem.read',
    'terminal.execute',
    'test.run',
    'verification.inspect',
    'codebase.search'
  ]
};

const ALLOWED_WORKER_ROLES = ['RESEARCHER', 'CODER', 'VERIFIER'];
const ALL_ROLES = Object.keys(ROLE_CAPABILITIES);

class CapabilityPolicy {
  /**
   * Check if a given role has a specific capability.
   */
  static isAllowed(role, capability) {
    if (!role || typeof role !== 'string') return false;
    const normalizedRole = role.toUpperCase().trim();
    const capabilities = ROLE_CAPABILITIES[normalizedRole];
    if (!capabilities) return false;
    return capabilities.includes(capability);
  }

  /**
   * Assert that a role has a capability; throw Error if not allowed.
   */
  static assertAllowed(role, capability) {
    if (!this.isAllowed(role, capability)) {
      throw new Error(`Capability '${capability}' is denied for role '${role}'`);
    }
  }

  /**
   * Validate if a role is recognized in the system.
   */
  static validateRole(role) {
    if (!role || typeof role !== 'string') return false;
    return ALL_ROLES.includes(role.toUpperCase().trim());
  }

  /**
   * Validate if a role is an allowed target worker role for delegation.
   */
  static validateWorkerRole(role) {
    if (!role || typeof role !== 'string') return false;
    return ALLOWED_WORKER_ROLES.includes(role.toUpperCase().trim());
  }

  /**
   * Get all capabilities for a role.
   */
  static getCapabilities(role) {
    if (!role || typeof role !== 'string') return [];
    return ROLE_CAPABILITIES[role.toUpperCase().trim()] || [];
  }

  static get ALLOWED_WORKER_ROLES() {
    return [...ALLOWED_WORKER_ROLES];
  }

  static get ALL_ROLES() {
    return [...ALL_ROLES];
  }
}

module.exports = CapabilityPolicy;
