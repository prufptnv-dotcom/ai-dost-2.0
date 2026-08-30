const crypto = require('crypto');

class ContextAssembler {
  /**
   * @param {Object} deps
   * @param {Object} deps.projectAuthService
   * @param {Object} deps.workspaceManager
   * @param {Object} deps.toolRegistry
   * @param {Object} deps.projectDao
   * @param {Object} deps.retrievalService
   * @param {Object} deps.contextBudgetManager
   * @param {Object} deps.contextNodeDao
   * @param {Object} deps.artifactDao
   * @param {Object} deps.conversationDao
   */
  constructor(deps) {
    this.projectAuthService = deps.projectAuthService;
    this.workspaceManager = deps.workspaceManager;
    this.toolRegistry = deps.toolRegistry;
    this.projectDao = deps.projectDao;
    this.retrievalService = deps.retrievalService;
    this.contextBudgetManager = deps.contextBudgetManager;
    
    // Fallback/canonical DAOs
    this.contextNodeDao = deps.contextNodeDao;
    this.artifactDao = deps.artifactDao;
    this.conversationDao = deps.conversationDao;
  }

  /**
   * @param {string} projectId 
   * @param {string} userId 
   * @param {string} [intent] - The user intent / query 
   */
  async assemble(projectId, userId, intent = '') {
    // 1. Authorize explicitly
    const auth = this.projectAuthService.authorize(projectId, { user: { id: userId } });
    if (!auth.authorized) {
      throw new Error(`Context Assembly Failed: ${auth.error}`);
    }

    // 2. Fetch Canonical Project Metadata
    const project = this.projectDao.getById(projectId);
    if (!project) {
      throw new Error(`Context Assembly Failed: Project ${projectId} not found in database.`);
    }

    // 3. Fetch Workspace Metadata (Read-Only context bounds)
    let workspaceMeta = null;
    try {
      workspaceMeta = this.workspaceManager.getWorkspaceMetadata(projectId, userId);
    } catch (err) {
      throw new Error(`Context Assembly Failed: Could not resolve workspace metadata - ${err.message}`);
    }

    const availableTools = this.toolRegistry.list();

    const rawItems = [];

    // 4. Add Mandatory Context (System, Project, User Request)
    rawItems.push({
      source_id: 'sys_core',
      category: 'SYSTEM',
      is_mandatory: true,
      content: `Available Tools: ${availableTools.map(t => t.name).join(', ')}`
    });

    rawItems.push({
      source_id: `proj_${project.id}`,
      category: 'PROJECT',
      is_mandatory: true,
      content: JSON.stringify({ id: project.id, name: project.name, framework: project.framework }),
      project_id: projectId
    });

    if (intent) {
      rawItems.push({
        source_id: 'user_req',
        category: 'USER_REQUEST',
        is_mandatory: true,
        content: intent,
        project_id: projectId
      });
    }

    // 5. Add Workspace Context
    if (workspaceMeta) {
      rawItems.push({
        source_id: 'workspace_meta',
        category: 'WORKSPACE',
        content: JSON.stringify(workspaceMeta),
        project_id: projectId
      });
    }

    // 6. Retrieval Integration (Semantic/Hybrid)
    let retrievalStatus = 'SUCCESS';
    if (intent && this.retrievalService) {
      try {
        // Simple deterministic retrieval policy: 
        // If it's a short exact query or looks like a file path, we might use EXACT/FULL_TEXT, 
        // otherwise HYBRID for general reasoning.
        const isShortExact = intent.length < 20 && !intent.includes(' ');
        const mode = isShortExact ? 'FULL_TEXT' : 'HYBRID';
        
        const retrieved = await this.retrievalService.search({
          userId,
          projectId,
          query: intent,
          mode: mode,
          limit: 15
        });

        // Canonical Source Hydration
        for (const item of retrieved) {
          // Double check project isolation just in case
          if (item.project_id !== projectId) continue;

          let canonicalContent = null;
          let isStale = false;
          
          // Hydrate from canonical sources based on type
          if (item.source_type === 'workspace_file') {
             // Ask workspace manager for file content
             try {
                // Assuming source_entity_id is the file path or ID
                canonicalContent = this.workspaceManager.readFile(projectId, item.source_entity_id);
             } catch (err) {
                // File deleted or inaccessible
                continue; // Discard result
             }
          } else if (item.source_type === 'context_node' && this.contextNodeDao) {
             const node = this.contextNodeDao.getById(item.source_entity_id, projectId);
             if (!node) continue;
             canonicalContent = node.content_summary || node.title;
          } else if (item.source_type === 'artifact' && this.artifactDao) {
             // Wait, does artifactDao have getById? Yes, in Phase 2.
             const artifact = this.artifactDao.getById(item.source_entity_id, projectId);
             if (!artifact) continue;
             canonicalContent = artifact.content;
          } else {
             // For unsupported types, we might just trust the metadata if it has snippets, but we shouldn't.
             continue; 
          }

          if (canonicalContent) {
            rawItems.push({
              source_id: item.source_entity_id,
              source_type: item.source_type,
              category: 'RETRIEVAL',
              relevance: item.score,
              authority: 0.6, // Will be overridden by category defaults in budget manager anyway
              is_stale: isStale,
              content: canonicalContent,
              version_hash: item.version_hash,
              project_id: projectId
            });
          }
        }
      } catch (err) {
        if (err.message.includes('INDEX_UNAVAILABLE') || err.message.includes('timeout')) {
          retrievalStatus = 'UNAVAILABLE';
          // Gracefully degrade: do nothing, proceed with non-RAG context
        } else {
          // Other errors might be auth/bad requests which we want to surface, but for agent robustness we log and continue
          console.error(`[ContextAssembler] Retrieval error: ${err.message}`);
          retrievalStatus = 'ERROR';
        }
      }
    } else if (!this.retrievalService) {
      retrievalStatus = 'NOT_CONFIGURED';
    }

    // 7. Context Budget Manager Allocation
    let finalPackage;
    if (this.contextBudgetManager) {
      const budgetResult = this.contextBudgetManager.packageContext({ projectId, items: rawItems });
      finalPackage = budgetResult.package;
      finalPackage.metadata = {
        ...budgetResult.metadata,
        retrieval_status: retrievalStatus
      };
    } else {
      // Fallback if no budget manager injected
      finalPackage = {
        system: rawItems.filter(i => i.category === 'SYSTEM'),
        project: rawItems.filter(i => i.category === 'PROJECT'),
        user_request: rawItems.filter(i => i.category === 'USER_REQUEST'),
        workspace: rawItems.filter(i => i.category === 'WORKSPACE'),
        metadata: { retrieval_status: retrievalStatus }
      };
    }

    return finalPackage;
  }
}

module.exports = ContextAssembler;
