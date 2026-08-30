const { RobustApiClient } = require('./apiClient');
const { generateEntityHash } = require('../utils/hash');

class IndexSyncService {
  /**
   * @param {Object} deps
   * @param {string} deps.engineUrl - Base URL of the Python AI engine
   */
  constructor({ engineUrl = 'http://127.0.0.1:8001' } = {}) {
    this.apiClient = new RobustApiClient({ baseUrl: engineUrl, serviceName: 'ai-engine-indexer' });
    this.supportedSourceTypes = [
      'workspace_file', 
      'artifact', 
      'context_node'
    ];
  }

  /**
   * Pushes a canonical entity to the Python derived index.
   * Designed to be idempotent: repeated calls with the same hash just overwrite seamlessly in the future Vector DB.
   * 
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.sourceEntityId
   * @param {string} params.sourceType
   * @param {string} params.content - Canonical text
   * @param {Object} [params.metadata={}]
   * @returns {Object} { versionHash, status, processedCount }
   */
  async upsertEntity({ projectId, sourceEntityId, sourceType, content, metadata = {} }) {
    this._validateBaseParams(projectId, sourceEntityId, sourceType);
    
    if (typeof content !== 'string') {
      throw new Error('INVALID_REQUEST: content must be a string');
    }

    const versionHash = generateEntityHash(content, metadata);

    const payload = {
      version: "1",
      project_id: projectId,
      action: "upsert",
      documents: [
        {
          source_entity_id: sourceEntityId,
          source_type: sourceType,
          version_hash: versionHash,
          content: content,
          metadata: metadata
        }
      ]
    };

    const result = await this._sendSyncRequest(payload);
    return { versionHash, status: result.status, processedCount: result.processed_count };
  }

  /**
   * Deletes an entity from the Python derived index.
   * 
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.sourceEntityId
   * @param {string} params.sourceType
   */
  async deleteEntity({ projectId, sourceEntityId, sourceType }) {
    this._validateBaseParams(projectId, sourceEntityId, sourceType);

    const payload = {
      version: "1",
      project_id: projectId,
      action: "delete",
      documents: [
        {
          source_entity_id: sourceEntityId,
          source_type: sourceType,
          version_hash: "deleted",
          content: "",
          metadata: {}
        }
      ]
    };

    const result = await this._sendSyncRequest(payload);
    return { status: result.status, processedCount: result.processed_count };
  }

  /**
   * Compares an incoming version hash against the current canonical content's hash.
   * @param {string} currentContent 
   * @param {string} retrievedHash 
   * @param {Object} currentMetadata 
   * @returns {boolean} True if the index is stale
   */
  isStale(currentContent, retrievedHash, currentMetadata = {}) {
    const canonicalHash = generateEntityHash(currentContent, currentMetadata);
    return canonicalHash !== retrievedHash;
  }

  _validateBaseParams(projectId, sourceEntityId, sourceType) {
    if (!projectId) throw new Error('PROJECT_NOT_FOUND: missing project_id');
    if (!sourceEntityId) throw new Error('INVALID_REQUEST: missing source_entity_id');
    if (!this.supportedSourceTypes.includes(sourceType)) {
      throw new Error(`INVALID_REQUEST: unknown source_type ${sourceType}`);
    }
  }

  async _sendSyncRequest(payload) {
    try {
      const response = await this.apiClient.post('/ai/rag/index', payload);
      
      if (!response || !response.success || !response.data || response.data.status !== 'success') {
        throw new Error('INTERNAL_ERROR: malformed response from indexer');
      }
      return response.data;
    } catch (err) {
      if (err.message.includes('ECONNREFUSED') || err.message.includes('Circuit breaker: OPEN')) {
        throw new Error('INDEX_UNAVAILABLE: Python AI engine is down');
      }
      if (err.message.includes('timeout')) {
        throw new Error('INDEX_TIMEOUT: Sync request timed out');
      }
      if (err.message.startsWith('PROJECT_NOT_FOUND') || err.message.startsWith('INVALID_REQUEST')) {
        throw err;
      }
      throw new Error(`INTERNAL_ERROR: ${err.message}`);
    }
  }
}

module.exports = { IndexSyncService };


