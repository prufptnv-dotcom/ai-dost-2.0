const crypto = require('crypto');

class WorkflowRunDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id || typeof id !== 'string') return null;
    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id);
    return row ? this._formatRow(row) : null;
  }

  createRun({ workflowId, startedAt = new Date().toISOString(), outputSummary = 'Running action...' }) {
    if (!workflowId) throw new Error('workflowId is required');
    const id = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    this.db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, status, started_at, output_summary)
      VALUES (?, ?, 'running', ?, ?)
    `).run(id, workflowId, startedAt, outputSummary);

    return this.getById(id);
  }

  completeRun(id, { durationMs = 0, outputSummary = 'Action completed successfully', outputData = {} } = {}) {
    if (!id) throw new Error('Run id is required');
    const finishedAt = new Date().toISOString();
    const outputDataStr = typeof outputData === 'string' ? outputData : JSON.stringify(outputData);

    this.db.prepare(`
      UPDATE workflow_runs
      SET status = 'success', finished_at = ?, duration_ms = ?, output_summary = ?, output_data = ?
      WHERE id = ?
    `).run(finishedAt, durationMs, outputSummary, outputDataStr, id);

    return this.getById(id);
  }

  failRun(id, { durationMs = 0, errorMessage = 'Action execution failed' } = {}) {
    if (!id) throw new Error('Run id is required');
    const finishedAt = new Date().toISOString();

    this.db.prepare(`
      UPDATE workflow_runs
      SET status = 'failed', finished_at = ?, duration_ms = ?, output_summary = ?, error_message = ?
      WHERE id = ?
    `).run(finishedAt, durationMs, 'Failed: ' + errorMessage, errorMessage, id);

    return this.getById(id);
  }

  listByWorkflow(workflowId, limit = 25) {
    if (!workflowId) return [];
    const rows = this.db.prepare(`
      SELECT * FROM workflow_runs
      WHERE workflow_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(workflowId, limit);
    return rows.map((r) => this._formatRow(r));
  }

  getRecentRuns(limit = 25) {
    const rows = this.db.prepare(`
      SELECT r.*, w.name as workflow_name, w.action_type
      FROM workflow_runs r
      LEFT JOIN workflows w ON r.workflow_id = w.id
      ORDER BY r.started_at DESC
      LIMIT ?
    `).all(limit);
    return rows.map((r) => this._formatRow(r));
  }

  _formatRow(row) {
    if (!row) return null;
    return {
      ...row,
      output_data: this._parseJson(row.output_data),
    };
  }

  _parseJson(val, fallback = null) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch (_) {
      return fallback;
    }
  }
}

module.exports = WorkflowRunDAO;
