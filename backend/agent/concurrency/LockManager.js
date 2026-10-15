// backend/agent/concurrency/LockManager.js
// Per‑file async mutex with FIFO queue, configurable timeout, owner token tracking.

class LockManager {
  constructor() {
    // Map<absPath, {queue: Array<{resolve, reject, token}>, locked: boolean, owner: string|null}>
    this.locks = new Map();
    this.defaultTimeout = parseInt(process.env.LOCK_TIMEOUT_MS, 10) || 30000;
    // Best‑effort cleanup on process exit (not relied upon for correctness)
    process.on('exit', () => this._cleanupAll());
    process.on('SIGINT', () => process.exit(0));
    process.on('SIGTERM', () => process.exit(0));
  }

  _entry(filePath) {
    if (!this.locks.has(filePath)) {
      this.locks.set(filePath, { queue: [], locked: false, owner: null });
    }
    return this.locks.get(filePath);
  }

  /**
   * Acquire exclusive lock for `filePath`.
   * Returns a promise that resolves with a token when lock is granted.
   * Rejects after `timeoutMs` (or default) with an Error.
   */
  acquire(filePath, timeoutMs) {
    const entry = this._entry(filePath);
    const timeout = typeof timeoutMs === 'number' ? timeoutMs : this.defaultTimeout;
    return new Promise((resolve, reject) => {
      const token = Symbol('lockToken');
      const grant = () => {
        entry.locked = true;
        entry.owner = token;
        resolve(token);
      };
      if (!entry.locked) {
        grant();
        return;
      }
      // enqueue
      const timer = setTimeout(() => {
        // timeout – remove from queue if still pending
        const idx = entry.queue.findIndex(item => item.token === token);
        if (idx !== -1) entry.queue.splice(idx, 1);
        reject(new Error(`Lock timeout after ${timeout}ms for ${filePath}`));
      }, timeout);
      // wrap resolve to clear timer when granted
      const wrappedGrant = () => {
        clearTimeout(timer);
        grant();
      };
      entry.queue.push({ resolve: wrappedGrant, reject, token });
    });
  }

  /**
   * Release lock for `filePath`.
   * `ownerToken` must match the token returned by `acquire`.
   * If token mismatch, release is ignored to avoid breaking other waiters.
   */
  release(filePath, ownerToken) {
    const entry = this.locks.get(filePath);
    if (!entry) return; // nothing to release
    if (entry.owner !== ownerToken) {
      // ignore mismatched release – defensive programming
      return;
    }
    entry.locked = false;
    entry.owner = null;
    if (entry.queue.length > 0) {
      const next = entry.queue.shift();
      // grant to next waiter (its timer already cleared)
      next.resolve();
    } else {
      this.locks.delete(filePath);
    }
  }

  _cleanupAll() {
    for (const [pathKey, entry] of this.locks.entries()) {
      entry.locked = false;
      entry.owner = null;
      entry.queue = [];
    }
    this.locks.clear();
  }
}

module.exports = new LockManager();
