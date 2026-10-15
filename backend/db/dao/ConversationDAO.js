class ConversationDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id, projectId = null) {
    if (!id) return null;
    if (projectId) {
      return this.db.prepare('SELECT * FROM conversations WHERE id = ? AND project_id = ?').get(id, projectId) || null;
    }
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) || null;
  }

  create({ id, projectId, userId = 'local-user', title, surface = 'chat' }) {
    if (!id || !projectId || !title) throw new Error('Conversation id, projectId, and title are required');
    this.db.prepare(`
      INSERT INTO conversations (id, project_id, user_id, title, surface, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, projectId, userId, title, surface);
    return this.getById(id, projectId);
  }

  upsert({ id, projectId, userId = 'local-user', title, surface = 'chat' }) {
    if (!id || !projectId) throw new Error('Conversation id and projectId are required');
    const existing = this.getById(id, projectId);
    if (existing) {
      this.db.prepare(`
        UPDATE conversations SET title = ?, surface = ?, updated_at = datetime('now')
        WHERE id = ? AND project_id = ?
      `).run(title || existing.title, surface || existing.surface, id, projectId);
      return this.getById(id, projectId);
    }
    return this.create({ id, projectId, userId, title: title || 'New Conversation', surface });
  }

  listByProject(projectId) {
    if (!projectId) return [];
    return this.db.prepare('SELECT * FROM conversations WHERE project_id = ? ORDER BY updated_at DESC').all(projectId);
  }

  delete(id, projectId = null) {
    if (!id) return false;
    let sql = 'DELETE FROM conversations WHERE id = ?';
    const params = [id];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    const res = this.db.prepare(sql).run(...params);
    return res.changes > 0;
  }
}

module.exports = ConversationDAO;
