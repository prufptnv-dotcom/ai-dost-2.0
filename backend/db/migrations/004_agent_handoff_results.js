module.exports = {
  version: 4,
  name: '004_agent_handoff_results',
  up: (db) => {
    // Check if table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_handoffs'").get();
    if (!tableExists) {
      // Table doesn't exist yet, 003_agent_handoffs will create it or create with result_json
      return;
    }

    const columns = db.prepare('PRAGMA table_info(agent_handoffs)').all().map(c => c.name);
    if (!columns.includes('result_json')) {
      db.prepare('ALTER TABLE agent_handoffs ADD COLUMN result_json TEXT').run();
    }
  },
  down: (db) => {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agent_handoffs'").get();
    if (!tableExists) return;

    const columns = db.prepare('PRAGMA table_info(agent_handoffs)').all().map(c => c.name);
    if (columns.includes('result_json')) {
      // SQLite-safe table rebuild to drop result_json without data loss
      db.exec(`
        CREATE TABLE agent_handoffs_backup (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL,
          source_run_id TEXT NOT NULL,
          target_run_id TEXT,
          source_agent TEXT NOT NULL,
          target_agent TEXT NOT NULL,
          objective TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          context_refs TEXT,
          artifact_refs TEXT,
          constraints TEXT,
          expected_output TEXT,
          expires_at DATETIME,
          error_info TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          accepted_at DATETIME,
          completed_at DATETIME,
          FOREIGN KEY(task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE,
          FOREIGN KEY(source_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(target_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL
        );
        INSERT INTO agent_handoffs_backup SELECT 
          id, task_id, source_run_id, target_run_id, source_agent, target_agent, 
          objective, status, context_refs, artifact_refs, constraints, expected_output, 
          expires_at, error_info, created_at, accepted_at, completed_at 
        FROM agent_handoffs;
        DROP TABLE agent_handoffs;
        ALTER TABLE agent_handoffs_backup RENAME TO agent_handoffs;
        CREATE INDEX IF NOT EXISTS idx_agent_handoffs_task ON agent_handoffs(task_id);
        CREATE INDEX IF NOT EXISTS idx_agent_handoffs_source_run ON agent_handoffs(source_run_id);
        CREATE INDEX IF NOT EXISTS idx_agent_handoffs_target_run ON agent_handoffs(target_run_id);
        CREATE INDEX IF NOT EXISTS idx_agent_handoffs_status ON agent_handoffs(status);
      `);
    }
  }
};
