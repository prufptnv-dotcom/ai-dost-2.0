'use strict';

/**
 * AI-Dost 2.0 — Phase 5B: DistributedRateLimiter
 * 
 * Distributed rate limiting backed by Redis with atomic window expiration.
 * Implements native RESP protocol (zero npm dependencies) over node:net,
 * multi-tier buckets, and strict AuthAvailabilityPolicy integration.
 */

const net = require('net');
const { AuthAvailabilityPolicy, POLICY_MODES } = require('./AuthAvailabilityPolicy');

/**
 * Minimalist native RESP (REdis Serialization Protocol) client over node:net
 */
class NativeRespClient {
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 6379;
    this.timeoutMs = options.timeoutMs || 2000;
    this.socket = null;
    this.connected = false;
    this._queue = [];
    this._buffer = '';
  }

  async connect() {
    if (this.connected && this.socket && !this.socket.destroyed) return;

    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      sock.setTimeout(this.timeoutMs);

      sock.once('connect', () => {
        this.socket = sock;
        this.connected = true;
        resolve();
      });

      sock.once('error', (err) => {
        this.connected = false;
        reject(err);
      });

      sock.once('timeout', () => {
        this.connected = false;
        sock.destroy();
        reject(new Error('Redis connection timeout'));
      });

      sock.on('data', (chunk) => {
        this._buffer += chunk.toString();
        this._processBuffer();
      });

      sock.on('close', () => {
        this.connected = false;
      });
    });
  }

  _processBuffer() {
    while (this._buffer.length > 0 && this._queue.length > 0) {
      const firstChar = this._buffer[0];
      const newlineIdx = this._buffer.indexOf('\r\n');
      if (newlineIdx === -1) break;

      const current = this._queue[0];

      if (firstChar === '+') { // Simple string
        const val = this._buffer.substring(1, newlineIdx);
        this._buffer = this._buffer.substring(newlineIdx + 2);
        this._queue.shift();
        current.resolve(val);
      } else if (firstChar === ':') { // Integer
        const val = parseInt(this._buffer.substring(1, newlineIdx), 10);
        this._buffer = this._buffer.substring(newlineIdx + 2);
        this._queue.shift();
        current.resolve(val);
      } else if (firstChar === '-') { // Error
        const err = this._buffer.substring(1, newlineIdx);
        this._buffer = this._buffer.substring(newlineIdx + 2);
        this._queue.shift();
        current.reject(new Error(err));
      } else if (firstChar === '$') { // Bulk string
        const len = parseInt(this._buffer.substring(1, newlineIdx), 10);
        if (len === -1) {
          this._buffer = this._buffer.substring(newlineIdx + 2);
          this._queue.shift();
          current.resolve(null);
        } else {
          const totalExpected = newlineIdx + 2 + len + 2;
          if (this._buffer.length < totalExpected) break;
          const val = this._buffer.substring(newlineIdx + 2, newlineIdx + 2 + len);
          this._buffer = this._buffer.substring(totalExpected);
          this._queue.shift();
          current.resolve(val);
        }
      } else {
        // Unknown protocol frame
        this._buffer = '';
        const pending = this._queue.shift();
        if (pending) pending.reject(new Error('RESP parse error'));
      }
    }
  }

  static formatCommand(args) {
    let cmd = `*${args.length}\r\n`;
    for (const arg of args) {
      const str = String(arg);
      cmd += `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
    }
    return cmd;
  }

  async sendCommand(args) {
    await this.connect();

    return new Promise((resolve, reject) => {
      this._queue.push({ resolve, reject });

      const cmd = NativeRespClient.formatCommand(args);

      this.socket.write(cmd, (err) => {
        if (err) {
          this.connected = false;
          reject(err);
        }
      });
    });
  }

  async ping() {
    return this.sendCommand(['PING']);
  }

  async incr(key) {
    return this.sendCommand(['INCR', key]);
  }

  async expire(key, seconds) {
    return this.sendCommand(['EXPIRE', key, seconds]);
  }

  async get(key) {
    return this.sendCommand(['GET', key]);
  }

  async del(key) {
    return this.sendCommand(['DEL', key]);
  }

  close() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this._queue.forEach(q => q.reject(new Error('Client closed')));
    this._queue = [];
    this._buffer = '';
  }
}

const DEFAULT_BUCKETS = {
  login: { limit: 5, windowSec: 60 },
  register: { limit: 3, windowSec: 60 },
  refresh: { limit: 20, windowSec: 60 },
  password_verify: { limit: 10, windowSec: 60 },
  csrf_failure: { limit: 3, windowSec: 60 },
  general_api: { limit: 60, windowSec: 60 }
};

class DistributedRateLimiter {
  /**
   * @param {Object} [options]
   * @param {string} [options.redisHost]
   * @param {number} [options.redisPort]
   * @param {Object} [options.redisClient]
   * @param {Object} [options.buckets]
   * @param {AuthAvailabilityPolicy} [options.policy]
   */
  constructor(options = {}) {
    this.redisHost = options.redisHost || process.env.REDIS_HOST || '127.0.0.1';
    this.redisPort = parseInt(options.redisPort || process.env.REDIS_PORT || '6379', 10);
    this.client = options.redisClient || new NativeRespClient({ host: this.redisHost, port: this.redisPort });
    this.buckets = { ...DEFAULT_BUCKETS, ...(options.buckets || {}) };
    this.policy = options.policy || new AuthAvailabilityPolicy();
    this.localFallbackMap = new Map(); // key -> { count, resetAt }
    this.isRedisAvailable = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      if (typeof this.client.ping === 'function') {
        const reply = await this.client.ping();
        this.isRedisAvailable = (reply === 'PONG');
      } else {
        this.isRedisAvailable = true;
      }
    } catch {
      this.isRedisAvailable = false;
    }
    this.initialized = true;
  }

  /**
   * Check rate limit for a key in a given bucket.
   * @param {string} bucketName 
   * @param {string} identifier IP or accountId or userId
   * @param {Object} [overrides]
   * @returns {Promise<{ allowed: boolean, remaining: number, resetSec: number, total: number, degraded?: boolean, reason?: string }>}
   */
  async checkLimit(bucketName, identifier, overrides = {}) {
    await this.init();

    const config = { ...(this.buckets[bucketName] || DEFAULT_BUCKETS.general_api), ...overrides };
    const maxLimit = config.limit;
    const windowSec = config.windowSec;
    const redisKey = `ratelimit:${bucketName}:${identifier}`;

    if (this.isRedisAvailable) {
      try {
        // Atomic INCR
        const currentCount = await this.client.incr(redisKey);
        if (currentCount === 1) {
          // Set TTL on initial counter creation
          await this.client.expire(redisKey, windowSec);
        }

        const allowed = currentCount <= maxLimit;
        const remaining = Math.max(0, maxLimit - currentCount);

        return {
          allowed,
          remaining,
          resetSec: windowSec,
          total: maxLimit,
          current: currentCount,
          degraded: false
        };
      } catch (redisErr) {
        // Mark Redis offline and delegate to policy
        this.isRedisAvailable = false;
        return this._handleOutage(bucketName, identifier, maxLimit, windowSec, redisErr);
      }
    }

    // Redis offline path
    return this._handleOutage(bucketName, identifier, maxLimit, windowSec, new Error('Redis not connected'));
  }

  _handleOutage(bucketName, identifier, maxLimit, windowSec, error) {
    const endpointKey = `/api/auth/${bucketName}`;
    const policyResult = this.policy.handleOutage('redis', endpointKey, error);

    if (policyResult.action === 'BLOCK') {
      return {
        allowed: false,
        remaining: 0,
        resetSec: windowSec,
        total: maxLimit,
        error: policyResult.error,
        reason: policyResult.reason,
        degraded: false,
        blockedByPolicy: true
      };
    }

    // FAIL_SECURE_DEGRADED: Local in-memory sliding window fallback with conservative (half) limit
    const degradedLimit = Math.max(1, Math.floor(maxLimit / 2));
    const now = Date.now();
    const localKey = `${bucketName}:${identifier}`;
    let item = this.localFallbackMap.get(localKey);

    if (!item || now > item.resetAt) {
      item = { count: 0, resetAt: now + windowSec * 1000 };
    }

    item.count += 1;
    this.localFallbackMap.set(localKey, item);

    const allowed = item.count <= degradedLimit;
    const remaining = Math.max(0, degradedLimit - item.count);
    const resetSec = Math.max(1, Math.ceil((item.resetAt - now) / 1000));

    return {
      allowed,
      remaining,
      resetSec,
      total: degradedLimit,
      current: item.count,
      degraded: true,
      reason: policyResult.reason
    };
  }

  async reset(bucketName, identifier) {
    const redisKey = `ratelimit:${bucketName}:${identifier}`;
    if (this.isRedisAvailable) {
      try {
        await this.client.del(redisKey);
      } catch (_) {}
    }
    this.localFallbackMap.delete(`${bucketName}:${identifier}`);
  }

  async close() {
    if (this.client && typeof this.client.close === 'function') {
      this.client.close();
    }
    this.localFallbackMap.clear();
    this.isRedisAvailable = false;
    this.initialized = false;
  }
}

module.exports = {
  DistributedRateLimiter,
  NativeRespClient,
  DEFAULT_BUCKETS
};
