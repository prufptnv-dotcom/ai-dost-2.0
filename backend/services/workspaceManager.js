const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDatabase } = require('../db');
const UserDAO = require('../db/dao/UserDAO');
const ProjectDAO = require('../db/dao/ProjectDAO');
const WorkspaceDAO = require('../db/dao/WorkspaceDAO');
const logger = require('../logger');

class WorkspaceManager {
  constructor(db = null) {
    this._db = db;
    this._locks = new Map(); // Per-project init locks for concurrency safety
  }

  get db() {
    return this._db || getDatabase();
  }

  get users() { return new UserDAO(this.db); }
  get projects() { return new ProjectDAO(this.db); }
  get workspaces() { return new WorkspaceDAO(this.db); }

  /**
   * Get the canonical base directory for all project workspaces
   */
  getBaseWorkspaceDir() {
    return path.resolve(os.tmpdir());
  }

  /**
   * Compute deterministic disk path for a project workspace
   */
  getDefaultDiskPath(projectId) {
    const safeId = (projectId || 'default').trim();
    return path.resolve(path.join(this.getBaseWorkspaceDir(), `agent-ws-${safeId}`));
  }

  /**
   * Resolve project and verify ownership if userId is supplied
   */
  _resolveProject(projectId, userId = null) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';
    const project = this.projects.getById(targetId);

    if (project && userId && project.user_id && project.user_id !== userId) {
      const err = new Error(`Access denied: User '${userId}' does not own project '${targetId}'`);
      err.code = 'ERR_UNAUTHORIZED';
      throw err;
    }

