class AgentRunDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(id) || null;
  }

  create(data) {
    const { id, taskId, status = 'PENDING', attempt = 1, metadata = null } = data;
    this.db.prepare(`
      INSERT INTO agent_runs (id, task_id, status, attempt, runtime_metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, taskId, status, attempt, metadata ? JSON.stringify(metadata) : null);
    return this.getById(id);
  }

  updateStatus(id, status, errorInfo = null, startedAt = null, completedAt = null) {
    const updates = ['status = ?'];
    const params = [status];
    if (errorInfo) {
      updates.push('error_info = ?');
      params.push(typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo));
    }
    if (startedAt) {
      updates.push('started_at = ?');
      params.push(startedAt);
    }
    if (completedAt) {
      updates.push('completed_at = ?');
      params.push(completedAt);
    }
    params.push(id);
    this.db.prepare(`UPDATE agent_runs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  updateMetadata(id, metadata) {
    this.db.prepare('UPDATE agent_runs SET runtime_metadata = ? WHERE id = ?').run(
      metadata ? JSON.stringify(metadata) : null,
      id
    );
    return this.getById(id);
  }

  listByTask(taskId) {
    return this.db.prepare('SELECT * FROM agent_runs WHERE task_id = ? ORDER BY attempt DESC').all(taskId);
  }

  countByTask(taskId) {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM agent_runs WHERE task_id = ?').get(taskId);
    return row ? row.count : 0;
  }

  countActiveByProject(projectId) {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM agent_runs r
      JOIN agent_tasks t ON r.task_id = t.id
      WHERE t.project_id = ? AND r.status IN ('PENDING', 'RUNNING', 'WAITING', 'VERIFYING')
    `).get(projectId);
    return row ? row.count : 0;
  }
}

module.exports = AgentRunDAO;
