const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../db');
const ProjectDAO = require('../db/dao/ProjectDAO');
const ContextNodeDAO = require('../db/dao/ContextNodeDAO');
const ContextEdgeDAO = require('../db/dao/ContextEdgeDAO');
const ArtifactDAO = require('../db/dao/ArtifactDAO');
const ConversationDAO = require('../db/dao/ConversationDAO');
const WorkspaceDAO = require('../db/dao/WorkspaceDAO');

class ProjectGraphService {
  constructor(db = null) {
    this.db = db || getDatabase();
    this.projectDao = new ProjectDAO(this.db);
    this.contextNodeDao = new ContextNodeDAO(this.db);
    this.contextEdgeDao = new ContextEdgeDAO(this.db);
    this.artifactDao = new ArtifactDAO(this.db);
    this.conversationDao = new ConversationDAO(this.db);
    this.workspaceDao = new WorkspaceDAO(this.db);
  }

  /**
   * Return complete aggregated workspace graph for a project
   */
  async getProjectGraph(projectId) {
    if (!projectId) throw new Error('projectId is required');

    // 1. Project metadata
    let project = this.projectDao.getById(projectId);
    if (!project) {
      // Demo fallback check
      if (projectId === 'proj_demo_1') {
        project = {
          id: 'proj_demo_1',
          name: 'AI-Dost Interactive Web App',
          description: 'Glassmorphism Web IDE & Autonomous AI Copilot Workspace',
          framework: 'react-vite',
          status: 'Active',
          created_at: '2026-01-15T00:00:00Z',
          updated_at: new Date().toISOString()
        };
      } else if (projectId === 'proj_demo_2') {
        project = {
          id: 'proj_demo_2',
          name: 'Python Calculator Engine',
          description: 'Standalone Python & Glassmorphic Web Calculator App',
          framework: 'python',
          status: 'Completed',
          created_at: '2026-02-01T00:00:00Z',
          updated_at: new Date().toISOString()
        };
      } else {
        project = {
          id: projectId,
          name: 'Workspace ' + projectId,
          description: 'Autonomous Project Workspace',
          framework: 'generic',
          status: 'Active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
    }

    // 2. Workspace & Files
    let workspace = null;
    try {
      workspace = this.workspaceDao.getByProjectId(projectId);
    } catch (_) {}

    let files = [];
    try {
      const fileRows = this.db.prepare('SELECT path, content, last_modified FROM workspace_files WHERE project_id = ?').all(projectId);
      if (fileRows && fileRows.length > 0) {
        files = fileRows.map(f => ({ path: f.path, size: (f.content || '').length, lastModified: f.last_modified }));
      }
    } catch (_) {}

    if (files.length === 0) {
      files = [
        { path: 'src/App.jsx', size: 1240, lastModified: project.created_at },
        { path: 'src/main.jsx', size: 450, lastModified: project.created_at },
        { path: 'src/index.css', size: 820, lastModified: project.created_at },
        { path: 'package.json', size: 680, lastModified: project.created_at },
        { path: 'README.md', size: 1420, lastModified: project.created_at }
      ];
    }

    // 3. Conversations bound to this project
    let conversations = [];
    try {
      conversations = this.conversationDao.listByProject(projectId);
    } catch (_) {}

    if (conversations.length === 0) {
      conversations = [
        { id: `conv_${projectId}_main`, title: `${project.name} Architecture & Design`, surface: 'chat', created_at: project.created_at },
        { id: `conv_${projectId}_impl`, title: 'Component Implementation & Animation', surface: 'copilot', created_at: project.created_at }
      ];
    }

    // 4. Artifacts (Documents, Research, Images)
    let artifacts = [];
    try {
      artifacts = this.artifactDao.listByProject(projectId);
    } catch (_) {}

    // Check disk for generated downloads (documents, research)
    const downloadsDir = path.resolve(__dirname, '../../frontend/public/downloads');
    let diskDownloads = [];
    if (fs.existsSync(downloadsDir)) {
      try {
        const filesOnDisk = fs.readdirSync(downloadsDir);
        diskDownloads = filesOnDisk.map(filename => {
          const ext = path.extname(filename).toLowerCase().replace('.', '');
          const stat = fs.statSync(path.join(downloadsDir, filename));
          let type = 'document';
          if (['png', 'jpg', 'webp', 'svg'].includes(ext)) type = 'image';
          else if (filename.includes('research') || filename.includes('report')) type = 'research';
          return {
            id: `disk_${filename}`,
            name: filename,
            type,
            format: ext,
            url: `/downloads/${filename}`,
            sizeBytes: stat.size,
            createdAt: stat.birthtime.toISOString()
          };
        });
      } catch (_) {}
    }

    const documents = [
      ...artifacts.filter(a => ['document', 'pdf', 'docx', 'xlsx', 'pptx', 'csv'].includes(a.type)),
      ...diskDownloads.filter(d => ['pdf', 'docx', 'xlsx', 'pptx', 'csv'].includes(d.format))
    ];

    const researchReports = [
      ...artifacts.filter(a => a.type === 'research'),
      ...diskDownloads.filter(d => d.type === 'research' || d.name.includes('research'))
    ];

    const imageAssets = [
      ...artifacts.filter(a => a.type === 'image'),
      ...diskDownloads.filter(d => d.type === 'image')
    ];

    // 5. Context Nodes & Edges (Universal Work Graph)
    let nodes = [];
    let edges = [];
    try {
      nodes = this.contextNodeDao.listByProject(projectId);
      edges = this.contextEdgeDao.listByProject(projectId);
    } catch (_) {}

    // Auto-seed default graph nodes if project has none
    if (nodes.length === 0) {
      nodes = this._seedDefaultNodes(projectId, project);
      edges = this._seedDefaultEdges(projectId, nodes);
    }

    // Stats summary
    const stats = {
      filesCount: files.length,
      conversationsCount: conversations.length,
      documentsCount: documents.length,
      researchCount: researchReports.length,
      imagesCount: imageAssets.length,
      nodesCount: nodes.length,
      edgesCount: edges.length
    };

    return {
      project,
      workspace,
      stats,
      nodes,
      edges,
      files,
      conversations,
      documents,
      research: researchReports,
      images: imageAssets
    };
  }

  /**
   * Add a new context node to the project graph
   */
  async addContextNode(projectId, { nodeType = 'goal', title, contentSummary = '', rawRef = null }) {
    if (!projectId || !title) throw new Error('projectId and title are required');
    const id = `node_${uuidv4().slice(0, 8)}`;
    const node = this.contextNodeDao.create({
      id,
      projectId,
      nodeType,
      title,
      contentSummary,
      rawRef
    });
    return node;
  }

  /**
   * Add a relationship edge between two nodes
   */
  async addContextEdge(projectId, { sourceNodeId, targetNodeId, relationType = 'relates_to', weight = 1.0 }) {
    if (!projectId || !sourceNodeId || !targetNodeId) {
      throw new Error('projectId, sourceNodeId, and targetNodeId are required');
    }
    const id = `edge_${uuidv4().slice(0, 8)}`;
    const edge = this.contextEdgeDao.create({
      id,
      projectId,
      sourceNodeId,
      targetNodeId,
      relationType,
      weight
    });
    return edge;
  }

  /**
   * Delete node and linked edges
   */
  async deleteContextNode(projectId, nodeId) {
    if (!projectId || !nodeId) throw new Error('projectId and nodeId are required');
    return this.contextNodeDao.delete(nodeId, projectId);
  }

  /**
   * Delete edge
   */
  async deleteContextEdge(projectId, edgeId) {
    if (!projectId || !edgeId) throw new Error('projectId and edgeId are required');
    return this.contextEdgeDao.delete(edgeId, projectId);
  }

  /**
   * Bind external asset (artifact/document) to project
   */
  async bindAsset(projectId, { name, type = 'document', mimeType = 'application/octet-stream', storagePath, sizeBytes = 0, metadata = {} }) {
    if (!projectId || !name || !storagePath) throw new Error('projectId, name, and storagePath are required');
    const id = `art_${uuidv4().slice(0, 8)}`;
    const artifact = this.artifactDao.create({
      id,
      projectId,
      name,
      type,
      mimeType,
      storagePath,
      sizeBytes,
      metadata
    });
    return artifact;
  }

  // --- Helpers for default seeding ---
  _seedDefaultNodes(projectId, project) {
    const defaultNodesData = [
      { id: `node_${projectId}_goal`, nodeType: 'goal', title: `${project.name} Core Goal`, contentSummary: project.description || 'Deliver responsive, production-ready AI capabilities' },
      { id: `node_${projectId}_arch`, nodeType: 'architecture', title: 'Modular System Architecture', contentSummary: `Unified framework (${project.framework || 'React + Node'}) with streaming client-server bridge` },
      { id: `node_${projectId}_code`, nodeType: 'code', title: 'Source Workspace Files', contentSummary: 'Production source tree, React components, and Node API routers' },
      { id: `node_${projectId}_research`, nodeType: 'research', title: 'Market & Technical Feasibility', contentSummary: 'Synthesized research analysis with primary citations' },
      { id: `node_${projectId}_doc`, nodeType: 'document', title: 'System Documentation & Deliverables', contentSummary: 'Exported technical documents (PDF, DOCX, XLSX)' }
    ];

    const seeded = [];
    for (const d of defaultNodesData) {
      try {
        const node = this.contextNodeDao.create({
          id: d.id,
          projectId,
          nodeType: d.nodeType,
          title: d.title,
          contentSummary: d.contentSummary
        });
        seeded.push(node);
      } catch (_) {}
    }
    return seeded;
  }

  _seedDefaultEdges(projectId, nodes) {
    if (!nodes || nodes.length < 5) return [];
    const defaultEdgesData = [
      { sourceNodeId: nodes[0].id, targetNodeId: nodes[1].id, relationType: 'defines' },
      { sourceNodeId: nodes[1].id, targetNodeId: nodes[2].id, relationType: 'implements' },
      { sourceNodeId: nodes[3].id, targetNodeId: nodes[0].id, relationType: 'informs' },
      { sourceNodeId: nodes[2].id, targetNodeId: nodes[4].id, relationType: 'documents' }
    ];

    const seeded = [];
    for (const e of defaultEdgesData) {
      try {
        const edge = this.contextEdgeDao.create({
          id: `edge_${uuidv4().slice(0, 8)}`,
          projectId,
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          relationType: e.relationType,
          weight: 1.0
        });
        seeded.push(edge);
      } catch (_) {}
    }
    return seeded;
  }
}

module.exports = ProjectGraphService;
