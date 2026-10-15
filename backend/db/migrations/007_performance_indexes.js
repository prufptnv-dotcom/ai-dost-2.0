module.exports = {
  version: 7,
  name: '007_performance_indexes',
  up: (db) => {
    // Keep this migration safe for databases created before the canonical
    // workspace file table was moved out of server.js.
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspace_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT,
        last_modified TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(project_id, path)
      );
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt TEXT,
        json_data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Indexes on workspace_files for quick retrieval by project and path
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workspace_files_project_id ON workspace_files(project_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_files_path ON workspace_files(path);
    `);

    // Indexes on chat_history for quick retrieval by session
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
    `);
  }
};
