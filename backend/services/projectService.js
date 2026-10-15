const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { getDatabase } = require('../db');
const UserDAO = require('../db/dao/UserDAO');
const ProjectDAO = require('../db/dao/ProjectDAO');
const WorkspaceDAO = require('../db/dao/WorkspaceDAO');
const ConversationDAO = require('../db/dao/ConversationDAO');
const MessageDAO = require('../db/dao/MessageDAO');
const ArtifactDAO = require('../db/dao/ArtifactDAO');
const ContextNodeDAO = require('../db/dao/ContextNodeDAO');
const ContextEdgeDAO = require('../db/dao/ContextEdgeDAO');
const workspaceManager = require('./workspaceManager');
const logger = require('../logger');

class ProjectService {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  get users() { return new UserDAO(this.db); }
  get projects() { return new ProjectDAO(this.db); }
  get workspaces() { return new WorkspaceDAO(this.db); }
  get conversations() { return new ConversationDAO(this.db); }
  get messages() { return new MessageDAO(this.db); }
  get artifacts() { return new ArtifactDAO(this.db); }
  get contextNodes() { return new ContextNodeDAO(this.db); }
  get contextEdges() { return new ContextEdgeDAO(this.db); }
  get workspaceManager() {
    return this._db ? new workspaceManager.WorkspaceManager(this._db) : workspaceManager;
  }

  /**
   * Canonical Project Resolver
   * Resolves any valid, missing, or legacy project identifier into a guaranteed { project, workspace }.
   */
  resolveProject(projectId = null, userId = 'local-user') {
    const rawId = (projectId && typeof projectId === 'string') ? projectId.trim() : null;
    const targetId = rawId || 'default';

    const { project, workspace } = this.workspaceManager.ensureWorkspaceSync(targetId, userId);
    return { project, workspace };
  }

  /**
   * Resolve or create conversation under a project
   */
  resolveConversation(conversationId = null, projectId = 'default', options = {}) {
    const { project } = this.resolveProject(projectId, options.userId || 'local-user');
    const surface = options.surface || 'chat';
    const title = options.title || (surface === 'copilot' ? 'Copilot Session' : 'Chat Conversation');

    if (conversationId && typeof conversationId === 'string') {
      let conv = this.conversations.getById(conversationId, project.id);
      if (!conv) {
        conv = this.conversations.create({
          id: conversationId,
          projectId: project.id,
          userId: project.user_id,
          title,
          surface
        });
      }
      return conv;
    }

    // Generate new conversation
    const newId = `conv_${crypto.randomUUID()}`;
    return this.conversations.create({
      id: newId,
      projectId: project.id,
      userId: project.user_id,
      title,
      surface
    });
  }

  /**
   * Canonical Workspace Path Resolver
   */
  getWorkspacePath(projectId = 'default') {
    const { workspace } = this.resolveProject(projectId);
    return workspace.disk_path;
  }

  /**
   * Project Management APIs
   */
  listProjects(userId = null) {
    const projs = this.projects.list(userId);
    return projs.map(p => {
      const ws = this.workspaces.getByProjectId(p.id);
      return {
        ...p,
        workspace: ws || null
      };
    });
  }

  createProject({ name, description = '', framework = 'generic', userId = 'local-user', id = null }) {
    const projId = id || `proj_${crypto.randomUUID().slice(0, 8)}`;
    const { project, workspace } = this.resolveProject(projId, userId);
    this.projects.update(projId, { name, description, framework }, userId);
    return {
      ...this.projects.getById(projId, userId),
      workspace
    };
  }

  deleteProject(projectId, userId = null) {
    if (projectId === 'default') {
      throw new Error("Cannot delete default workspace project");
    }
    return this.projects.delete(projectId, userId);
  }

  /**
   * Unified Project Context Hydrator
   */
  getProjectContext(projectId = 'default', userId = 'local-user') {
    const { project, workspace } = this.resolveProject(projectId, userId);
    const artifacts = this.artifacts.listByProject(project.id);
    const conversations = this.conversations.listByProject(project.id);
    const contextNodes = this.contextNodes.listByProject(project.id);
    const contextEdges = this.contextEdges.listByProject(project.id);

    let devServer = null;
    try {
      const devServerManager = require('../sandbox/devServerManager');
      const srv = devServerManager.getServerByProject(project.id);
      if (srv) {
        devServer = {
          status: srv.status,
          hostPort: srv.hostPort,
          previewUrl: srv.previewUrl
        };
      }
    } catch (_) {}

    return {
      project,
      workspace,
      devServer: devServer || { status: 'STOPPED', hostPort: null, previewUrl: null },
      artifacts,
      conversations,
      contextGraph: {
        nodes: contextNodes,
        edges: contextEdges
      }
    };
  }
}

const defaultInstance = new ProjectService();
defaultInstance.ProjectService = ProjectService;

module.exports = defaultInstance;
