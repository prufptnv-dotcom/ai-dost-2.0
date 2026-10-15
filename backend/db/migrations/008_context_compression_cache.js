module.exports = {
  version: 8,
  name: '008_context_compression_cache',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS context_compression_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'unknown',
        importance_score INTEGER NOT NULL CHECK (importance_score BETWEEN 1 AND 10),
        representation TEXT NOT NULL CHECK (representation IN ('full', 'summary')),
        version_hash TEXT,
        payload BLOB NOT NULL,
        original_bytes INTEGER NOT NULL DEFAULT 0,
        compressed_bytes INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(project_id, source_id, representation)
      );
      CREATE INDEX IF NOT EXISTS idx_context_compression_project ON context_compression_cache(project_id);
      CREATE INDEX IF NOT EXISTS idx_context_compression_importance ON context_compression_cache(project_id, importance_score DESC);
    `);
  }
};