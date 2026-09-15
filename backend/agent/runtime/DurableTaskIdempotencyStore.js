'use strict';

/**
 * SQLite-backed task idempotency store.
 *
 * The unique composite key makes begin() race-safe across concurrent requests
 * in this process and across application restarts using the same database.
 */
class DurableTaskIdempotencyStore {
  constructor(db, { ttlMs = 10 * 60 * 1000, maxEvents = 100 } = {}) {
    if (!db || typeof db.prepare !== 'function' || typeof db.exec !== 'function') {
      throw new Error('DurableTaskIdempotencyStore requires a SQLite database');
    }
    this.db = db;
    this.ttlMs = Math.max(1000, Number(ttlMs) || 10 * 60 * 1000);
    this.maxEvents = Math.max(10, Number(maxEvents) || 100);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_task_idempotency (
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        state TEXT NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        events_json TEXT NOT NULL DEFAULT '[]',
        result_json TEXT,
        error_text TEXT,
        PRIMARY KEY (user_id, project_id, task_id)
      )
    `);
  }

  _key(identity) {
    return {
      userId: String(identity?.userId || ''),
      projectId: String(identity?.projectId || ''),
      taskId: String(identity?.taskId || ''),
    };
  }

  _prune(now = Date.now()) {
    this.db.prepare('DELETE FROM agent_task_idempotency WHERE expires_at <= ?').run(now);
  }

  _rowToEntry(row) {
    if (!row) return null;
    let events = [];
    try { events = JSON.parse(row.events_json || '[]'); } catch (_) {}
    let result = null;
    try { result = row.result_json ? JSON.parse(row.result_json) : null; } catch (_) {}
    return {
      taskId: row.task_id,
      projectId: row.project_id,
      userId: row.user_id,
      state: row.state,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
      events: Array.isArray(events) ? events : [],
      result,
      error: row.error_text || null,
    };
  }

  _find(identity) {
    const { userId, projectId, taskId } = this._key(identity);
    return this.db.prepare(`
      SELECT user_id, project_id, task_id, state, started_at, updated_at,
             expires_at, events_json, result_json, error_text
      FROM agent_task_idempotency
      WHERE user_id = ? AND project_id = ? AND task_id = ?
    `).get(userId, projectId, taskId) || null;
  }

  begin(identity) {
    if (!identity?.taskId) return { state: 'untracked' };
    const now = Date.now();
    this._prune(now);
    const { userId, projectId, taskId } = this._key(identity);
    const existing = this._find(identity);
    if (existing) return { state: existing.state, entry: this._rowToEntry(existing) };

    const startedAt = new Date(now).toISOString();
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO agent_task_idempotency
        (user_id, project_id, task_id, state, started_at, updated_at, expires_at)
      VALUES (?, ?, ?, 'running', ?, ?, ?)
    `).run(userId, projectId, taskId, startedAt, startedAt, now + this.ttlMs);

    const row = this._find(identity);
    return {
      state: result?.changes === 1 ? 'started' : (row?.state || 'running'),
      entry: this._rowToEntry(row),
    };
  }

  recordEvent(identity, event) {
    const row = this._find(identity);
    if (!row) return false;
    const entry = this._rowToEntry(row);
    entry.events.push(event);
    if (entry.events.length > this.maxEvents) {
      entry.events.splice(0, entry.events.length - this.maxEvents);
    }
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE agent_task_idempotency
      SET events_json = ?, updated_at = ?
      WHERE user_id = ? AND project_id = ? AND task_id = ?
    `).run(JSON.stringify(entry.events), now, entry.userId, entry.projectId, entry.taskId);
    return true;
  }

  complete(identity, result) {
    const row = this._find(identity);
    if (!row) return false;
    const state = result?.status === 'CANCELLED' ? 'canceled' : 'completed';
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE agent_task_idempotency
      SET state = ?, result_json = ?, updated_at = ?
      WHERE user_id = ? AND project_id = ? AND task_id = ?
    `).run(state, JSON.stringify(result || null), now, row.user_id, row.project_id, row.task_id);
    return true;
  }

  fail(identity, error) {
    const row = this._find(identity);
    if (!row) return false;
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE agent_task_idempotency
      SET state = 'failed', error_text = ?, updated_at = ?
      WHERE user_id = ? AND project_id = ? AND task_id = ?
    `).run(String(error?.message || error || 'Task failed'), now, row.user_id, row.project_id, row.task_id);
    return true;
  }

  get(identity) {
    return this._rowToEntry(this._find(identity));
  }

  clear(identity) {
    if (!identity?.taskId) return false;
    const { userId, projectId, taskId } = this._key(identity);
    const result = this.db.prepare(`
      DELETE FROM agent_task_idempotency
      WHERE user_id = ? AND project_id = ? AND task_id = ?
    `).run(userId, projectId, taskId);
    return result.changes > 0;
  }
}

module.exports = DurableTaskIdempotencyStore;
