'use strict';

/**
 * Small process-local idempotency registry for autonomous task requests.
 * It prevents duplicate execution when the client retries the same taskId.
 *
 * This is intentionally bounded and TTL-based. Durable cross-process recovery
 * remains a separate persistence concern; callers should persist terminal task
 * state through their normal task/run storage.
 */
class TaskIdempotencyStore {
  constructor({ ttlMs = 10 * 60 * 1000, maxEntries = 2000 } = {}) {
    this.ttlMs = Math.max(1000, Number(ttlMs) || 10 * 60 * 1000);
    this.maxEntries = Math.max(10, Number(maxEntries) || 2000);
    this.entries = new Map();
  }

  _key({ taskId, projectId, userId }) {
    return [String(userId || ''), String(projectId || ''), String(taskId || '')].join('::');
  }

  _prune(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  begin(identity) {
    if (!identity?.taskId) return { state: 'untracked' };
    const now = Date.now();
    this._prune(now);
    const key = this._key(identity);
    const existing = this.entries.get(key);
    if (existing && existing.expiresAt > now) {
      return { state: existing.state, entry: existing };
    }

    const entry = {
      key,
      taskId: String(identity.taskId),
      projectId: String(identity.projectId || ''),
      userId: String(identity.userId || ''),
      state: 'running',
      startedAt: now,
      updatedAt: now,
      expiresAt: now + this.ttlMs,
      events: [],
      result: null,
      error: null,
    };
    this.entries.set(key, entry);
    return { state: 'started', entry };
  }

  recordEvent(identity, event) {
    const entry = this._get(identity);
    if (!entry) return false;
    entry.updatedAt = Date.now();
    entry.events.push(event);
    if (entry.events.length > 100) entry.events.splice(0, entry.events.length - 100);
    return true;
  }

  complete(identity, result) {
    const entry = this._get(identity);
    if (!entry) return false;
    entry.state = result?.status === 'CANCELLED' ? 'canceled' : 'completed';
    entry.updatedAt = Date.now();
    entry.result = result || null;
    return true;
  }

  fail(identity, error) {
    const entry = this._get(identity);
    if (!entry) return false;
    entry.state = 'failed';
    entry.updatedAt = Date.now();
    entry.error = error ? String(error.message || error) : 'Task failed';
    return true;
  }

  get(identity) {
    const entry = this._get(identity);
    if (!entry) return null;
    return {
      taskId: entry.taskId,
      projectId: entry.projectId,
      userId: entry.userId,
      state: entry.state,
      startedAt: entry.startedAt,
      updatedAt: entry.updatedAt,
      events: entry.events.slice(),
      result: entry.result,
      error: entry.error,
    };
  }

  clear(identity) {
    if (!identity?.taskId) return false;
    return this.entries.delete(this._key(identity));
  }

  _get(identity) {
    if (!identity?.taskId) return null;
    const now = Date.now();
    this._prune(now);
    const entry = this.entries.get(this._key(identity));
    return entry && entry.expiresAt > now ? entry : null;
  }
}

module.exports = TaskIdempotencyStore;
