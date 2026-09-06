module.exports = {
  version: 7,
  name: '007_performance_indexes',
  up: (db) => {
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
