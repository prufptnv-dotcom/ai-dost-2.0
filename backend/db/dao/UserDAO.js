class UserDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id || typeof id !== 'string') return null;
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  }

  getByUsername(username) {
    if (!username || typeof username !== 'string') return null;
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
  }

  create({ id, username, email = null, metadata = {} }) {
    if (!id || !username) throw new Error('User id and username are required');
    const metaStr = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
    this.db.prepare(`
      INSERT INTO users (id, username, email, metadata, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, username, email, metaStr);
    return this.getById(id);
  }

  list() {
    return this.db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
  }
}

module.exports = UserDAO;
