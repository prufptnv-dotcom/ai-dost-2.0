const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./logger');

let db = null;

function getDb() {
  if (!db) {
    db = new Database(path.join(__dirname, 'data', 'app.db'));
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// Upsert a project file so CopilotIDE's /memory/project/:id refresh sees it
function saveProjectFile(projectId, filePath, content) {
  if (!projectId || !filePath) return false;
  try {
    const d = getDb();
    d.prepare('INSERT OR IGNORE INTO projects (id, name, description, created_at, status) VALUES (?, ?, ?, datetime(\'now\'), \'Active\')')
      .run(projectId, projectId === 'default' ? 'Copilot Workspace' : projectId, 'Autonomous AI Copilot Workspace');

    const existing = d.prepare('SELECT id FROM workspace_files WHERE project_id = ? AND path = ?').get(projectId, filePath);
    if (existing) {
      d.prepare('UPDATE workspace_files SET content = ?, last_modified = datetime(\'now\') WHERE id = ?')
        .run(content, existing.id);
    } else {
      d.prepare('INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)')
        .run(projectId, filePath, content);
    }
    return true;
  } catch (e) {
    logger.error('[ProjectStore] save failed:', e.message || e);
    return false;
  }
}

// Delete a project file (used by agent delete_file / move_file tools)
function deleteProjectFile(projectId, filePath) {
  if (!projectId || !filePath) return false;
  try {
    const d = getDb();
    d.prepare('DELETE FROM workspace_files WHERE project_id = ? AND path = ?').run(projectId, filePath);
    return true;
  } catch (e) {
    logger.error('[ProjectStore] delete failed:', e.message || e);
    return false;
  }
}

// Read all files of a project from SQLite (path → content)
function getProjectFiles(projectId) {
  if (!projectId) return [];
  try {
    const d = getDb();
    return d.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
  } catch (e) {
    logger.error('[ProjectStore] read failed:', e.message || e);
    return [];
  }
}

module.exports = { saveProjectFile, deleteProjectFile, getProjectFiles };