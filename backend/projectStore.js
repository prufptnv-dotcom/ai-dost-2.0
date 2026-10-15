const { getDatabase } = require('./db');
const logger = require('./logger');
const { EventEmitter } = require('events');

// Workspace change bus — watch mode (Phase 3b) pushes these to CopilotIDE via
// GET /api/agent/watch/:projectId SSE. One event per successful write/delete.
const workspaceBus = new EventEmitter();
workspaceBus.setMaxListeners(0);

function onWorkspaceChange(listener) {
  workspaceBus.on('change', listener);
  return () => workspaceBus.off('change', listener);
}

function emitChange(projectId, path, action) {
  try {
    workspaceBus.emit('change', { projectId, path, action, at: Date.now() });
  } catch (e) {
    logger.error('[ProjectStore] change emit failed:', e.message || e);
  }
}

function getDb() {
  return getDatabase();
}

function normalizePath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();
}

// Upsert a project file so CopilotIDE's /memory/project/:id refresh sees it
function saveProjectFile(projectId, filePath, content) {
  if (!projectId || !filePath) return false;
  try {
    const cleanPath = normalizePath(filePath);
    if (!cleanPath) return false;
    const d = getDb();
    d.prepare(`
      INSERT OR IGNORE INTO projects (id, user_id, name, slug, description, framework, status, created_at, updated_at)
      VALUES (?, 'local-user', ?, ?, 'Autonomous AI Copilot Workspace', 'generic', 'active', datetime('now'), datetime('now'))
    `).run(projectId, projectId === 'default' ? 'Copilot Workspace' : projectId, projectId);

    const existing = d.prepare('SELECT id FROM workspace_files WHERE project_id = ? AND (path = ? OR path = ? OR path = ? COLLATE NOCASE)').get(
      projectId, cleanPath, cleanPath.replace(/\//g, '\\'), `./${cleanPath}`
    );
    if (existing) {
      d.prepare('UPDATE workspace_files SET path = ?, content = ?, last_modified = datetime(\'now\') WHERE id = ?')
        .run(cleanPath, content, existing.id);
    } else {
      d.prepare('INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)')
        .run(projectId, cleanPath, content);
    }
    emitChange(projectId, cleanPath, 'write');
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
    const cleanPath = normalizePath(filePath);
    if (!cleanPath) return false;
    const d = getDb();
    // P2 #50: rows are stored via normalizePath (plus legacy backslash / ./
    // variants) — an exact raw-path match silently missed the row and the
    // delete appeared to succeed while the file stayed in the DB.
    d.prepare(`
      DELETE FROM workspace_files
      WHERE project_id = ? AND (path = ? OR path = ? OR path = ? COLLATE NOCASE)
    `).run(projectId, cleanPath, cleanPath.replace(/\//g, '\\'), `./${cleanPath}`);
    emitChange(projectId, cleanPath, 'delete');
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

// Clear all files of a project from SQLite
function clearProjectFiles(projectId) {
  if (!projectId) return false;
  try {
    const d = getDb();
    d.prepare('DELETE FROM workspace_files WHERE project_id = ?').run(projectId);
    emitChange(projectId, '*', 'clear');
    return true;
  } catch (e) {
    logger.error('[ProjectStore] clear failed:', e.message || e);
    return false;
  }
}

module.exports = { saveProjectFile, deleteProjectFile, clearProjectFiles, getProjectFiles, onWorkspaceChange, notifyWorkspaceChange: emitChange };