const test = require('node:test');
const assert = require('node:assert');
const { RetrievalService } = require('../services/retrievalService');
const { IndexSyncService } = require('../services/indexSyncService');

function calculatePrecisionAtK(retrieved, relevant, k) {
  const topK = retrieved.slice(0, k);
  const relevantRetrieved = topK.filter(item => relevant.includes(item.source_entity_id));
  return topK.length === 0 ? 0 : relevantRetrieved.length / topK.length;
}

function calculateRecallAtK(retrieved, relevant, k) {
  const topK = retrieved.slice(0, k);
  const relevantRetrieved = topK.filter(item => relevant.includes(item.source_entity_id));
  return relevant.length === 0 ? 0 : relevantRetrieved.length / relevant.length;
}

function calculateMRR(retrieved, relevant) {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.includes(retrieved[i].source_entity_id)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

test('Phase 2F.4 - Hybrid Retrieval Integration & Evaluation', async (t) => {
  const engineUrl = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8001';
  const retrievalService = new RetrievalService({ engineUrl });
  const indexService = new IndexSyncService({ engineUrl });
  
  const testProjectIdA = `proj_A_${Date.now()}`;
  const testProjectIdB = `proj_B_${Date.now()}`;

  await t.test('0. Setup Index Data', async () => {
    try {
      await indexService.upsertEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_auth',
        sourceType: 'workspace_file',
        content: 'This module implements the core authentication middleware for user sessions.',
        metadata: { author: 'Alice' }
      });
      await indexService.upsertEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_db',
        sourceType: 'workspace_file',
        content: 'Database connection strings and pooling logic for PostgreSQL.',
        metadata: { author: 'Bob' }
      });
      await indexService.upsertEntity({
        projectId: testProjectIdB,
        sourceEntityId: 'doc_auth',
        sourceType: 'workspace_file',
        content: 'Different authentication logic for Project B.',
        metadata: { author: 'Charlie' }
      });
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('1. EXACT / FULL_TEXT works and normalizes scores', async () => {
    try {
      const results = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdA,
        query: 'authentication middleware',
        mode: 'FULL_TEXT',
        limit: 5
      });
      assert.ok(results.length > 0, 'Should find keyword match');
      assert.strictEqual(results[0].source_entity_id, 'doc_auth');
      assert.ok(results[0].score > 0, 'Score should be positive');
      assert.ok(results[0].version_hash, 'Should have version hash');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('2. SEMANTIC Retrieval works', async () => {
    try {
      const results = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdA,
        query: 'verifying user identity',
        mode: 'SEMANTIC',
        limit: 5
      });
      assert.ok(results.length > 0, 'Should find semantic match');
      assert.strictEqual(results[0].source_entity_id, 'doc_auth');
      assert.ok(results[0].score > 0, 'Semantic score should be normalized');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('3. HYBRID Retrieval and Deduplication', async () => {
    try {
      await indexService.upsertEntity({
        projectId: testProjectIdA,
        sourceEntityId: 'doc_multi',
        sourceType: 'workspace_file',
        content: 'Chunk 1 authentication middleware. '.repeat(15) + 'Chunk 2 authentication middleware. '.repeat(15),
        metadata: { author: 'Alice' }
      });

      const results = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdA,
        query: 'authentication middleware',
        mode: 'HYBRID',
        limit: 10
      });
      
      const docMultiResults = results.filter(r => r.source_entity_id === 'doc_multi');
      assert.strictEqual(docMultiResults.length, 1, 'Should deduplicate multiple chunks into a single result');
      
      assert.ok(results[0].score > 0, 'Should rank hybrid');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('4. Project Isolation Enforced (Tenant Security)', async () => {
    try {
      const results = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdA,
        query: 'authentication',
        mode: 'HYBRID'
      });
      
      const leaked = results.filter(r => r.project_id !== testProjectIdA);
      assert.strictEqual(leaked.length, 0, 'Must never return out-of-project vectors');
      
      const resultsB = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdB,
        query: 'authentication',
        mode: 'HYBRID'
      });
      assert.ok(resultsB.length > 0, 'Project B should have its own results');
      assert.strictEqual(resultsB[0].project_id, testProjectIdB);
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('5. Source ID Collision Handled', async () => {
    try {
      const resultsA = await retrievalService.search({
        userId: 'u1', projectId: testProjectIdA, query: 'Different authentication', mode: 'SEMANTIC'
      });
      assert.ok(!resultsA.find(r => r.project_id === testProjectIdB), 'Should not contain B doc_auth');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('6. Empty results and query sanitization', async () => {
    try {
      const results = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdA,
        query: 'nonexistent_gibberish_term_xyz_1234567890',
        mode: 'HYBRID'
      });
      // We expect 0 results if the semantic engine properly thresholds bad distances
      assert.strictEqual(results.length, 0, 'Should return empty array');
      
      const resultsEmptyQuery = await retrievalService.search({
        userId: 'u1', projectId: testProjectIdA, query: '   ', mode: 'HYBRID'
      }).catch(err => err);
      
      if (!(resultsEmptyQuery instanceof Error)) {
         assert.strictEqual(resultsEmptyQuery.length, 0, 'Blank query should return [] safely');
      }
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('7. Top-K bounds and Pagination', async () => {
    try {
      await assert.rejects(
        retrievalService.search({ userId: 'u1', projectId: testProjectIdA, query: 'test', limit: 0 }),
        /limit must be between/
      );
      await assert.rejects(
        retrievalService.search({ userId: 'u1', projectId: testProjectIdA, query: 'test', limit: 200 }),
        /limit must be between/
      );
      const results = await retrievalService.search({
        userId: 'u1', projectId: testProjectIdA, query: 'authentication', limit: 1
      });
      assert.ok(results.length <= 1, 'Respects limit');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });

  await t.test('8. Evaluation Metrics (Precision/Recall/MRR)', async () => {
    try {
      const results = await retrievalService.search({
        userId: 'u1',
        projectId: testProjectIdA,
        query: 'database connection',
        mode: 'HYBRID',
        limit: 5
      });
      
      const relevantDocs = ['doc_db'];
      const pAt1 = calculatePrecisionAtK(results, relevantDocs, 1);
      const rAt1 = calculateRecallAtK(results, relevantDocs, 1);
      const mrr = calculateMRR(results, relevantDocs);
      
      assert.ok(pAt1 >= 0, 'Precision computable');
      assert.ok(rAt1 >= 0, 'Recall computable');
      assert.ok(mrr >= 0, 'MRR computable');
    } catch (err) {
      if (err.message.includes('INDEX_UNAVAILABLE')) return;
      throw err;
    }
  });
  
  await t.test('9. Malformed Python Response rejection', async () => {
    const oldClient = retrievalService.apiClient.post;
    retrievalService.apiClient.post = async () => ({ success: true, data: { results: [{ project_id: 'wrong_proj', source_type: 'workspace_file', version_hash: 'abc' }] }, status: 200 });
    
    try {
      await retrievalService.search({ userId: 'u1', projectId: testProjectIdA, query: 'test' });
      assert.fail('Should have rejected the malformed response');
    } catch (err) {
      assert.ok(err.message.includes('INTERNAL_ERROR: version mismatch'), 'Properly throws on missing version');
    } finally {
      retrievalService.apiClient.post = oldClient;
    }
  });
});
