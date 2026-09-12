module.exports = {
  version: 9,
  name: '009_assessments_schema',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'default',
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        topic TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('practice', 'mock', 'interview', 'adaptive')),
        difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'mixed')),
        time_limit INTEGER NOT NULL DEFAULT 0,
        negative_marks REAL NOT NULL DEFAULT 0,
        questions_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_assessments_topic ON assessments(topic);
      CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(user_id);
      CREATE INDEX IF NOT EXISTS idx_assessments_mode ON assessments(mode);

      CREATE TABLE IF NOT EXISTS assessment_attempts (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default',
        mode TEXT NOT NULL,
        started_at TEXT NOT NULL,
        submitted_at TEXT,
        answers_json TEXT,
        result_json TEXT,
        status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'abandoned', 'expired')),
        time_spent_seconds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON assessment_attempts(assessment_id);
      CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user ON assessment_attempts(user_id);
      CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON assessment_attempts(status);
    `);
  }
};
