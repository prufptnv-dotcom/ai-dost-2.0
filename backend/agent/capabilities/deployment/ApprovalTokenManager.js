'use strict';

/**
 * AI-Dost 2.0 — Phase 4H: ApprovalTokenManager
 * 
 * Cryptographic 5-state production approval token lifecycle.
 * States: ISSUED -> RESERVED -> CONSUMED / EXPIRED / REVOKED
 * 
 * Enforces atomic reservation, short reservation TTL (60s), 
 * TOCTOU protection via artifact hashing, and in-memory replay prevention.
 */

const crypto = require('crypto');

const TOKEN_STATES = Object.freeze({
  ISSUED: 'ISSUED',
  RESERVED: 'RESERVED',
  CONSUMED: 'CONSUMED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
});

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes validity
const RESERVATION_TTL_MS = 60 * 1000; // 60 seconds reservation lock

class ApprovalTokenManager {
  constructor(secret = null) {
    this._secret = secret || crypto.randomBytes(32).toString('hex');
    this._tokens = new Map(); // In-memory store (local single-node execution)
  }

  /**
   * Issue a new production approval token
   * @param {object} params
   * @returns {object} Token descriptor (never log raw signature)
   */
  issueToken(params = {}) {
    const {
      projectId,
      artifactHash,
      planHash,
      targetEnv = 'production',
      provider = 'docker',
      deploymentVersion = '1.0.0'
    } = params;

    if (!projectId || !artifactHash) {
      throw new Error('ApprovalTokenManager: projectId and artifactHash are required');
    }

    if (targetEnv !== 'production') {
      throw new Error('ApprovalTokenManager: Tokens are only issued for production targetEnv');
    }

    const tokenId = `tok-${crypto.randomUUID()}`;
    const issuedAt = Date.now();
    const expiresAt = issuedAt + TOKEN_TTL_MS;
    const nonce = crypto.randomBytes(16).toString('hex');

    const payload = `${tokenId}:${projectId}:${artifactHash}:${planHash || ''}:${targetEnv}:${provider}:${deploymentVersion}:${issuedAt}:${expiresAt}:${nonce}`;
    const signature = crypto.createHmac('sha256', this._secret).update(payload).digest('hex');

    const tokenRecord = {
      tokenId,
      projectId,
      artifactHash,
      planHash,
      targetEnv,
      provider,
      deploymentVersion,
      issuedAt,
      expiresAt,
      reservationExpiresAt: null,
      nonce,
      state: TOKEN_STATES.ISSUED,
      signature
    };

    this._tokens.set(tokenId, tokenRecord);

    // Return token object with sanitized signature hash for user identification
    return {
      tokenId,
      projectId,
      artifactHash,
      targetEnv,
      deploymentVersion,
      issuedAt,
      expiresAt,
      state: TOKEN_STATES.ISSUED,
      tokenSecret: `${tokenId}.${signature}` // Client passes this back for execution
    };
  }

  /**
   * Parse token secret string (tokenId.signature)
   * @param {string} tokenSecret
   * @returns {{ tokenId: string, signature: string }}
   */
  _parseTokenSecret(tokenSecret) {
    if (!tokenSecret || typeof tokenSecret !== 'string') {
      throw new Error('TOKEN_FORMAT_INVALID: Approval token must be a valid string');
    }
    const parts = tokenSecret.split('.');
    if (parts.length !== 2) {
      throw new Error('TOKEN_FORMAT_INVALID: Token must be in format "tokenId.signature"');
    }
    return { tokenId: parts[0], signature: parts[1] };
  }

  /**
   * Atomically reserve a token before deployment begins
   * @param {string} tokenSecret - Token secret provided by client
   * @param {object} context - Execution context { projectId, currentArtifactHash }
   * @returns {{ success: boolean, error?: string, tokenRecord?: object }}
   */
  reserveToken(tokenSecret, context = {}) {
    let parsed;
    try {
      parsed = this._parseTokenSecret(tokenSecret);
    } catch (err) {
      return { success: false, error: err.message };
    }

    const { tokenId, signature } = parsed;
    const record = this._tokens.get(tokenId);

    if (!record) {
      return { success: false, error: 'TOKEN_NOT_FOUND: Approval token does not exist' };
    }

    // Verify signature integrity
    if (record.signature !== signature) {
      return { success: false, error: 'TOKEN_SIGNATURE_MISMATCH: Cryptographic token validation failed' };
    }

    // Verify expiration
    const now = Date.now();
    if (now > record.expiresAt) {
      record.state = TOKEN_STATES.EXPIRED;
      return { success: false, error: 'TOKEN_EXPIRED: Production approval token has expired (>15m TTL)' };
    }

    // TOCTOU check: verify artifact hash has not changed
    if (context.currentArtifactHash && context.currentArtifactHash !== record.artifactHash) {
      record.state = TOKEN_STATES.REVOKED;
      return { 
        success: false, 
        error: `TOCTOU_ARTIFACT_MODIFIED: Workspace artifact was modified after token was issued (expected ${record.artifactHash.slice(0, 8)}, got ${context.currentArtifactHash.slice(0, 8)})` 
      };
    }

    // Check project match
    if (context.projectId && context.projectId !== record.projectId) {
      return { success: false, error: 'TOKEN_PROJECT_MISMATCH: Token does not belong to this project' };
    }

    // Check current state and reservation lock
    if (record.state === TOKEN_STATES.CONSUMED) {
      return { success: false, error: 'TOKEN_ALREADY_CONSUMED: Single-use approval token was already used' };
    }

    if (record.state === TOKEN_STATES.REVOKED) {
      return { success: false, error: 'TOKEN_REVOKED: Approval token has been revoked' };
    }

    if (record.state === TOKEN_STATES.RESERVED) {
      if (record.reservationExpiresAt && now < record.reservationExpiresAt) {
        return { success: false, error: 'TOKEN_ALREADY_RESERVED: Token is currently locked by a concurrent deployment' };
      }
      // Reservation expired, release back to ISSUED
      record.state = TOKEN_STATES.ISSUED;
    }

    // Atomic transition to RESERVED
    record.state = TOKEN_STATES.RESERVED;
    record.reservationExpiresAt = now + RESERVATION_TTL_MS;

    return {
      success: true,
      tokenRecord: { ...record }
    };
  }

  /**
   * Permanently burn a token once irreversible production mutation has begun
   * @param {string} tokenId
   */
  consumeToken(tokenId) {
    const record = this._tokens.get(tokenId);
    if (record) {
      record.state = TOKEN_STATES.CONSUMED;
      record.reservationExpiresAt = null;
    }
  }

  /**
   * Release reservation back to ISSUED if pre-mutation failure occurs
   * @param {string} tokenId
   */
  releaseReservation(tokenId) {
    const record = this._tokens.get(tokenId);
    if (record && record.state === TOKEN_STATES.RESERVED) {
      record.state = TOKEN_STATES.ISSUED;
      record.reservationExpiresAt = null;
    }
  }

  /**
   * Manually revoke a token
   * @param {string} tokenId
   */
  revokeToken(tokenId) {
    const record = this._tokens.get(tokenId);
    if (record) {
      record.state = TOKEN_STATES.REVOKED;
      record.reservationExpiresAt = null;
    }
  }
}

const defaultApprovalTokenManager = new ApprovalTokenManager();

module.exports = {
  ApprovalTokenManager,
  defaultApprovalTokenManager,
  TOKEN_STATES,
  TOKEN_TTL_MS,
  RESERVATION_TTL_MS
};
