/**
 * CopilotNoteDAO — durable, user-scoped learning notes (copilot_notes table).
 * No FK to projects on purpose: notes must outlive project deletion.
 * All methods synchronous (node:sqlite DatabaseSync).
 */
class CopilotNoteDAO {
  constructor(db) {
    this.db = db;
  }

  create({ userId = 'local-user', projectId = null, kind = 'lesson', content, tags = [], source = 'run' }) {
    const clean = String(content || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!clean) return null;
    const cleanKind = String(kind || 'lesson').slice(0, 24);
    const cleanSource = String(source || 'run').slice(0, 24);
    let cleanTags = Array.isArray(tags) ? tags : [];
    cleanTags = cleanTags.map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8);
    const projectIdVal = projectId ? String(projectId).slice(0, 120) : null;

    const existing = this.db
      .prepare('SELECT id FROM copilot_notes WHERE user_id = ? AND content = ?')
      .get(userId, clean);
    if (existing) {
      this.db
        .prepare("UPDATE copilot_notes SET success_count = success_count + 1, updated_at = datetime('now') WHERE id = ?")
        .run(existing.id);
      return { id: existing.id, deduped: true };
    }

    const id = `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.db
      .prepare('INSERT INTO copilot_notes (id, user_id, project_id, kind, content, tags, source) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, projectIdVal, cleanKind, clean, JSON.stringify(cleanTags), cleanSource);
    return { id, deduped: false };
  }

  listByUser(userId, limit = 300) {
    return this.db
      .prepare('SELECT * FROM copilot_notes WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT ?')
      .all(userId, limit);
  }

  listVisible({ userId, projectId = null, q = '', limit = 50 }) {
    let rows = this.db
      .prepare('SELECT * FROM copilot_notes WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC LIMIT 500')
      .all(userId);
    if (projectId) {
      rows = rows.filter(r => r.project_id === projectId || r.project_id == null);
    }
    if (q) {
      const needle = String(q).toLowerCase();
      rows = rows.filter(r => (r.content || '').toLowerCase().includes(needle));
    }
    return rows.slice(0, Math.min(Math.max(limit, 1), 200));
  }

  getById(id) {
    return this.db.prepare('SELECT * FROM copilot_notes WHERE id = ?').get(id) || null;
  }

  remove(id, userId) {
    const res = this.db.prepare('DELETE FROM copilot_notes WHERE id = ? AND user_id = ?').run(id, userId);
    return (res.changes || 0) > 0;
  }

  clear(userId, projectId = null) {
    if (projectId) {
      const res = this.db.prepare('DELETE FROM copilot_notes WHERE user_id = ? AND project_id = ?').run(userId, projectId);
      return res.changes || 0;
    }
    const res = this.db.prepare('DELETE FROM copilot_notes WHERE user_id = ?').run(userId);
    return res.changes || 0;
  }

  count(userId, projectId = null) {
    if (projectId) {
      const row = this.db.prepare('SELECT COUNT(*) AS n FROM copilot_notes WHERE user_id = ? AND project_id = ?').get(userId, projectId);
      return (row && row.n) || 0;
    }
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM copilot_notes WHERE user_id = ?').get(userId);
    return (row && row.n) || 0;
  }
}

module.exports = CopilotNoteDAO;
