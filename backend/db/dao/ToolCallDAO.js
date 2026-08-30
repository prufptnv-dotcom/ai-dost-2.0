class ToolCallDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) || null;
  }

  create(data) {
    const { id, stepId, toolName, input = null, status = 'PENDING' } = data;
    this.db.prepare(`
      INSERT INTO tool_calls (id, step_id, tool_name, input, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, stepId, toolName, input ? (typeof input === 'string' ? input : JSON.stringify(input)) : null, status);
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
    if (updates.timingMeta !== undefined) {
      fields.push('timing_meta = ?');
      params.push(updates.timingMeta ? (typeof updates.timingMeta === 'string' ? updates.timingMeta : JSON.stringify(updates.timingMeta)) : null);
    }
    
    if (fields.length === 0) return this.getById(id);
    
    params.push(id);
    this.db.prepare(`UPDATE tool_calls SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  listByStep(stepId) {
    return this.db.prepare('SELECT * FROM tool_calls WHERE step_id = ?').all(stepId);
  }
}

module.exports = ToolCallDAO;
