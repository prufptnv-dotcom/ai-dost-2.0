class ContextEdgeDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id, projectId = null) {
    if (!id) return null;
    if (projectId) {
      return this.db.prepare('SELECT * FROM context_edges WHERE id = ? AND project_id = ?').get(id, projectId) || null;
    }
    return this.db.prepare('SELECT * FROM context_edges WHERE id = ?').get(id) || null;
  }

  create({ id, projectId, sourceNodeId, targetNodeId, relationType, weight = 1.0 }) {
    if (!id || !projectId || !sourceNodeId || !targetNodeId || !relationType) {
      throw new Error('ContextEdge id, projectId, sourceNodeId, targetNodeId, and relationType are required');
    }
    this.db.prepare(`
      INSERT INTO context_edges (id, project_id, source_node_id, target_node_id, relation_type, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, projectId, sourceNodeId, targetNodeId, relationType, weight);

    return this.getById(id, projectId);
  }

  listByProject(projectId) {
    if (!projectId) return [];
    return this.db.prepare('SELECT * FROM context_edges WHERE project_id = ? ORDER BY created_at ASC').all(projectId);
  }

  listByNode(nodeId, projectId = null) {
    if (!nodeId) return [];
    let sql = 'SELECT * FROM context_edges WHERE (source_node_id = ? OR target_node_id = ?)';
    const params = [nodeId, nodeId];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    return this.db.prepare(sql).all(...params);
  }

  delete(id, projectId = null) {
    if (!id) return false;
    let sql = 'DELETE FROM context_edges WHERE id = ?';
    const params = [id];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    const res = this.db.prepare(sql).run(...params);
    return res.changes > 0;
  }
}

module.exports = ContextEdgeDAO;
