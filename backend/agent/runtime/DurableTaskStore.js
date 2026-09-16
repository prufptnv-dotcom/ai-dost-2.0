'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Crash-safe, bounded task state journal.
 *
 * This store deliberately persists only task metadata, checkpoints and
 * sanitized events. It never persists secrets, tool inputs or tool outputs.
 * Running tasks are converted to RECOVERY_REQUIRED on startup so side-effect
 * work is never silently executed twice after a process crash.
 */
class DurableTaskStore {
  constructor({ filePath, maxEntries = 5000, staleAfterMs = 15 * 60 * 1000 } = {}) {
    this.filePath = filePath || process.env.AGENT_TASK_STATE_FILE || path.join(process.cwd(), '.data', 'agent-task-state.json');
    this.maxEntries = Math.max(100, Number(maxEntries) || 5000);
    this.staleAfterMs = Math.max(1000, Number(staleAfterMs) || 15 * 60 * 1000);
    this.entries = new Map();
    this._load();
    this.markInterruptedTasks();
  }

  _key({ taskId, projectId, userId }) {
    return [String(userId || ''), String(projectId || ''), String(taskId || '')].join('::');
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      for (const entry of Array.isArray(parsed) ? parsed : []) {
        if (entry?.key && entry.taskId) this.entries.set(entry.key, entry);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('[DurableTaskStore] state load failed:', error.message);
    }
  }

  _persist() {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify([...this.entries.values()].slice(-this.maxEntries), null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.filePath);
  }

  _entry(identity) {
    if (!identity?.taskId) return null;
    return this.entries.get(this._key(identity)) || null;
  }

  begin(identity, metadata = {}) {
    if (!identity?.taskId) return { state: 'untracked' };
    const key = this._key(identity);
    const existing = this.entries.get(key);
    if (existing) return { state: existing.status, entry: existing };

    const now = Date.now();
    const entry = {
      key,
      taskId: String(identity.taskId),
      projectId: String(identity.projectId || ''),
      userId: String(identity.userId || ''),
      runId: metadata.runId || null,
      status: 'RUNNING',
      currentPhase: 'planning',
      currentStepId: null,
      currentToolCallId: null,
      attempt: 0,
      startedAt: now,
      updatedAt: now,
      lastHeartbeatAt: now,
      errorCode: null,
      errorMessage: null,
      checkpoint: null,
      events: [],
    };
    this.entries.set(key, entry);
    this._persist();
    return { state: 'started', entry };
  }

  update(identity, patch = {}) {
    const entry = this._entry(identity);
    if (!entry) return false;
    Object.assign(entry, patch, { updatedAt: Date.now(), lastHeartbeatAt: Date.now() });
    this._persist();
    return true;
  }

  checkpoint(identity, checkpoint = {}) {
    return this.update(identity, { checkpoint: this._sanitize(checkpoint) });
  }

  event(identity, event) {
    const entry = this._entry(identity);
    if (!entry) return false;
    entry.events = Array.isArray(entry.events) ? entry.events : [];
    entry.events.push(this._sanitize(event));
    if (entry.events.length > 100) entry.events.splice(0, entry.events.length - 100);
    entry.updatedAt = Date.now();
    entry.lastHeartbeatAt = entry.updatedAt;
    this._persist();
    return true;
  }

  complete(identity, result) {
    const entry = this._entry(identity);
    if (!entry) return false;
    const status = String(result?.status || '').toUpperCase();
    entry.status = status === 'SUCCEEDED' ? 'SUCCEEDED' : status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    entry.errorCode = entry.status === 'FAILED' ? String(result?.errorCode || 'TASK_FAILED') : null;
    entry.errorMessage = entry.status === 'FAILED' ? String(result?.reason || 'Task failed') : null;
    entry.updatedAt = Date.now();
    entry.lastHeartbeatAt = entry.updatedAt;
    entry.result = this._sanitize(result);
    this._persist();
    return true;
  }

  fail(identity, error, code = 'TASK_FAILED') {
    const entry = this._entry(identity);
    if (!entry) return false;
    entry.status = 'FAILED';
    entry.errorCode = String(error?.code || code);
    entry.errorMessage = String(error?.message || error || 'Task failed');
    entry.updatedAt = Date.now();
    this._persist();
    return true;
  }

  markInterruptedTasks(now = Date.now()) {
    let changed = false;
    for (const entry of this.entries.values()) {
      if (entry.status === 'RUNNING' || entry.status === 'WAITING' || entry.status === 'VERIFYING') {
        entry.status = 'RECOVERY_REQUIRED';
        entry.errorCode = 'PROCESS_INTERRUPTED';
        entry.errorMessage = 'Task was active when the process stopped; manual recovery decision required.';
        entry.updatedAt = now;
        changed = true;
      }
    }
    if (changed) this._persist();
    return changed;
  }

  get(identity) {
    const entry = this._entry(identity);
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  }

  listRecoveryRequired() {
    return [...this.entries.values()].filter((entry) => entry.status === 'RECOVERY_REQUIRED').map((entry) => JSON.parse(JSON.stringify(entry)));
  }

  _sanitize(value) {
    if (value === undefined) return null;
    try {
      return JSON.parse(JSON.stringify(value, (key, item) => {
        if (/token|secret|password|authorization|cookie|api[-_]?key/i.test(key)) return '[REDACTED]';
        if (typeof item === 'string' && item.length > 4000) return `${item.slice(0, 4000)}…`;
        return item;
      }));
    } catch {
      return '[UNSERIALIZABLE]';
    }
  }
}

module.exports = DurableTaskStore;
