module.exports = {
  version: 5,
  name: '005_workflows_schema',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        description TEXT,
        trigger_type TEXT NOT NULL,
        trigger_config TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_config TEXT NOT NULL,
        notify_channels TEXT NOT NULL DEFAULT '["in_app"]',
        status TEXT NOT NULL DEFAULT 'active',
        last_run_at TEXT,
        next_run_at TEXT,
        run_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_project ON workflows(project_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        finished_at TEXT,
        duration_ms INTEGER,
        output_summary TEXT,
        output_data TEXT,
        error_message TEXT,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
    `);

    // Seed default starter watchers if none exist
    const count = db.prepare('SELECT COUNT(*) as c FROM workflows').get().c;
    if (count === 0) {
      const defaultWorkflows = [
        {
          id: 'wf-daily-market-brief',
          project_id: 'default',
          name: 'Daily Market & AI Tech Brief',
          description: 'Autonomous research pipeline searching latest AI developments and synthesizing evidence dossier.',
          trigger_type: 'schedule',
          trigger_config: JSON.stringify({ intervalMinutes: 1440, label: 'Every 24 hours' }),
          action_type: 'deep_research',
          action_config: JSON.stringify({ topic: 'Generative AI and Agentic Developer Tools Advances', depth: 'deep' }),
          notify_channels: JSON.stringify(['in_app', 'telegram']),
          status: 'active',
          next_run_at: new Date(Date.now() + 86400000).toISOString(),
        },
        {
          id: 'wf-nightly-code-audit',
          project_id: 'default',
          name: 'Nightly Codebase Health & Git Audit',
          description: 'Automated workspace integrity analysis, lint verification, and uncommitted diff detection.',
          trigger_type: 'schedule',
          trigger_config: JSON.stringify({ intervalMinutes: 720, label: 'Every 12 hours' }),
          action_type: 'repo_health_check',
          action_config: JSON.stringify({ checks: ['git_status', 'files_integrity', 'disk_usage'] }),
          notify_channels: JSON.stringify(['in_app']),
          status: 'active',
          next_run_at: new Date(Date.now() + 43200000).toISOString(),
        },
        {
          id: 'wf-agent-task-watcher',
          project_id: 'default',
          name: 'Agent Completion Deliverable Watcher',
          description: 'Watches for finished autonomous agent runs and triggers deliverable digest notification.',
          trigger_type: 'event',
          trigger_config: JSON.stringify({ event: 'agent_run_completed' }),
          action_type: 'generate_document',
          action_config: JSON.stringify({ topic: 'Agent Run Deliverable Summary', type: 'docx' }),
          notify_channels: JSON.stringify(['in_app', 'telegram']),
          status: 'active',
          next_run_at: null,
        }
      ];

      const insertStmt = db.prepare(`
        INSERT INTO workflows (id, project_id, name, description, trigger_type, trigger_config, action_type, action_config, notify_channels, status, next_run_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      for (const wf of defaultWorkflows) {
        insertStmt.run(
          wf.id,
          wf.project_id,
          wf.name,
          wf.description,
          wf.trigger_type,
          wf.trigger_config,
          wf.action_type,
          wf.action_config,
          wf.notify_channels,
          wf.status,
          wf.next_run_at
        );
      }
    }
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS workflow_runs;
      DROP TABLE IF EXISTS workflows;
    `);
  }
};
