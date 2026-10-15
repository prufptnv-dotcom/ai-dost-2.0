module.exports = {
  version: 11,
  name: '011_task_events',
  up: (db) => {
    db.exec(`
      -- P9 background runs: every /api/agent/run gets a row, and every SSE
      -- event is persisted so a refresh (or a client that closed the tab
      -- entirely) can replay the full stream. Runs are IN-PROCESS — when the
      -- server restarts any 'running' row is a corpse, marked 'interrupted'
      -- at boot rather than lying about being alive.
      -- NAMED copilot_* ON PURPOSE: 'agent_runs' already exists (002_agent_runtime,
      -- task attempts with id/task_id columns) — CREATE TABLE IF NOT EXISTS would
      -- silently skip and the project_id index would then explode.
      CREATE TABLE IF NOT EXISTS copilot_runs (
        run_id TEXT PRIMARY KEY,
        project_id TEXT,
        prompt TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'running',
        background INTEGER NOT NULL DEFAULT 0,
        seq INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        final_message TEXT
      );

      CREATE TABLE IF NOT EXISTS copilot_run_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_copilot_run_events_run ON copilot_run_events(run_id, seq);
      CREATE INDEX IF NOT EXISTS idx_copilot_runs_project ON copilot_runs(project_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_copilot_runs_status ON copilot_runs(status);
    `);
  }
};
