module.exports = {
  version: 3,
  name: '003_agent_handoffs',
  up: (db) => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS agent_handoffs (
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
      )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_handoffs_task ON agent_handoffs(task_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_handoffs_source_run ON agent_handoffs(source_run_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_handoffs_target_run ON agent_handoffs(target_run_id)').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_handoffs_status ON agent_handoffs(status)').run();
  },
  down: (db) => {
    db.prepare('DROP TABLE IF EXISTS agent_handoffs').run();
  }
};
