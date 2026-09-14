const { getDatabase } = require('../db');
const ProjectDAO = require('../db/dao/ProjectDAO');
const UserDAO = require('../db/dao/UserDAO');
const logger = require('../logger');

class ProjectAuthorizationService {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  get users() { return new UserDAO(this.db); }
  get projects() { return new ProjectDAO(this.db); }

  /**
   * Resolve caller identity from a trusted authentication context.
   *
   * Production rule: req.user.id is the only accepted authenticated identity.
   * The x-user-id header is retained only as an explicit local/test escape hatch
   * when ALLOW_UNTRUSTED_USER_HEADER=true. Body/query userId is never trusted.
   */
  resolveUser(req) {
    if (req && req.user && typeof req.user.id === 'string' && req.user.id.trim()) {
      return req.user.id.trim();
    }

    const allowHeader = process.env.ALLOW_UNTRUSTED_USER_HEADER === 'true';
    if (allowHeader && !isProduction() && req && req.headers &&
        typeof req.headers['x-user-id'] === 'string' && req.headers['x-user-id'].trim()) {
      return req.headers['x-user-id'].trim();
    }

    return 'local-user';
  }

  /**
   * Returns true when the process is explicitly running in production.
   */
  isProductionRequest(req) {
    return process.env.NODE_ENV === 'production' && !(req && req.user && req.user.id);
  }

  /**
   * Check if a user owns or is authorized to access a project.
   * Owner-less legacy projects are restricted to local development identity.
   */
  verifyOwnership(project, userId) {
    if (!project) return false;
    // Shared/local workspaces are intentionally available to every local caller.
    if (project.id === 'default' || project.id === 'copilot-workspace') return true;
    // Legacy rows without ownership must not become cross-tenant resources.
    if (!project.user_id) return userId === 'local-user' && !isProduction();
    return project.user_id === userId;
  }

  /**
   * Authorize a request against a project.
   * Returns { authorized: true, user, project } or { authorized: false, status, error }.
   */
  authorize(projectId, req, options = {}) {
    const authenticated = Boolean(req && req.user && typeof req.user.id === 'string' && req.user.id.trim());
    if (isProduction() && !authenticated) {
      return {
        authorized: false,
        status: 401,
        error: 'Authentication required for project access'
      };
    }

    const userId = this.resolveUser(req);
    const targetId = (projectId && typeof projectId === 'string') ? projectId.trim() : 'default';

    // 1. Ensure user record exists in DB
    let user = this.users.getById(userId);
    if (!user) {
      user = this.users.create({ id: userId, username: userId });
    }

    // 2. Fetch project
    let project = this.projects.getById(targetId);
    if (!project) {
      if (options.autoCreateIfMissing && (targetId === 'default' || targetId === 'copilot-workspace')) {
        const name = targetId === 'default' ? 'Copilot Workspace' : targetId;
        project = this.projects.create({
          id: targetId,
          userId,
          name,
          slug: targetId,
          description: `Project ${name}`,
          framework: 'generic'
        });
        return { authorized: true, user, project };
      }
      return {
        authorized: false,
        status: 404,
        error: `Project '${targetId}' not found`,
        user
      };
    }

    // 3. Verify ownership
    if (!this.verifyOwnership(project, userId)) {
      logger.warn(`[ProjectAuth] Access denied: User '${userId}' attempted unauthorized access to project '${targetId}' (owned by '${project.user_id || 'legacy-unowned'}')`);
      return {
        authorized: false,
        status: 403,
        error: `Access denied: You do not have permission to access project '${targetId}'`,
        user,
        project
      };
    }

    return { authorized: true, user, project };
  }

  /**
   * Express middleware factory for project authorization
   */
  middleware(paramName = 'id', options = {}) {
    return (req, res, next) => {
      const projectId = req.params[paramName] || req.body?.projectId || req.query?.projectId;
      const auth = this.authorize(projectId, req, options);
      if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
      }
      req.authorizedProject = auth.project;
      req.authorizedUser = auth.user;
      next();
    };
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

const defaultInstance = new ProjectAuthorizationService();
defaultInstance.ProjectAuthorizationService = ProjectAuthorizationService;

module.exports = defaultInstance;
