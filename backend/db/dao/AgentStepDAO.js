class AgentStepDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM agent_steps WHERE id = ?').get(id) || null;
  }

  create(data) {
    const { id, runId, sequence, stepType, status = 'PENDING', input = null } = data;
    this.db.prepare(`
      INSERT INTO agent_steps (id, run_id, sequence, step_type, status, input)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, runId, sequence, stepType, status, input ? JSON.stringify(input) : null);
    return this.getById(id);
  }

  update(id, updates) {
    const fields = [];
    const params = [];
    
    if (updates.status !== undefined) {
      fields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.output !== undefined) {
      fields.push('output = ?');
      params.push(updates.output ? (typeof updates.output === 'string' ? updates.output : JSON.stringify(updates.output)) : null);
    }
    if (updates.errorInfo !== undefined) {
      fields.push('error_info = ?');
      params.push(updates.errorInfo ? (typeof updates.errorInfo === 'string' ? updates.errorInfo : JSON.stringify(updates.errorInfo)) : null);
    }
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?');
      params.push(updates.startedAt);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      params.push(updates.completedAt);
    }
    
    if (fields.length === 0) return this.getById(id);
    
    params.push(id);
    this.db.prepare(`UPDATE agent_steps SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  listByRun(runId) {
    return this.db.prepare('SELECT * FROM agent_steps WHERE run_id = ? ORDER BY sequence ASC').all(runId);
  }
}

module.exports = AgentStepDAO;
