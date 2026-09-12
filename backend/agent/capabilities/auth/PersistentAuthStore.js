'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: PersistentAuthStore
 * 
 * Abstract contract for persistent session, refresh-token, and user storage.
 * Enforces transactional token family rotation, replay attack prevention,
 * and zero plain-text token storage.
 */

class PersistentAuthStore {
  constructor(options = {}) {
    if (new.target === PersistentAuthStore) {
      throw new TypeError('Cannot construct PersistentAuthStore directly: abstract class');
    }
    this.options = options;
  }

  async init() {
    throw new Error('PersistentAuthStore.init() must be implemented by subclass');
  }

  async saveUser(_userRecord) {
    throw new Error('PersistentAuthStore.saveUser() must be implemented by subclass');
  }

  async getUserById(_userId) {
    throw new Error('PersistentAuthStore.getUserById() must be implemented by subclass');
  }

  async getUserByEmail(_email) {
    throw new Error('PersistentAuthStore.getUserByEmail() must be implemented by subclass');
  }

  async getUserByUsername(_username) {
    throw new Error('PersistentAuthStore.getUserByUsername() must be implemented by subclass');
  }

  async incrementUserTokenVersion(_userId) {
    throw new Error('PersistentAuthStore.incrementUserTokenVersion() must be implemented by subclass');
  }

  async saveRefreshToken(_tokenRecord) {
    throw new Error('PersistentAuthStore.saveRefreshToken() must be implemented by subclass');
  }

  async getRefreshTokenByHash(_tokenHash) {
    throw new Error('PersistentAuthStore.getRefreshTokenByHash() must be implemented by subclass');
  }

  /**
   * Atomically rotate a refresh token.
   * If old token is already revoked, revokes entire family (replay attack).
   * If valid, marks old token revoked and stores new token in same family.
   * @param {string} oldTokenHash 
   * @param {Object} newTokenRecord 
   * @returns {Promise<AuthPersistenceResult>}
   */
  async rotateRefreshToken(_oldTokenHash, _newTokenRecord) {
    throw new Error('PersistentAuthStore.rotateRefreshToken() must be implemented by subclass');
  }

  async revokeFamily(_familyId) {
    throw new Error('PersistentAuthStore.revokeFamily() must be implemented by subclass');
  }

  async revokeAllForUser(_userId) {
    throw new Error('PersistentAuthStore.revokeAllForUser() must be implemented by subclass');
  }

  async pruneExpiredTokens() {
    throw new Error('PersistentAuthStore.pruneExpiredTokens() must be implemented by subclass');
  }

  async close() {
    throw new Error('PersistentAuthStore.close() must be implemented by subclass');
  }
}

module.exports = PersistentAuthStore;
