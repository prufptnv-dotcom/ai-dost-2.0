module.exports = {
  up: (db) => {
    // 1. Agent Tasks
    db.prepare(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_id TEXT,
        user_id TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        failed_at DATETIME,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_tasks_project ON agent_tasks(project_id)').run();

    // 2. Agent Runs
    db.prepare(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        attempt INTEGER DEFAULT 1,
        started_at DATETIME,
        completed_at DATETIME,
        error_info TEXT,
        runtime_metadata TEXT,
        FOREIGN KEY(task_id) REFERENCES agent_tasks(id) ON DELETE CASCADE
      )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_runs_task ON agent_runs(task_id)').run();

    // 3. Agent Steps
    db.prepare(`
      CREATE TABLE IF NOT EXISTS agent_steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        step_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        input TEXT,
        output TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        error_info TEXT,
        FOREIGN KEY(run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
      )
    `).run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_steps(run_id)').run();

    // 4. Tool Calls
    db.prepare(`
      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        step_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        input TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        output TEXT,
        error_info TEXT,
        timing_meta TEXT,
        FOREIGN KEY(step_id) REFERENCES agent_steps(id) ON DELETE CASCADE
      )
    `).run();

    // 5. Observations
    db.prepare(`
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY,
        step_id TEXT NOT NULL,
        observation_type TEXT NOT NULL,
        payload TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(step_id) REFERENCES agent_steps(id) ON DELETE CASCADE
      )
    `).run();

    // 6. Verification Results
    db.prepare(`
      CREATE TABLE IF NOT EXISTS verification_results (
        id TEXT PRIMARY KEY,
        step_id TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        evidence TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(step_id) REFERENCES agent_steps(id) ON DELETE CASCADE
      )
    `).run();
  },
  down: (db) => {
    db.prepare('DROP TABLE IF EXISTS verification_results').run();
    db.prepare('DROP TABLE IF EXISTS observations').run();
    db.prepare('DROP TABLE IF EXISTS tool_calls').run();
    db.prepare('DROP TABLE IF EXISTS agent_steps').run();
    db.prepare('DROP TABLE IF EXISTS agent_runs').run();
    db.prepare('DROP TABLE IF EXISTS agent_tasks').run();
  }
};
