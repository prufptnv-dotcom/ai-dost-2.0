class ArtifactDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id, projectId = null) {
    if (!id) return null;
    if (projectId) {
      return this.db.prepare('SELECT * FROM artifacts WHERE id = ? AND project_id = ?').get(id, projectId) || null;
    }
    return this.db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) || null;
  }

  getByPath(projectId, storagePath) {
    if (!projectId || !storagePath) return null;
    return this.db.prepare('SELECT * FROM artifacts WHERE project_id = ? AND storage_path = ?').get(projectId, storagePath) || null;
  }

  getBySha256(projectId, sha256) {
    if (!projectId || !sha256) return null;
    return this.db.prepare('SELECT * FROM artifacts WHERE project_id = ? AND sha256 = ?').get(projectId, sha256) || null;
  }

  create({ id, projectId, conversationId = null, taskId = null, name, type, mimeType, storagePath, sizeBytes = 0, sha256 = '', metadata = {} }) {
    if (!id || !projectId || !name || !type || !mimeType || !storagePath) {
      throw new Error('Artifact id, projectId, name, type, mimeType, and storagePath are required');
    }
    const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);

    this.db.prepare(`
      INSERT INTO artifacts (id, project_id, conversation_id, task_id, name, type, mime_type, storage_path, size_bytes, sha256, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, projectId, conversationId, taskId, name, type, mimeType, storagePath, sizeBytes, sha256, metaStr);

    return this.getById(id, projectId);
  }

  listByProject(projectId, type = null) {
    if (!projectId) return [];
    if (type) {
      return this.db.prepare('SELECT * FROM artifacts WHERE project_id = ? AND type = ? ORDER BY created_at DESC').all(projectId, type);
    }
    return this.db.prepare('SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at DESC').all(projectId);
  }

  delete(id, projectId = null) {
    if (!id) return false;
    let sql = 'DELETE FROM artifacts WHERE id = ?';
    const params = [id];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    const res = this.db.prepare(sql).run(...params);
    return res.changes > 0;
  }
}

module.exports = ArtifactDAO;
