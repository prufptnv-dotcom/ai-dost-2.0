const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { getDatabase } = require('../db');
const ArtifactDAO = require('../db/dao/ArtifactDAO');
const projectService = require('./projectService');
const workspaceManager = require('./workspaceManager');
const logger = require('../logger');

const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.md': 'text/markdown'
};

class ArtifactService {
  constructor(db = null) {
    this._db = db;
  }

  get db() {
    return this._db || getDatabase();
  }

  get dao() {
    return new ArtifactDAO(this.db);
  }

  /**
   * Helper: Calculate SHA-256 hash of a file or buffer
   */
  calculateSha256(input) {
    if (Buffer.isBuffer(input)) {
      return crypto.createHash('sha256').update(input).digest('hex');
    }
    if (typeof input === 'string' && fs.existsSync(input)) {
      const content = fs.readFileSync(input);
      return crypto.createHash('sha256').update(content).digest('hex');
    }
    return '';
  }

  /**
   * Validate that a file path is safe and within approved roots
   */
  validatePath(filePath, projectId = 'default') {
    if (!filePath || typeof filePath !== 'string') return { valid: false, reason: 'Empty path' };
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.includes('../') || normalized.includes('..\\')) {
      return { valid: false, reason: 'Path traversal blocked' };
    }

    const blockedSecrets = ['.env', '.pem', '.key', 'id_rsa', 'secrets.json', 'credentials'];
    const basename = path.basename(filePath).toLowerCase();
    if (blockedSecrets.some(sec => basename.includes(sec))) {
      return { valid: false, reason: 'Access to sensitive file blocked' };
    }

    const resolved = path.resolve(filePath);
    const approvedRoots = [
      path.resolve(path.join(__dirname, '../../frontend/public/downloads')),
      path.resolve(path.join(__dirname, '../uploads')),
      path.resolve(workspaceManager.getWorkspacePath(projectId)),
      path.resolve(os.tmpdir())
    ];

    const isInsideApproved = approvedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep));
    if (!isInsideApproved) {
      return { valid: false, reason: 'Path is outside approved workspace/artifact directories' };
    }

    return { valid: true, resolvedPath: resolved };
  }

  /**
   * Canonical File Registration Entry Point
   */
  registerFile({
    filePath,
    projectId = 'default',
    conversationId = null,
    taskId = null,
    name = null,
    type = null,
    mimeType = null,
    metadata = {},
    userId = 'local-user'
  }) {
    if (!filePath) {
      throw new Error('filePath is required for artifact registration');
    }

    // 1. Verify Project context
    const { project } = projectService.resolveProject(projectId, userId);
    const validProjId = project.id;

    // 2. Validate Path Security
    const pathCheck = this.validatePath(filePath, validProjId);
    if (!pathCheck.valid) {
      throw new Error(`Security error during artifact registration: ${pathCheck.reason}`);
    }

    const resolved = pathCheck.resolvedPath;
    if (!fs.existsSync(resolved)) {
      throw new Error(`File does not exist at path: ${resolved}`);
    }

    // 3. Compute File Attributes
    const stats = fs.statSync(resolved);
    const sizeBytes = stats.size;
    const sha256 = this.calculateSha256(resolved);
    const fileName = name || path.basename(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const resolvedMime = mimeType || MIME_MAP[ext] || 'application/octet-stream';
    const inferredType = type || (resolvedMime.startsWith('image/') ? 'generated_image' : 'document_' + ext.replace('.', ''));

    // 4. Compute Uniform Storage Path (relative to standard roots or web path)
    let storagePath = resolved;
    const downloadsRoot = path.resolve(path.join(__dirname, '../../frontend/public/downloads'));
    const uploadsRoot = path.resolve(path.join(__dirname, '../uploads'));
    const wsRoot = path.resolve(workspaceManager.getWorkspacePath(validProjId));

    if (resolved.startsWith(downloadsRoot)) {
      storagePath = `/downloads/${path.basename(resolved)}`;
    } else if (resolved.startsWith(uploadsRoot)) {
      storagePath = `/uploads/${path.basename(resolved)}`;
    } else if (resolved.startsWith(wsRoot)) {
      storagePath = path.relative(wsRoot, resolved).replace(/\\/g, '/');
    }

    // 5. Check Idempotency
    const existing = this.dao.getByPath(validProjId, storagePath);
    if (existing) {
      if (existing.sha256 === sha256) {
        logger.info(`[ArtifactService] Reusing existing registered artifact: ${existing.id} (${fileName})`);
        return existing;
      }
      // If content changed, delete existing entry to replace with fresh metadata
      this.dao.delete(existing.id, validProjId);
    }

    // 6. Create Artifact in Universal DB
    const artifactId = `art_${crypto.randomUUID().substring(0, 12)}`;
    const artifact = this.dao.create({
      id: artifactId,
      projectId: validProjId,
      conversationId,
      taskId,
      name: fileName,
      type: inferredType,
      mimeType: resolvedMime,
      storagePath,
      sizeBytes,
      sha256,
      metadata: {
        ...metadata,
        registeredAt: new Date().toISOString(),
        originalPath: resolved
      }
    });

    logger.info(`[ArtifactService] Successfully registered artifact: ${artifact.id} (${artifact.name}, ${artifact.size_bytes} bytes, SHA: ${artifact.sha256.substring(0, 8)})`);
    return artifact;
  }

  /**
   * Lookup artifact by ID
   */
  getArtifact(id, projectId = null) {
    return this.dao.getById(id, projectId);
  }

  /**
   * List artifacts belonging to a project
   */
  listProjectArtifacts(projectId, type = null) {
    return this.dao.listByProject(projectId, type);
  }

  /**
   * Delete an artifact record
   */
  deleteArtifact(id, projectId = null) {
    return this.dao.delete(id, projectId);
  }
}

const defaultInstance = new ArtifactService();
defaultInstance.ArtifactService = ArtifactService;

module.exports = defaultInstance;
