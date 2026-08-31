const { getDatabase } = require('../db');
const defaultProjectAuth = require('./projectAuthorization');
const logger = require('../logger');

class SupervisorService {
  constructor({ db = null, coordinator = null, projectAuthService = null } = {}) {
    this._db = db;
    this.coordinator = coordinator;
    this.projectAuthService = projectAuthService || defaultProjectAuth;
  }

  get db() {
    return this._db || getDatabase();
  }

  /**
   * Create a new supervisor task with trusted role SUPERVISOR.
   */
  async createSupervisorSession({ projectId, reqOrUserId, title = 'Supervisor Orchestration Task', prompt = '', metadata = {} }) {
    const auth = typeof reqOrUserId === 'object'
      ? this.projectAuthService.authorize(projectId, reqOrUserId)
      : this.projectAuthService.authorize(projectId, { user: { id: reqOrUserId } });

    if (!auth.authorized) {
      throw new Error(auth.error || 'Project authorization denied');
    }

    if (!this.coordinator) {
      const AgentCoordinator = require('../agent/runtime/AgentCoordinator');
      this.coordinator = new AgentCoordinator({ db: this.db });
    }

    return this.coordinator.createSupervisorTask({
      userId: auth.user.id,
      projectId: auth.project.id,
      title,
      prompt,
      metadata
    });
  }
}

module.exports = SupervisorService;
