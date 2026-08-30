class WorkspaceDAO {
  constructor(db) {
    this.db = db;
  }

  getByProjectId(projectId) {
    if (!projectId) return null;
    return this.db.prepare('SELECT * FROM workspaces WHERE project_id = ?').get(projectId) || null;
  }

  getById(id) {
    if (!id) return null;
    return this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id) || null;
  }

  create({ id, projectId, diskPath, isGitInitialized = 1, currentBranch = 'main' }) {
    if (!id || !projectId || !diskPath) throw new Error('Workspace id, projectId, and diskPath are required');
    this.db.prepare(`
      INSERT INTO workspaces (id, project_id, disk_path, is_git_initialized, current_branch, last_synced_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(id, projectId, diskPath, isGitInitialized ? 1 : 0, currentBranch);
    return this.getById(id);
  }

  upsert({ id, projectId, diskPath, isGitInitialized = 1, currentBranch = 'main' }) {
    if (!projectId || !diskPath) throw new Error('projectId and diskPath are required');
    const existing = this.getByProjectId(projectId);
    if (existing) {
      this.db.prepare(`
        UPDATE workspaces SET disk_path = ?, is_git_initialized = ?, current_branch = ?, last_synced_at = datetime('now')
        WHERE id = ?
      `).run(diskPath, isGitInitialized ? 1 : 0, currentBranch, existing.id);
      return this.getById(existing.id);
    }
    const finalId = id || `ws-${projectId}`;
    return this.create({ id: finalId, projectId, diskPath, isGitInitialized, currentBranch });
  }

  touchSync(projectId) {
    if (!projectId) return false;
    const res = this.db.prepare("UPDATE workspaces SET last_synced_at = datetime('now') WHERE project_id = ?").run(projectId);
    return res.changes > 0;
  }
}

module.exports = WorkspaceDAO;
