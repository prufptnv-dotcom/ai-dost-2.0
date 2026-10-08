/**
 * CopilotRunDAO — durable run header + ordered event log (P9 background runs).
 *
 * Tables: copilot_runs / copilot_run_events (copilot_* namespace — NOT
 * agent_runs, which migration 002 and db/dao/AgentRunDAO.js already own with
 * a different schema; that name collision was caught by the migration itself
 * exploding on a project_id index that didn't exist there).
 *
 * `copilot_runs` is the truth about a run's lifecycle; `copilot_run_events`
 * is the full SSE stream in SQLite order (seq starts at 1, dense). All
 * synchronous (node:sqlite DatabaseSync) — /api/agent/run events are
 * one-at-a-time so the writes never race within a request.
 */
class CopilotRunDAO {
  constructor(db) {
    this.db = db;
  }

  createRun({ runId, projectId = null, prompt = '', background = false }) {
    this.db
      .prepare(
        'INSERT OR IGNORE INTO copilot_runs (run_id, project_id, prompt, status, background) VALUES (?, ?, ?, ?, ?)'
      )
      .run(String(runId).slice(0, 160), projectId ? String(projectId).slice(0, 120) : null, String(prompt).slice(0, 4000), 'running', background ? 1 : 0);
  }

  /** Append one event; returns its 1-based seq (0 = unknown run, never throws). */
  appendEvent(runId, payload) {
    const row = this.db.prepare('SELECT seq FROM copilot_runs WHERE run_id = ?').get(runId);
    if (!row) return 0; // run unknown — never throw inside send()
    const seq = (row.seq || 0) + 1;
    this.db
      .prepare('INSERT INTO copilot_run_events (run_id, seq, payload) VALUES (?, ?, ?)')
      .run(runId, seq, typeof payload === 'string' ? payload : JSON.stringify(payload));
    this.db.prepare('UPDATE copilot_runs SET seq = ? WHERE run_id = ?').run(seq, runId);
    return seq;
  }

  /** Terminal transition — first finish wins (idempotent under double-done). */
  finishRun(runId, status, finalMessage = null) {
    const res = this.db
      .prepare(
        "UPDATE copilot_runs SET status = ?, finished_at = datetime('now'), final_message = ? WHERE run_id = ? AND status = 'running'"
      )
      .run(String(status || 'done').slice(0, 32), finalMessage ? String(finalMessage).slice(0, 4000) : null, runId);
    return (res.changes || 0) > 0;
  }

  getRun(runId) {
    return this.db.prepare('SELECT * FROM copilot_runs WHERE run_id = ?').get(runId) || null;
  }

  /** Events after `afterSeq`, oldest first — the replay feed. */
  listEvents(runId, afterSeq = 0, limit = 5000) {
    return this.db
      .prepare('SELECT seq, payload, created_at FROM copilot_run_events WHERE run_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
      .all(runId, Math.max(0, Math.floor(afterSeq)), Math.min(Math.max(1, Math.floor(limit)), 20000));
  }

  listRuns({ projectId = null, status = null, limit = 30 } = {}) {
    let rows;
    if (projectId) {
      rows = this.db
        .prepare('SELECT * FROM copilot_runs WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 200')
        .all(projectId);
    } else {
      rows = this.db.prepare('SELECT * FROM copilot_runs ORDER BY started_at DESC, rowid DESC LIMIT 200').all(limit);
    }
    if (status) rows = rows.filter(r => r.status === status);
    return rows.slice(0, Math.min(Math.max(1, limit), 200));
  }

  /**
   * Server restart = every in-process run died with it. Mark them honestly
   * instead of leaving 'running' rows that would hang a reattach forever.
   */
  markInterrupted() {
    const res = this.db
      .prepare(
        "UPDATE copilot_runs SET status = 'interrupted', finished_at = datetime('now'), final_message = COALESCE(final_message, 'server restarted mid-run') WHERE status = 'running'"
      )
      .run();
    return res.changes || 0;
  }
}

module.exports = CopilotRunDAO;
