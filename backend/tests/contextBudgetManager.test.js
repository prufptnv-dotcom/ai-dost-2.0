const test = require('node:test');
const assert = require('node:assert');
const { ContextBudgetManager } = require('../agent/runtime/ContextBudgetManager');

test('Phase 2F.5 - Context Budget Manager', async (t) => {
  const projectId = 'test_proj_123';
  const scopeItems = (items) => items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (item.project_id != null ||
        (item.category === 'SYSTEM' && item.source_id === 'sys_core' && item.is_mandatory === true)) {
      return item;
    }
    return { ...item, project_id: projectId };
  });
  
  await t.test('1. token estimation', () => {
    const budgetMgr = new ContextBudgetManager();
    const str = '12345678';
    assert.strictEqual(budgetMgr.estimateTokens(str), 2, '8 chars should equal 2 tokens');
  });

  await t.test('2. configurable total budget', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 50 });
    const items = [
      { source_id: 'a', content: 'A'.repeat(160), category: 'WORKSPACE' }, // 40 tokens
      { source_id: 'b', content: 'B'.repeat(80), category: 'WORKSPACE' }   // 20 tokens
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1, 'Should only fit one item in 50 budget');
    assert.ok(res.metadata.estimated_total_tokens <= 50, 'Budget strictly enforced');
  });

  await t.test('3. mandatory context preservation (oversized)', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 10 });
    const items = [
      { source_id: 'm1', content: 'M'.repeat(80), category: 'SYSTEM', is_mandatory: true } // 20 tokens
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1, 'Mandatory item MUST be preserved even if it blows the budget');
    assert.strictEqual(res.metadata.estimated_total_tokens, 20);
  });

  await t.test('4. optional context trimming & 5. deterministic ordering', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 100 });
    const items = [
      { source_id: 'opt_low', content: 'L'.repeat(40), category: 'RETRIEVAL', relevance: 0.1 }, // 10 tokens
      { source_id: 'opt_high', content: 'H'.repeat(40), category: 'WORKSPACE', relevance: 1.0 } // 10 tokens
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.package.workspace[0].source_id, 'opt_high', 'High score should be first optional');
  });

  await t.test('6. deduplication', () => {
    const budgetMgr = new ContextBudgetManager();
    const items = [
      { source_id: 'same', content: 'hello', category: 'RETRIEVAL', relevance: 0.5 },
      { source_id: 'same', content: 'hello', category: 'WORKSPACE', relevance: 1.0 }
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1, 'Should deduplicate by source_id');
    assert.strictEqual(res.package.workspace[0].relevance, 1.0, 'Should keep the higher scoring one');
  });

  await t.test('7. freshness filtering & 8. authority priority & 9. workspace over stale history', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 20 });
    const items = [
      { source_id: 'stale_hist', content: 'O'.repeat(40), category: 'EXECUTION_HISTORY', is_stale: true }, // 10 tokens
      { source_id: 'curr_work', content: 'C'.repeat(40), category: 'WORKSPACE', is_stale: false } // 10 tokens
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1, 'Stale history should be discarded');
    assert.strictEqual(res.package.workspace[0].source_id, 'curr_work', 'Workspace preserved');
  });

  await t.test('10. verification evidence preservation', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 20 });
    const items = [
      { source_id: 'v1', content: 'V'.repeat(40), category: 'VERIFICATION', is_mandatory: true, project_id: projectId }
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.package.verification[0].source_id, 'v1');
  });

  await t.test('11. memory prioritization over retrieval', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 15 });
    const items = [
      { source_id: 'mem', content: 'M'.repeat(40), category: 'MEMORY', relevance: 0.8 }, // 10 tokens, P=0.8
      { source_id: 'ret', content: 'R'.repeat(40), category: 'RETRIEVAL', relevance: 0.8 } // 10 tokens, P=0.6
    ];
    // Both won't fit (20 > 15). Memory has higher priority.
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1);
    assert.strictEqual(res.package.memory[0].source_id, 'mem');
  });

  await t.test('12. retrieval result budgeting & 13. oversized single item', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 50 });
    const items = [
      { source_id: 'oversized', content: 'O'.repeat(400), category: 'RETRIEVAL' } // 100 tokens
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 0, 'Oversized optional item should be dropped');
  });

  await t.test('14. zero/empty context', () => {
    const budgetMgr = new ContextBudgetManager();
    const res = budgetMgr.packageContext({ projectId, items: [] });
    assert.strictEqual(res.metadata.selected_items_count, 0);
  });

  await t.test('15. malformed context item', () => {
    const budgetMgr = new ContextBudgetManager();
    const res = budgetMgr.packageContext({ projectId, items: [ { completely: 'broken', project_id: projectId } ] });
    assert.strictEqual(res.metadata.selected_items_count, 1, 'Should normalize empty/broken item safely');
    assert.strictEqual(res.metadata.estimated_total_tokens, 0, 'Empty content = 0 tokens');
  });

  await t.test('16. project isolation', () => {
    const budgetMgr = new ContextBudgetManager();
    const items = [
      { source_id: 'good', content: 'G', project_id: 'test_proj_123' },
      { source_id: 'evil', content: 'E', project_id: 'evil_hacker_proj' }
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1, 'Should drop cross-tenant context');
    assert.strictEqual(res.package.retrieval[0].source_id, 'good');
  });

  await t.test('17. retrieval unavailable / degrades safely', () => {
    const budgetMgr = new ContextBudgetManager();
    // Simulate what happens when RetrievalService throws and we just pass workspace
    const items = [
      { source_id: 'w1', content: 'W', category: 'WORKSPACE' }
    ];
    const res = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(res.metadata.selected_items_count, 1);
    assert.strictEqual(res.package.retrieval.length, 0, 'No retrieval context fabricated');
  });

  await t.test('18. deterministic repeated output & realistic mixed package', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 2000 });
    const items = [
      { source_id: 'sys_core', category: 'SYSTEM', is_mandatory: true, content: 'sys' },
      { source_id: 'req1', category: 'USER_REQUEST', is_mandatory: true, content: 'req' },
      { source_id: 'proj1', category: 'PROJECT', is_mandatory: true, content: 'proj' },
      { source_id: 'work1', category: 'WORKSPACE', content: 'w'.repeat(100) },
      { source_id: 'conv1', category: 'CONVERSATION', content: 'c'.repeat(50) },
      { source_id: 'mem1', category: 'MEMORY', content: 'm'.repeat(80) },
      { source_id: 'art1', category: 'ARTIFACT', content: 'a'.repeat(200) },
      { source_id: 'ret1', category: 'RETRIEVAL', content: 'r'.repeat(400) },
      { source_id: 'exec1', category: 'EXECUTION_HISTORY', content: 'e'.repeat(40) }
    ];
    const res1 = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    const res2 = budgetMgr.packageContext({ projectId, items: [...items].reverse() });
    
    assert.strictEqual(res1.metadata.selected_items_count, 9);
    assert.strictEqual(JSON.stringify(res1.package), JSON.stringify(res2.package), 'Output MUST be perfectly deterministic regardless of input order');
  });

  await t.test('19. derived importance actually prunes low-value long content', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 1000, summaryCharLimit: 80 });
    const res = budgetMgr.packageContext({
      projectId,
      items: [
        {
          source_id: 'low-value-long-line',
          project_id: projectId,
          category: 'RETRIEVAL',
          relevance: 0.01,
          authority: 1,
          content: 'x'.repeat(500)
        },
        {
          source_id: 'high-value',
          project_id: projectId,
          category: 'WORKSPACE',
          relevance: 1,
          authority: 1,
          content: 'Keep this high-relevance workspace content intact.'
        }
      ]
    });

    assert.strictEqual(res.package.retrieval[0].representation, 'summary');
    assert.ok(res.package.retrieval[0].content.length <= 81, 'Long single-token content must obey the character ceiling');
    assert.strictEqual(res.package.workspace[0].representation, 'full');
  });

  await t.test('20. malformed token estimates cannot undercount the context budget', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 200, pruningEnabled: false });
    const res = budgetMgr.packageContext({
      projectId,
      items: [{ source_id: 'bad-estimate', project_id: projectId, category: 'RETRIEVAL', content: 'C'.repeat(400), estimated_tokens: -100 }]
    });

    assert.strictEqual(res.metadata.selected_items_count, 1);
    assert.strictEqual(res.metadata.estimated_total_tokens, 100);
  });

  await t.test('21. artifact category is placed in the public artifacts bucket', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 500 });
    const res = budgetMgr.packageContext({
      projectId,
      items: [{ source_id: 'artifact-1', project_id: projectId, category: 'ARTIFACT', content: 'artifact body' }]
    });

    assert.strictEqual(res.package.artifacts.length, 1);
    assert.strictEqual(res.package.other.length, 0);
  });

  await t.test('22. missing source IDs are stable across repeated packaging', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 500 });
    const items = [{ project_id: projectId, category: 'RETRIEVAL', content: 'anonymous but deterministic context' }];
    const first = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    const second = budgetMgr.packageContext({ projectId, items: scopeItems(items) });
    assert.strictEqual(first.package.retrieval[0].source_id, second.package.retrieval[0].source_id);
  });

  await t.test('23. invalid item collections fail with a useful error', () => {
    const budgetMgr = new ContextBudgetManager();
    assert.throws(
      () => budgetMgr.packageContext({ projectId, items: 'not-an-array' }),
      /items must be an array/
    );
  });

  await t.test('24. unscoped items are rejected except the canonical core system item', () => {
    const budgetMgr = new ContextBudgetManager({ totalBudget: 500 });
    const res = budgetMgr.packageContext({
      projectId,
      items: [
        { source_id: 'sys_core', category: 'SYSTEM', is_mandatory: true, content: 'Available tools' },
        { source_id: 'unscoped-secret', category: 'RETRIEVAL', content: 'must not enter another project context' }
      ]
    });

    assert.strictEqual(res.package.system.length, 1);
    assert.strictEqual(res.package.retrieval.length, 0);
    assert.strictEqual(res.metadata.selected_items_count, 1);
  });
});
