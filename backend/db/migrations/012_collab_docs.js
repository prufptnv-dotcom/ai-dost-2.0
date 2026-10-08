module.exports = {
  version: 12,
  name: '012_collab_docs',
  up: (db) => {
    db.exec(`
      -- P8 multiplayer: the shared Yjs document state per project, persisted
      -- as a binary snapshot (Y.encodeStateAsUpdate) so a collaboration
      -- session survives backend restarts. One row per project; updates are
      -- debounced in services/collabDoc.js (not per-keystroke).
      CREATE TABLE IF NOT EXISTS collab_docs (
        project_id TEXT PRIMARY KEY,
        state BLOB NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
};
