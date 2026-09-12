'use strict';

/**
 * AI-Dost 2.0 — Phase 5A: AuthRateLimiter
 * 
 * Dual-dimensional in-memory rate limiter:
 * 1. Per-IP sliding-window requests limiter (blocks volumetric attacks).
 * 2. Per-account progressive delay limiter (slows down brute force without lockout-DoS).
 */

class AuthRateLimiter {
  constructor(options = {}) {
    this._ipLimit = options.maxRequests || options.ipMaxPerMinute || 10;
    this._ipWindowMs = options.windowMs || options.ipWindowMs || 60000; // 1 minute
    this._accountMaxFails = options.accountMaxConsecutiveFails || 5;

    this._ipHistory = new Map(); // ip -> [timestamp]
    this._accountHistory = new Map(); // accountKey -> { fails: number, delayUntil: number }

    // Periodic cleanup every 5 minutes (unref so process can exit cleanly)
    this._cleanupInterval = setInterval(() => this._cleanup(), 300000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
    this._cleanupTimer = this._cleanupInterval;
  }

  /**
   * Check IP rate limit
   * @param {string} ip
   * @returns {{ allowed: boolean, retryAfterSec?: number, reason?: string }}
   */
  checkIpLimit(ip) {
    if (!ip) return { allowed: true };

    const now = Date.now();
    const timestamps = this._ipHistory.get(ip) || [];
    const windowStart = now - this._ipWindowMs;

    // Filter to current window
    const recent = timestamps.filter(t => t > windowStart);
    recent.push(now);
    this._ipHistory.set(ip, recent);

    if (recent.length > this._ipLimit) {
      const oldestInWindow = recent[0];
      const retryAfterSec = Math.ceil((oldestInWindow + this._ipWindowMs - now) / 1000);
      return {
        allowed: false,
        reason: 'IP_RATE_LIMIT_EXCEEDED',
        retryAfterSec: Math.max(1, retryAfterSec)
      };
    }

    return { allowed: true };
  }

  /**
   * Check account progressive delay status
   * @param {string} accountIdentifier (email/username)
   * @returns {{ allowed: boolean, delaySec?: number }}
   */
  checkAccountDelay(accountIdentifier) {
    if (!accountIdentifier) return { allowed: true };
    const key = String(accountIdentifier).toLowerCase().trim();
    const entry = this._accountHistory.get(key);

    if (!entry) return { allowed: true };

    const now = Date.now();
    if (entry.delayUntil && now < entry.delayUntil) {
      const delaySec = Math.ceil((entry.delayUntil - now) / 1000);
      return {
        allowed: false,
        delaySec: Math.max(1, delaySec)
      };
    }

    return { allowed: true };
  }

  checkAccountBackoff(accountIdentifier) {
    return this.checkAccountDelay(accountIdentifier);
  }

  /**
   * Record a failed login attempt for an account
   * @param {string} accountIdentifier
   */
  recordFailedAttempt(accountIdentifier) {
    if (!accountIdentifier) return;
    const key = String(accountIdentifier).toLowerCase().trim();
    const now = Date.now();
    const entry = this._accountHistory.get(key) || { fails: 0, delayUntil: 0 };

    entry.fails += 1;

    // After 5 consecutive failures, enforce progressive exponential delays: 1s, 2s, 4s, 8s, up to 60s max
    if (entry.fails >= this._accountMaxFails) {
      const exponent = entry.fails - this._accountMaxFails;
      const delayMs = Math.min(Math.pow(2, exponent) * 1000, 60000);
      entry.delayUntil = now + delayMs;
    }

    this._accountHistory.set(key, entry);
  }

  recordLoginFailure(accountIdentifier) {
    this.recordFailedAttempt(accountIdentifier);
  }

  /**
   * Record a successful login for an account (resets failed attempt counter)
   * @param {string} accountIdentifier
   */
  recordSuccessfulAttempt(accountIdentifier) {
    if (!accountIdentifier) return;
    const key = String(accountIdentifier).toLowerCase().trim();
    this._accountHistory.delete(key);
  }

  recordLoginSuccess(accountIdentifier) {
    this.recordSuccessfulAttempt(accountIdentifier);
  }

  /**
   * Internal garbage collector for stale IP and account entries
   */
  _cleanup() {
    const now = Date.now();
    const windowStart = now - this._ipWindowMs;

    for (const [ip, timestamps] of this._ipHistory.entries()) {
      const filtered = timestamps.filter(t => t > windowStart);
      if (filtered.length === 0) {
        this._ipHistory.delete(ip);
      } else {
        this._ipHistory.set(ip, filtered);
      }
    }

    for (const [key, entry] of this._accountHistory.entries()) {
      if (!entry.delayUntil || now > (entry.delayUntil + 3600000)) {
        this._accountHistory.delete(key);
      }
    }
  }

  /**
   * Reset all state (useful for tests)
   */
  reset() {
    this._ipHistory.clear();
    this._accountHistory.clear();
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
      this._cleanupTimer = null;
    }
  }
}

module.exports = {
  AuthRateLimiter
};
