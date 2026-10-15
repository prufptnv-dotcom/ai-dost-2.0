module.exports = {
  version: 10,
  name: '010_copilot_memory',
  up: (db) => {
    db.exec(`
      -- Copilot self-learning notes: user-level, DURABLE across project
      -- deletion — deliberately NO foreign key to projects (a deleted project
      -- must keep its lessons so future runs stay accurate).
      CREATE TABLE IF NOT EXISTS copilot_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local-user',
        project_id TEXT,
        kind TEXT NOT NULL DEFAULT 'lesson',
        content TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'run',
        success_count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_copilot_notes_user ON copilot_notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_copilot_notes_project ON copilot_notes(project_id);
      CREATE INDEX IF NOT EXISTS idx_copilot_notes_updated ON copilot_notes(updated_at);
    `);
  }
};
