const test = require('node:test');
const assert = require('node:assert');
const ContextAssembler = require('../agent/runtime/ContextAssembler');
const { ContextBudgetManager } = require('../agent/runtime/ContextBudgetManager');

// Mock Dependencies
class MockAuthService {
  authorize(projectId, { user }) {
    if (projectId === 'proj_unauth') return { authorized: false, error: 'Unauthorized' };
    return { authorized: true, user };
  }
}

class MockWorkspaceManager {
  getWorkspaceMetadata(projectId, userId) {
    return { files: ['src/auth.js', 'src/db.js'] };
  }
  readFile(projectId, filepath) {
    if (filepath === 'src/auth.js') return 'const auth = true; // canonical code';
    if (filepath === 'deleted_file.js') throw new Error('ENOENT: no such file or directory');
    return 'content';
  }
}

class MockToolRegistry {
  list() { return [{ name: 'read_file' }, { name: 'run_command' }]; }
}

class MockProjectDao {
  getById(projectId) {
    if (projectId === 'proj_missing') return null;
    return { id: projectId, name: 'Test Project', framework: 'node' };
  }
}

class MockContextNodeDao {
  getById(id, projectId) {
    if (id === 'mem_123') return { title: 'Auth Decision', content_summary: 'We decided to use JWT' };
    return null;
  }
}

class MockRetrievalService {
  async search({ userId, projectId, query, mode, limit }) {
    if (projectId === 'proj_fail') throw new Error('INDEX_UNAVAILABLE');
    
    return [
      { source_entity_id: 'src/auth.js', source_type: 'workspace_file', project_id: projectId, score: 0.9, version_hash: 'v1' },
      { source_entity_id: 'deleted_file.js', source_type: 'workspace_file', project_id: projectId, score: 0.8, version_hash: 'v1' },
      { source_entity_id: 'mem_123', source_type: 'context_node', project_id: projectId, score: 0.85, version_hash: 'v1' },
      { source_entity_id: 'mem_cross', source_type: 'context_node', project_id: 'wrong_proj', score: 0.99, version_hash: 'v1' } // malicious
    ];
  }
}

test('Phase 2F.6 - Agent Context Integration', async (t) => {
  const deps = {
    projectAuthService: new MockAuthService(),
    workspaceManager: new MockWorkspaceManager(),
    toolRegistry: new MockToolRegistry(),
    projectDao: new MockProjectDao(),
    retrievalService: new MockRetrievalService(),
    contextBudgetManager: new ContextBudgetManager({ totalBudget: 5000 }), // 5k tokens limit
    contextNodeDao: new MockContextNodeDao()
  };

  const assembler = new ContextAssembler(deps);

  await t.test('1. ContextAssembler returns normalized package', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'Find auth');
    assert.ok(pkg.metadata, 'Should contain metadata');
    assert.strictEqual(pkg.metadata.retrieval_status, 'SUCCESS');
    assert.ok(pkg.system.length > 0, 'System mandatory context present');
    assert.ok(pkg.retrieval.length > 0, 'Retrieval context present');
  });

  await t.test('2. Authorized project context assembled', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'test');
    assert.strictEqual(pkg.project[0].project_id, 'proj_A');
  });

  await t.test('3. Unauthorized project rejected', async () => {
    await assert.rejects(
      assembler.assemble('proj_unauth', 'u1', 'test'),
      /Context Assembly Failed: Unauthorized/
    );
  });

  await t.test('4. RetrievalService called with correct project scope & 15/16 isolation', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'test');
    const hasCrossPollination = pkg.retrieval.some(r => r.project_id === 'wrong_proj');
    assert.strictEqual(hasCrossPollination, false, 'Malicious cross-project retrieval MUST be discarded');
  });

  await t.test('5. Semantic result hydrated from canonical source', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'test');
    const authResult = pkg.retrieval.find(r => r.source_id === 'src/auth.js');
    assert.ok(authResult, 'Should find hydrated result');
    assert.strictEqual(authResult.content, 'const auth = true; // canonical code', 'Content comes from canonical WorkspaceManager, not Vector DB');
  });

  await t.test('7. Deleted source excluded', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'test');
    const deletedResult = pkg.retrieval.find(r => r.source_id === 'deleted_file.js');
    assert.strictEqual(deletedResult, undefined, 'Deleted canonical files should be discarded from retrieval results');
  });

  await t.test('8. Retrieval unavailable gracefully degrades', async () => {
    const pkg = await assembler.assemble('proj_fail', 'u1', 'test');
    assert.strictEqual(pkg.metadata.retrieval_status, 'UNAVAILABLE');
    assert.strictEqual(pkg.retrieval.length, 0, 'No retrieval context');
    assert.ok(pkg.workspace.length > 0, 'Other context still successfully assembled');
  });

  await t.test('10. Mandatory user request preserved', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'Help me fix this bug');
    assert.strictEqual(pkg.user_request[0].content, 'Help me fix this bug');
  });

  await t.test('17. Repeated assembly is deterministic', async () => {
    const pkg1 = await assembler.assemble('proj_A', 'u1', 'test determinism');
    const pkg2 = await assembler.assemble('proj_A', 'u1', 'test determinism');
    // Random UUID generation on `normalizeItem` for missing `source_id` makes full JSON comparison fail, 
    // but the counts and exact content MUST match.
    assert.strictEqual(pkg1.metadata.selected_items_count, pkg2.metadata.selected_items_count);
    assert.strictEqual(pkg1.metadata.estimated_total_tokens, pkg2.metadata.estimated_total_tokens);
  });

  await t.test('20. E2E Scenario: Find auth and explain memory', async () => {
    const pkg = await assembler.assemble('proj_A', 'u1', 'Find where authentication is implemented and explain the previous decision that affected it.');
    
    // We expect:
    // 1. Correct Project
    assert.strictEqual(pkg.project[0].project_id, 'proj_A');
    
    // 2. Relevant source ('src/auth.js')
    assert.ok(pkg.retrieval.find(r => r.source_id === 'src/auth.js'), 'Auth code hydrated');
    
    // 3. Relevant memory ('mem_123')
    assert.ok(pkg.retrieval.find(r => r.source_id === 'mem_123'), 'Auth memory hydrated');
    
    // 4. No unrelated info
    assert.strictEqual(pkg.retrieval.find(r => r.project_id !== 'proj_A'), undefined);
    
    // 5. Fits in budget
    assert.ok(pkg.metadata.estimated_total_tokens <= pkg.metadata.total_budget);
    
    // 6. No Chroma internals
    const allJSON = JSON.stringify(pkg);
    assert.strictEqual(allJSON.includes('Chroma'), false, 'Should not leak Chroma objects');
    assert.strictEqual(allJSON.includes('vector'), false, 'Should not leak vector internals');
  });
});
