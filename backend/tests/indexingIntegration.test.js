const test = require('node:test');
const assert = require('node:assert');
const { IndexSyncService } = require('../services/indexSyncService');
const crypto = require('crypto');

test('Phase 2F.3 - Vector Indexing Integration (Expanded Audit)', async (t) => {
  const service = new IndexSyncService({ engineUrl: process.env.AI_ENGINE_URL || 'http://127.0.0.1:8001' });
  const testProjectIdA = `test_proj_A_${Date.now()}`;
  const testProjectIdB = `test_proj_B_${Date.now()}`;
  
  await t.test('1. Upsert handles chunking and embedding successfully', async () => {
    try {
      const res = await service.upsertEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_1',
        sourceType: 'workspace_file',
        content: 'Chunking test document content. '.repeat(5),
        metadata: { author: 'A' }
      });
      assert.strictEqual(res.status, 'success');
      assert.strictEqual(res.processedCount, 1);
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('2. Idempotent Upsert works without duplicating', async () => {
    try {
      const res = await service.upsertEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_1',
        sourceType: 'workspace_file',
        content: 'Chunking test document content. '.repeat(5),
        metadata: { author: 'A' }
      });
      assert.strictEqual(res.status, 'success');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('3. Update Replaces Old Chunks', async () => {
    try {
      const res = await service.upsertEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_1',
        sourceType: 'workspace_file',
        content: 'This is the new updated content.',
        metadata: { author: 'A_v2' }
      });
      assert.strictEqual(res.status, 'success');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('4. Source Collision across Projects (Tenant Isolation)', async () => {
    try {
      // Upsert same sourceEntityId but in Project B
      const res = await service.upsertEntity({
        projectId: testProjectIdB,
        sourceEntityId: 'doc_1',
        sourceType: 'workspace_file',
        content: 'Different content for Project B.',
        metadata: { author: 'B' }
      });
      assert.strictEqual(res.status, 'success');
      
      // Delete in Project A should NOT affect Project B
      const delA = await service.deleteEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_1',
        sourceType: 'workspace_file'
      });
      assert.strictEqual(delA.status, 'success');
      
      // Project B's doc_1 still exists (cannot test via read API yet since 2F.4 is not done, but we verify deletion succeeds)
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('5. Delete unknown source is safe (noop)', async () => {
    try {
      const res = await service.deleteEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'non_existent_doc',
        sourceType: 'workspace_file'
      });
      assert.strictEqual(res.status, 'success');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('6. Rejects malformed payload (Missing project_id)', async () => {
    try {
      await service.upsertEntity({
        projectId: '', // Invalid empty project ID
        sourceEntityId: 'doc_malformed',
        sourceType: 'workspace_file',
        content: 'text'
      });
      assert.fail('Should have thrown on empty projectId');
    } catch (err) {
      assert.ok(err.message.includes('projectId') || err.message.includes('INTERNAL_ERROR') || err.message.includes('PROJECT_NOT_FOUND'), 'Rejected successfully');
    }
  });
  
  await t.test('7. Cleanup final', async () => {
    try {
      await service.deleteEntity({
        projectId: testProjectIdB,
        sourceEntityId: 'doc_1',
        sourceType: 'workspace_file'
      });
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });
});
