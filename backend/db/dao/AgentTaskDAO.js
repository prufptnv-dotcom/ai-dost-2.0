class AgentTaskDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id) || null;
  }

  create(data) {
    const { id, projectId, conversationId = null, userId, title = null, status = 'PENDING' } = data;
    this.db.prepare(`
      INSERT INTO agent_tasks (id, project_id, conversation_id, user_id, title, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, conversationId, userId, title, status);
    return this.getById(id);
  }

  updateStatus(id, status, failedAt = null, completedAt = null) {
    const updates = ['status = ?, updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    if (failedAt) {
      updates.push('failed_at = ?');
      params.push(failedAt);
    }
    if (completedAt) {
      updates.push('completed_at = ?');
      params.push(completedAt);
    }
    params.push(id);
    
    this.db.prepare(`UPDATE agent_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id);
  }

  listByProject(projectId) {
    return this.db.prepare('SELECT * FROM agent_tasks WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  }
}

module.exports = AgentTaskDAO;
