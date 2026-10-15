const test = require('node:test');
const assert = require('node:assert');
const { RetrievalService } = require('../services/retrievalService');

test('RetrievalService - Phase 2F.1 Contract Tests', async (t) => {
  // Mock the apiClient internally for testing without spinning up Python
  const mockApi = {
    post: async (path, payload) => {
      if (path === '/ai/rag/query') {
        if (payload.query === 'malformed') return { success: true, data: { version: "1" } }; // missing results
        if (payload.query === 'bad_version') return { success: true, data: { version: "99", results: [] } };
        if (payload.query === 'leak') return {
          success: true,
          data: {
            version: "1",
            results: [{ source_entity_id: 'x', project_id: 'OTHER_PROJECT', source_type: 'artifact' }]
          }
        };

        return {
          success: true,
          data: {
            version: "1",
            results: [
              { source_entity_id: 'e1', project_id: payload.project_id, source_type: 'artifact', score: 0.9, version_hash: 'abc', chunk_id: 'c1', metadata: {} }
            ]
          }
        };
      }
    }
  };

  const service = new RetrievalService();
  service.apiClient = mockApi; // Inject mock

  await t.test('1. Valid request parses response correctly', async () => {
    const res = await service.search({ userId: 'u1', projectId: 'p1', query: 'test' });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].source_entity_id, 'e1');
  });

  await t.test('2. Missing project_id throws PROJECT_NOT_FOUND', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', query: 'test' }),
      /PROJECT_NOT_FOUND: missing project_id/
    );
  });

  await t.test('3. Missing query throws INVALID_REQUEST', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', projectId: 'p1' }),
      /INVALID_REQUEST: missing query/
    );
  });

  await t.test('4. Missing user_id throws UNAUTHORIZED', async () => {
    await assert.rejects(
      service.search({ projectId: 'p1', query: 'test' }),
      /UNAUTHORIZED: missing user_id/
    );
  });

  await t.test('5. Invalid mode throws INVALID_REQUEST', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', projectId: 'p1', query: 'test', mode: 'MAGIC' }),
      /INVALID_REQUEST: mode must be one of/
    );
  });

  await t.test('6. Invalid source type throws INVALID_REQUEST', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', projectId: 'p1', query: 'test', sourceTypes: ['magic_box'] }),
      /INVALID_REQUEST: unknown source_type/
    );
  });

  await t.test('7. Invalid limit throws INVALID_REQUEST', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', projectId: 'p1', query: 'test', limit: 500 }),
      /INVALID_REQUEST: limit must be between/
    );
  });

  await t.test('8. Malformed Python response throws INTERNAL_ERROR', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', projectId: 'p1', query: 'malformed' }),
      /INTERNAL_ERROR: missing results/
    );
  });

  await t.test('9. Version mismatch throws INTERNAL_ERROR', async () => {
    await assert.rejects(
      service.search({ userId: 'u1', projectId: 'p1', query: 'bad_version' }),
      /INTERNAL_ERROR: version mismatch/
    );
  });

  await t.test('10. Cross-project leak is filtered out', async () => {
    // If python accidentally returns data for OTHER_PROJECT, Node strips it
    const res = await service.search({ userId: 'u1', projectId: 'p1', query: 'leak' });
    assert.strictEqual(res.length, 0); // Leaked item removed
  });

  await t.test('11. Network down mapped to INDEX_UNAVAILABLE', async () => {
    const errorApi = {
      post: async () => { throw new Error('ECONNREFUSED'); }
    };
    const brokenService = new RetrievalService();
    brokenService.apiClient = errorApi;
    
    await assert.rejects(
      brokenService.search({ userId: 'u1', projectId: 'p1', query: 'test' }),
      /INDEX_UNAVAILABLE: Python AI engine is down/
    );
  });
});
