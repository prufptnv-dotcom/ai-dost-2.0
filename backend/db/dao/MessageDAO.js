class MessageDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) || null;
  }

  create({ id, conversationId, role, content, model = null, tokensUsed = 0, latencyMs = 0, attachments = [] }) {
    if (!id || !conversationId || !role || content === undefined) {
      throw new Error('Message id, conversationId, role, and content are required');
    }
    const attachStr = typeof attachments === 'string' ? attachments : JSON.stringify(attachments);

    this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, model, tokens_used, latency_ms, attachments, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, conversationId, role, content, model, tokensUsed, latencyMs, attachStr);

    // Touch conversation updated_at
    this.db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);

    return this.getById(id);
  }

  listByConversation(conversationId, limit = 100) {
    if (!conversationId) return [];
    return this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?').all(conversationId, limit);
  }

  deleteByConversation(conversationId) {
    if (!conversationId) return false;
    const res = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
    return res.changes > 0;
  }
}

module.exports = MessageDAO;
