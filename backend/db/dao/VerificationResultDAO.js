class VerificationResultDAO {
  constructor(db) {
    this.db = db;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM verification_results WHERE id = ?').get(id) || null;
  }

  create(data) {
    const { id, stepId, status, reason = null, evidence = null } = data;
    this.db.prepare(`
      INSERT INTO verification_results (id, step_id, status, reason, evidence)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id, 
      stepId, 
      status, 
      reason, 
      evidence ? (typeof evidence === 'string' ? evidence : JSON.stringify(evidence)) : null
    );
    return this.getById(id);
  }

  listByStep(stepId) {
    return this.db.prepare('SELECT * FROM verification_results WHERE step_id = ? ORDER BY created_at ASC').all(stepId);
  }
}

module.exports = VerificationResultDAO;
