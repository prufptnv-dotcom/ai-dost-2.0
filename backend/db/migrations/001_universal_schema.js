const path = require('path');
const os = require('os');

module.exports = {
  version: 1,
  name: '001_universal_project_store_schema',
  up: (db) => {
    // 1. Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT
      );
    `);

    // Ensure default local-user exists
    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, metadata)
      VALUES ('local-user', 'local-user', 'local@ai-dost.internal', '{}')
    `).run();

    // 2. Projects table (additive to existing schema)
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local-user',
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        framework TEXT DEFAULT 'generic',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        settings TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Check if projects table needs additive columns (for existing legacy db)
    const existingCols = db.prepare(`PRAGMA table_info(projects)`).all().map(c => c.name);
    if (!existingCols.includes('user_id')) {
      try { db.exec(`ALTER TABLE projects ADD COLUMN user_id TEXT DEFAULT 'local-user'`); } catch (_) {}
    }
    if (!existingCols.includes('slug')) {
      try { db.exec(`ALTER TABLE projects ADD COLUMN slug TEXT DEFAULT 'default'`); } catch (_) {}
    }
    if (!existingCols.includes('framework')) {
      try { db.exec(`ALTER TABLE projects ADD COLUMN framework TEXT DEFAULT 'generic'`); } catch (_) {}
    }
    if (!existingCols.includes('updated_at')) {
      try {
        db.exec(`ALTER TABLE projects ADD COLUMN updated_at TEXT DEFAULT ''`);
        db.exec(`UPDATE projects SET updated_at = datetime('now') WHERE updated_at IS NULL OR updated_at = ''`);
      } catch (_) {}
    }
    if (!existingCols.includes('settings')) {
      try { db.exec(`ALTER TABLE projects ADD COLUMN settings TEXT DEFAULT '{}'`); } catch (_) {}
    }

    // 3. Workspaces table
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        disk_path TEXT NOT NULL,
        is_git_initialized INTEGER DEFAULT 1,
        current_branch TEXT DEFAULT 'main',
        last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_workspaces_project_id ON workspaces(project_id);
    `);

    // 4. Conversations table
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'local-user',
        title TEXT NOT NULL,
        surface TEXT NOT NULL DEFAULT 'chat',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id);
    `);

    // 5. Messages table
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        model TEXT,
        tokens_used INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        attachments TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `);

    // 6. Artifacts table
    db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_id TEXT,
        task_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        sha256 TEXT NOT NULL DEFAULT '',
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_artifacts_project_id ON artifacts(project_id);
      CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);
    `);

    // 7. Context Nodes table
    db.exec(`
      CREATE TABLE IF NOT EXISTS context_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_summary TEXT,
        raw_ref TEXT,
        embedding_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_context_nodes_project_id ON context_nodes(project_id);
      CREATE INDEX IF NOT EXISTS idx_context_nodes_type ON context_nodes(node_type);
    `);

    // 8. Context Edges table
    db.exec(`
      CREATE TABLE IF NOT EXISTS context_edges (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (source_node_id) REFERENCES context_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_node_id) REFERENCES context_nodes(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_context_edges_project_id ON context_edges(project_id);
      CREATE INDEX IF NOT EXISTS idx_context_edges_source ON context_edges(source_node_id);
      CREATE INDEX IF NOT EXISTS idx_context_edges_target ON context_edges(target_node_id);
    `);

    // Ensure default project exists
    db.prepare(`
      INSERT OR IGNORE INTO projects (id, user_id, name, slug, description, framework, status, created_at, updated_at)
      VALUES ('default', 'local-user', 'Copilot Workspace', 'default', 'Autonomous AI Copilot Workspace', 'react-vite', 'active', datetime('now'), datetime('now'))
    `).run();

    // Ensure default workspace binding exists
    const defaultWsPath = path.join(os.tmpdir(), 'agent-ws-default');
    db.prepare(`
      INSERT OR IGNORE INTO workspaces (id, project_id, disk_path, is_git_initialized, current_branch, last_synced_at)
      VALUES ('ws-default', 'default', ?, 1, 'main', datetime('now'))
    `).run(defaultWsPath);
  }
};
