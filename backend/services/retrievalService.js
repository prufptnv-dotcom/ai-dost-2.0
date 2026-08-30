const { RobustApiClient } = require('./apiClient');

class RetrievalService {
  /**
   * @param {Object} deps
   * @param {string} deps.engineUrl - Base URL of the Python AI engine (e.g., http://127.0.0.1:8001)
   */
  constructor({ engineUrl = 'http://127.0.0.1:8001' } = {}) {
    this.apiClient = new RobustApiClient({ baseUrl: engineUrl, serviceName: 'ai-engine-retrieval' });
    this.supportedModes = ['EXACT', 'FULL_TEXT', 'SEMANTIC', 'HYBRID'];
    this.supportedSourceTypes = [
      'workspace_file', 
      'artifact', 
      'context_node', 
      'message', 
      'execution_record', 
      'verification_result'
    ];
  }

  /**
   * Searches the derived retrieval index (Python ai-engine) securely.
   * Enforces Node.js level tenant isolation before queries hit the index.
   * 
   * @param {Object} req
   * @param {string} req.userId - Canonical user ID 
   * @param {string} req.projectId - Canonical project ID (Mandatory for isolation)
   * @param {string} req.query - The search string
   * @param {string} [req.mode='HYBRID'] - 'EXACT', 'FULL_TEXT', 'SEMANTIC', 'HYBRID'
   * @param {string[]} [req.sourceTypes=[]] - Filter to specific entity types
   * @param {number} [req.limit=10]
   */
  async search({ userId, projectId, query, mode = 'HYBRID', sourceTypes = [], limit = 10 }) {
    // 1. Enforce strict authorization boundary constraints
    if (!userId) throw new Error('UNAUTHORIZED: missing user_id');
    if (!projectId) throw new Error('PROJECT_NOT_FOUND: missing project_id');
    if (!query) throw new Error('INVALID_REQUEST: missing query');
    
    if (!this.supportedModes.includes(mode)) {
      throw new Error(`INVALID_REQUEST: mode must be one of ${this.supportedModes.join(', ')}`);
    }

    if (sourceTypes.some(st => !this.supportedSourceTypes.includes(st))) {
      throw new Error(`INVALID_REQUEST: unknown source_type requested`);
    }

    if (limit <= 0 || limit > 100) {
      throw new Error('INVALID_REQUEST: limit must be between 1 and 100');
    }

    // 2. Build explicit schema request
    const payload = {
      version: "1",
      user_id: userId,
      project_id: projectId,
      query: query,
      mode: mode,
      filters: {
        source_types: sourceTypes,
        limit: limit
      }
    };

    // 3. Execute safe retrieval via Python AI engine boundary
    try {
      const response = await this.apiClient.post('/ai/rag/query', payload);
      
      if (!response || !response.success || !response.data) {
        throw new Error('INTERNAL_ERROR: malformed response envelope from indexer');
      }
      
      const responseData = response.data;
      
      if (!responseData.results) {
        throw new Error('INTERNAL_ERROR: missing results in response');
      }
      
      if (responseData.version !== "1") {
        throw new Error('INTERNAL_ERROR: version mismatch in response');
      }

      // Ensure every returned item strictly matches the requested project scoping and format
      const validatedResults = responseData.results.filter(item => {
        // Project ID Validation
        if (item.project_id !== projectId) {
          console.error(`[RetrievalService] Security Alert: Index returned cross-project data for project_id ${item.project_id}`);
          return false;
        }
        
        // Source Type Validation
        if (!item.source_type || !this.supportedSourceTypes.includes(item.source_type)) {
          console.error(`[RetrievalService] Security Alert: Index returned invalid source_type ${item.source_type}`);
          return false;
        }
        
        // Version Hash Validation
        if (!item.version_hash || typeof item.version_hash !== 'string') {
          console.error(`[RetrievalService] Security Alert: Index returned invalid version_hash`);
          return false;
        }
        
        return true;
      });

      // Sort just to be safe, though Python should have sorted it
      validatedResults.sort((a, b) => b.score - a.score);

      return validatedResults;

    } catch (err) {
      // Normalize external failure contracts
      if (err.message.includes('ECONNREFUSED') || err.message.includes('Circuit breaker: OPEN')) {
        throw new Error('INDEX_UNAVAILABLE: Python AI engine is down');
      }
      if (err.message.includes('timeout')) {
        throw new Error('INDEX_TIMEOUT: Retrieval request timed out');
      }
      // Pass-through validation errors explicitly
      if (err.message.startsWith('UNAUTHORIZED') || err.message.startsWith('PROJECT_NOT_FOUND') || err.message.startsWith('INVALID_REQUEST') || err.message.startsWith('INTERNAL_ERROR')) {
        throw err;
      }
      throw new Error(`INTERNAL_ERROR: ${err.message}`);
    }
  }
}

module.exports = { RetrievalService };

