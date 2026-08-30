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
   * Resolve trusted user identity from request context.
   * Priority:
   * 1. req.user.id (from authenticated session/JWT middleware if present)
   * 2. req.headers['x-user-id'] (canonical header for multi-user/test requests)
   * 3. Fallback to 'local-user' for local development mode
   *
   * SECURITY RULE: Never trust req.body.userId or req.query.userId as proof of caller identity!
   */
  resolveUser(req) {
    if (req && req.user && typeof req.user.id === 'string' && req.user.id.trim()) {
      return req.user.id.trim();
    }
    if (req && req.headers && typeof req.headers['x-user-id'] === 'string' && req.headers['x-user-id'].trim()) {
      return req.headers['x-user-id'].trim();
    }
    return 'local-user';
  }

  /**
   * Check if a user owns or is authorized to access a project
   */
  verifyOwnership(project, userId) {
    if (!project) return false;
    // Default project is shared/local
    if (project.id === 'default' || project.id === 'copilot-workspace') return true;
    if (!project.user_id) return true; // Legacy project without assigned user
    return project.user_id === userId;
  }

  /**
   * Authorize a request against a project.
   * Returns { authorized: true, user, project } or { authorized: false, status: 403|404, error: string }
   */
  authorize(projectId, req, options = {}) {
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

    // 3. Verify Ownership (SEC-001)
    if (!this.verifyOwnership(project, userId)) {
      logger.warn(`[ProjectAuth] Access denied: User '${userId}' attempted unauthorized access to project '${targetId}' (owned by '${project.user_id}')`);
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

const defaultInstance = new ProjectAuthorizationService();
defaultInstance.ProjectAuthorizationService = ProjectAuthorizationService;

module.exports = defaultInstance;
