class ObservationDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM observations WHERE id = ?').get(id) || null;
  }

  create(data) {
    const { id, stepId, observationType, payload = null } = data;
    this.db.prepare(`
      INSERT INTO observations (id, step_id, observation_type, payload)
      VALUES (?, ?, ?, ?)
    `).run(id, stepId, observationType, payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null);
    return this.getById(id);
  }

  listByStep(stepId) {
    return this.db.prepare('SELECT * FROM observations WHERE step_id = ? ORDER BY created_at ASC').all(stepId);
  }
}

module.exports = ObservationDAO;
