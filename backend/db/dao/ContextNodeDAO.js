class ContextNodeDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id, projectId = null) {
    if (!id) return null;
    if (projectId) {
      return this.db.prepare('SELECT * FROM context_nodes WHERE id = ? AND project_id = ?').get(id, projectId) || null;
    }
    return this.db.prepare('SELECT * FROM context_nodes WHERE id = ?').get(id) || null;
  }

  create({ id, projectId, nodeType, title, contentSummary = '', rawRef = null, embeddingId = null }) {
    if (!id || !projectId || !nodeType || !title) {
      throw new Error('ContextNode id, projectId, nodeType, and title are required');
    }
    this.db.prepare(`
      INSERT INTO context_nodes (id, project_id, node_type, title, content_summary, raw_ref, embedding_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, projectId, nodeType, title, contentSummary, rawRef, embeddingId);

    return this.getById(id, projectId);
  }

  listByProject(projectId, nodeType = null) {
    if (!projectId) return [];
    if (nodeType) {
      return this.db.prepare('SELECT * FROM context_nodes WHERE project_id = ? AND node_type = ? ORDER BY created_at DESC').all(projectId, nodeType);
    }
    return this.db.prepare('SELECT * FROM context_nodes WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  }

  delete(id, projectId = null) {
    if (!id) return false;
    let sql = 'DELETE FROM context_nodes WHERE id = ?';
    const params = [id];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    const res = this.db.prepare(sql).run(...params);
    return res.changes > 0;
  }
}

module.exports = ContextNodeDAO;
