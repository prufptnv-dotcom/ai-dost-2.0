const test = require('node:test');
const assert = require('node:assert');
const { generateEntityHash } = require('../utils/hash');
const { IndexSyncService } = require('../services/indexSyncService');

test('Phase 2F.2 - Indexing Sync Pipeline', async (t) => {

  await t.test('Hash Determinism & Content Independence', async () => {
    const text1 = "function foo() { return true; }";
    const text2 = "function foo() { return false; }";
    
    const h1 = generateEntityHash(text1);
    const h2 = generateEntityHash(text2);
    const h1_repeat = generateEntityHash(text1);
    
    assert.strictEqual(h1, h1_repeat, 'Hash must be fully deterministic');
    assert.notStrictEqual(h1, h2, 'Different content must have different hashes');

    const h3 = generateEntityHash(text1, { b: 2, a: 1 });
    const h4 = generateEntityHash(text1, { a: 1, b: 2 });
    assert.strictEqual(h3, h4, 'Metadata key order must not alter the hash');
    assert.notStrictEqual(h1, h3, 'Metadata changes must alter the hash');
  });

  await t.test('IndexSyncService Contract', async (st) => {
    
    let lastPayload = null;
    const mockApi = {
      post: async (path, payload) => {
        if (path === '/ai/rag/index') {
          if (payload.action === 'upsert' && payload.documents[0].content === 'fail') {
            throw new Error('INTERNAL_ERROR: crash');
          }
          lastPayload = payload;
          return { status: "success", processed_count: payload.documents.length };
        }
      }
    };

    const service = new IndexSyncService();
    service.apiClient = mockApi;

    await st.test('1. Valid Upsert Push', async () => {
      const res = await service.upsertEntity({
        projectId: 'p1',
        sourceEntityId: 'file_1',
        sourceType: 'workspace_file',
        content: 'hello world'
      });
      
      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.processedCount, 1);
      assert.strictEqual(lastPayload.action, 'upsert');
      assert.strictEqual(lastPayload.project_id, 'p1');
      assert.strictEqual(lastPayload.documents[0].version_hash, res.versionHash);
    });

    await st.test('2. Missing project_id throws PROJECT_NOT_FOUND', async () => {
      await assert.rejects(
        service.upsertEntity({ sourceEntityId: 'f1', sourceType: 'artifact', content: 'x' }),
        /PROJECT_NOT_FOUND: missing project_id/
      );
    });

    await st.test('3. Invalid source_type throws INVALID_REQUEST', async () => {
      await assert.rejects(
        service.upsertEntity({ projectId: 'p1', sourceEntityId: 'f1', sourceType: 'magic', content: 'x' }),
        /INVALID_REQUEST: unknown source_type magic/
      );
    });

    await st.test('4. Delete push creates tombstone payload', async () => {
      const res = await service.deleteEntity({
        projectId: 'p2',
        sourceEntityId: 'mem_1',
        sourceType: 'context_node'
      });

      assert.strictEqual(res.status, 'success');
      assert.strictEqual(lastPayload.action, 'delete');
      assert.strictEqual(lastPayload.documents[0].version_hash, 'deleted');
    });

    await st.test('5. Stale index detection', async () => {
      const content = 'latest code';
      const retrievedHash = generateEntityHash('old code');
      
      assert.strictEqual(service.isStale(content, retrievedHash), true);
      assert.strictEqual(service.isStale(content, generateEntityHash(content)), false);
    });

    await st.test('6. Network Failure maps to INDEX_UNAVAILABLE', async () => {
      const brokenService = new IndexSyncService();
      brokenService.apiClient = { post: async () => { throw new Error('ECONNREFUSED'); } };
      
      await assert.rejects(
        brokenService.upsertEntity({ projectId: 'p1', sourceEntityId: 'x', sourceType: 'artifact', content: 'c' }),
        /INDEX_UNAVAILABLE/
      );
    });
  });
});
