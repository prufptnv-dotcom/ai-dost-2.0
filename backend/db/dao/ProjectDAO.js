class ProjectDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id, userId = null) {
    if (!id || typeof id !== 'string') return null;
    if (userId) {
      return this.db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, userId) || null;
    }
    return this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) || null;
  }

  getBySlug(slug, userId = 'local-user') {
    if (!slug || typeof slug !== 'string') return null;
    return this.db.prepare('SELECT * FROM projects WHERE slug = ? AND user_id = ?').get(slug, userId) || null;
  }

  create({ id, userId = 'local-user', name, slug = null, description = '', framework = 'generic', status = 'active', settings = {} }) {
    if (!id || !name) throw new Error('Project id and name are required');
    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const settingsStr = typeof settings === 'string' ? settings : JSON.stringify(settings);

    this.db.prepare(`
      INSERT INTO projects (id, user_id, name, slug, description, framework, status, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, userId, name, finalSlug, description, framework, status, settingsStr);

    return this.getById(id, userId);
  }

  upsert({ id, userId = 'local-user', name, description = '', framework = 'generic', status = 'active', settings = {} }) {
    if (!id || !name) throw new Error('Project id and name are required');
    const existing = this.getById(id);
    if (existing) {
      this.update(id, { name, description, framework, status, settings }, userId);
      return this.getById(id, userId);
    }
    return this.create({ id, userId, name, description, framework, status, settings });
  }

  update(id, { name, description, framework, status, settings }, userId = null) {
    if (!id) throw new Error('Project id is required');
    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (framework !== undefined) { fields.push('framework = ?'); params.push(framework); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (settings !== undefined) {
      fields.push('settings = ?');
      params.push(typeof settings === 'string' ? settings : JSON.stringify(settings));
    }

    if (fields.length === 0) return this.getById(id, userId);

    fields.push("updated_at = datetime('now')");
    params.push(id);

    let sql = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    this.db.prepare(sql).run(...params);
    return this.getById(id, userId);
  }

  delete(id, userId = null) {
    if (!id) return false;
    let sql = 'DELETE FROM projects WHERE id = ?';
    const params = [id];
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    const res = this.db.prepare(sql).run(...params);
    return res.changes > 0;
  }

  list(userId = null) {
    if (userId) {
      return this.db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').all(userId);
    }
    return this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
  }
}

module.exports = ProjectDAO;
