'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: AuthPersistenceResult
 * 
 * Standardized result envelope for persistent authentication operations,
 * token rotations, replay attack detections, and store transactions.
 */

class AuthPersistenceResult {
  constructor(ok, data = {}) {
    this.ok = !!ok;
    this.code = data.code || (this.ok ? 'SUCCESS' : 'ERROR');
    this.error = data.error || null;
    this.record = data.record || null;
    this.newRecord = data.newRecord || null;
    this.familyId = data.familyId || null;
    this.userId = data.userId || null;
    this.familyRevoked = !!data.familyRevoked;
    this.replayed = !!data.replayed;
    this.tokenVersion = data.tokenVersion || (data.record && data.record.tokenVersion) || null;
    this.token_version = this.tokenVersion;
    this.details = data.details || null;
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  static success(data = {}, code = 'SUCCESS') {
    return new AuthPersistenceResult(true, { ...data, code });
  }

  static failure(error, code = 'STORE_ERROR', details = null) {
    return new AuthPersistenceResult(false, {
      error: typeof error === 'string' ? error : (error?.message || 'Store error'),
      code,
      details
    });
  }

  static notFound(message = 'Record not found') {
    return new AuthPersistenceResult(false, {
      error: message,
      code: 'NOT_FOUND'
    });
  }

  static replayDetected(familyId, userId) {
    return new AuthPersistenceResult(false, {
      ok: false,
      code: 'TOKEN_REPLAY_DETECTED',
      error: 'Refresh token reuse detected: token family has been revoked',
      familyId,
      userId,
      familyRevoked: true,
      replayed: true
    });
  }

  static expired(userId, familyId = null) {
    return new AuthPersistenceResult(false, {
      ok: false,
      code: 'TOKEN_EXPIRED',
      error: 'Refresh token has expired',
      userId,
      familyId
    });
  }
}

module.exports = AuthPersistenceResult;