    return project;
  }

  /**
   * Get workspace record and ensure ownership
   */
  getWorkspace(projectId, userId = null) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';
    this._resolveProject(targetId, userId);

    const ws = this.workspaces.getByProjectId(targetId);
    return ws || null;
  }

  /**
   * Get physical workspace disk path for a project
   */
  getWorkspacePath(projectId, userId = null) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';
    const ws = this.getWorkspace(targetId, userId);
    if (ws && ws.disk_path) {
      return path.resolve(ws.disk_path);
    }
    return this.getDefaultDiskPath(targetId);
  }

  /**
   * Idempotently ensure workspace exists in Universal DB and on physical disk.
   * Safe under concurrent invocations via per-project lock.
   */
  async ensureWorkspace(projectId, userId = 'local-user', options = {}) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';

    // Per-project concurrency lock
    if (this._locks.has(targetId)) {
      await this._locks.get(targetId);
    }

    const initPromise = (async () => {
      // 1. Ensure user exists
      let user = this.users.getById(userId);
      if (!user) {
        user = this.users.create({ id: userId, username: userId });
      }

      // 2. Ensure project exists
      let project = this.projects.getById(targetId);
      if (!project) {
        const name = targetId === 'default' ? 'Copilot Workspace' : targetId;
        project = this.projects.create({
          id: targetId,
          userId,
          name,
          slug: targetId,
          description: options.description || `Project ${name}`,
          framework: options.framework || 'generic'
        });
      } else if (userId && project.user_id && project.user_id !== userId) {
        const err = new Error(`Access denied: User '${userId}' does not own project '${targetId}'`);
        err.code = 'ERR_UNAUTHORIZED';
        throw err;
      }

      // 3. Ensure workspace record in DB
      let workspace = this.workspaces.getByProjectId(targetId);
      const diskPath = options.diskPath ? path.resolve(options.diskPath) : this.getDefaultDiskPath(targetId);

      if (!workspace) {
        workspace = this.workspaces.create({
          id: `ws-${targetId}`,
          projectId: targetId,
          diskPath,
          isGitInitialized: options.isGitInitialized !== undefined ? options.isGitInitialized : 1,
          currentBranch: options.currentBranch || 'main'
        });
      }

      // 4. Ensure physical directory on disk
      try {
        if (!fs.existsSync(diskPath)) {
          fs.mkdirSync(diskPath, { recursive: true });
        }
      } catch (fsErr) {
        logger.error(`[WorkspaceManager] Failed to create physical workspace directory at ${diskPath}:`, fsErr.message);
        throw fsErr;
      }

      return { project, workspace, diskPath };
    })();

    this._locks.set(targetId, initPromise);
    try {
      return await initPromise;
    } finally {
      this._locks.delete(targetId);
    }
  }

  /**
   * Synchronous version of ensureWorkspace for synchronous project hydrators
   */
  ensureWorkspaceSync(projectId, userId = 'local-user', options = {}) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';

    // 1. Ensure user
    let user = this.users.getById(userId);
    if (!user) {
      user = this.users.create({ id: userId, username: userId });
    }

    // 2. Ensure project
    let project = this.projects.getById(targetId);
    if (!project) {
      const name = targetId === 'default' ? 'Copilot Workspace' : targetId;
      project = this.projects.create({
        id: targetId,
        userId,
        name,
        slug: targetId,
        description: options.description || `Project ${name}`,
        framework: options.framework || 'generic'
      });
    } else if (userId && project.user_id && project.user_id !== userId) {
      const err = new Error(`Access denied: User '${userId}' does not own project '${targetId}'`);
      err.code = 'ERR_UNAUTHORIZED';
      throw err;
    }

    // 3. Ensure workspace in DB
    let workspace = this.workspaces.getByProjectId(targetId);
    const diskPath = options.diskPath ? path.resolve(options.diskPath) : this.getDefaultDiskPath(targetId);

    if (!workspace) {
      workspace = this.workspaces.create({
        id: `ws-${targetId}`,
        projectId: targetId,
        diskPath,
        isGitInitialized: options.isGitInitialized !== undefined ? options.isGitInitialized : 1,
        currentBranch: options.currentBranch || 'main'
      });
    }

    // 4. Ensure physical directory
    if (!fs.existsSync(diskPath)) {
      fs.mkdirSync(diskPath, { recursive: true });
    }

    return { project, workspace, diskPath };
  }

  /**
   * Check if workspace exists in DB and on physical disk
   */
  workspaceExists(projectId) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';
    const ws = this.workspaces.getByProjectId(targetId);
    if (!ws || !ws.disk_path) return false;
    return fs.existsSync(ws.disk_path);
  }

  /**
   * Validate that a path is safely contained within the project workspace boundary.
   * Rejects path traversal, UNC paths, and cross-project escapes.
   */
  validatePath(projectId, candidatePath, userId = null) {
    if (!candidatePath || typeof candidatePath !== 'string') {
      return { valid: false, reason: 'Candidate path is empty or invalid' };
    }

    // Check for explicit traversal strings
    const normalized = candidatePath.replace(/\\/g, '/');
    if (normalized.includes('../') || normalized.includes('/..') || normalized === '..') {
      return { valid: false, reason: 'Path traversal sequences (..) are forbidden' };
    }

    // Check for Windows UNC path attempts (\\server\share)
    if (candidatePath.startsWith('\\\\') || candidatePath.startsWith('//')) {
      return { valid: false, reason: 'UNC network paths are forbidden' };
    }

    // Check for null byte injection
    if (candidatePath.includes('\0')) {
      return { valid: false, reason: 'Null byte injection detected' };
    }

    const wsRoot = this.getWorkspacePath(projectId, userId);
    const resolvedCandidate = path.resolve(wsRoot, candidatePath.replace(/^[/\\]+/, ''));

    // Check case-insensitive containment on Windows, case-sensitive on POSIX
    const isWindows = process.platform === 'win32';
    const rootNorm = isWindows ? wsRoot.toLowerCase() : wsRoot;
    const candNorm = isWindows ? resolvedCandidate.toLowerCase() : resolvedCandidate;

    const isInside = candNorm === rootNorm || candNorm.startsWith(rootNorm + path.sep.toLowerCase());
    if (!isInside) {
      return { valid: false, reason: 'Candidate path escapes workspace boundary' };
    }

    return { valid: true, resolvedPath: resolvedCandidate, rootPath: wsRoot };
  }

  /**
   * Strictly resolve relative path to absolute path inside workspace root.
   * Throws Security Error if candidate path escapes boundary.
   */
  resolvePath(projectId, relativePath = '', userId = null) {
    const check = this.validatePath(projectId, relativePath, userId);
    if (!check.valid) {
      const err = new Error(`Workspace path security violation (ERR_PATH_TRAVERSAL) for project '${projectId}': ${check.reason}`);
      err.code = 'ERR_PATH_TRAVERSAL';
      throw err;
    }
    
    const resolvedPath = check.resolvedPath;
    const wsRoot = this.getWorkspacePath(projectId, userId);
    
    // Prevent symlink escape by validating the closest existing parent directory
    let currentPath = resolvedPath;
    while (currentPath !== path.dirname(currentPath)) {
      if (fs.existsSync(currentPath)) {
        const real = fs.realpathSync(currentPath);
        const isWindows = process.platform === 'win32';
        const rootNorm = isWindows ? wsRoot.toLowerCase() : wsRoot;
        const realNorm = isWindows ? real.toLowerCase() : real;
        
        if (realNorm !== rootNorm && !realNorm.startsWith(rootNorm + path.sep.toLowerCase())) {
          const err = new Error(`Workspace path security violation (ERR_PATH_TRAVERSAL) for project '${projectId}': Symlink escape detected`);
          err.code = 'ERR_PATH_TRAVERSAL';
          throw err;
        }
        break; 
      }
      currentPath = path.dirname(currentPath);
    }
    
    return resolvedPath;
  }

  /**
   * Fetch rich workspace metadata
   */
  getWorkspaceMetadata(projectId, userId = null) {
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';
    const ws = this.getWorkspace(targetId, userId);
    const diskPath = this.getWorkspacePath(targetId, userId);
    const existsOnDisk = fs.existsSync(diskPath);

    let fileCount = 0;
    let totalSizeBytes = 0;

    if (existsOnDisk) {
      try {
        const countFiles = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (['node_modules', '.git', '.checkpoints'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              countFiles(full);
            } else if (entry.isFile()) {
              fileCount++;
              try {
                totalSizeBytes += fs.statSync(full).size;
              } catch (_) {}
            }
          }
        };
        countFiles(diskPath);
      } catch (_) {}
    }

    return {
      id: ws ? ws.id : `ws-${targetId}`,
      projectId: targetId,
      diskPath,
      isGitInitialized: ws ? ws.is_git_initialized === 1 : false,
      currentBranch: ws ? ws.current_branch : 'main',
      lastSyncedAt: ws ? ws.last_synced_at : null,
      existsOnDisk,
      fileCount,
      totalSizeBytes
    };
  }
}

const defaultInstance = new WorkspaceManager();
defaultInstance.WorkspaceManager = WorkspaceManager;

module.exports = defaultInstance;
