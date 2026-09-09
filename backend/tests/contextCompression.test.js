const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const migration = require('../db/migrations/008_context_compression_cache');
const ContextCompressionStore = require('../services/ContextCompressionStore');
const { ContextBudgetManager } = require('../agent/runtime/ContextBudgetManager');

test('Dynamic Semantic Pruning keeps important context and summarizes low importance', () => {
  const manager = new ContextBudgetManager({ totalBudget: 1000, summaryWordLimit: 20 });
  const result = manager.packageContext({ projectId: 'p1', items: [
    { source_id: 'important', category: 'WORKSPACE', importance_score: 9, content: 'function important() { return true; }' },
    { source_id: 'background', category: 'RETRIEVAL', importance_score: 3, content: Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ') }
  ] });
  const important = result.package.workspace[0];
  const background = result.package.retrieval[0];
  assert.equal(important.representation, 'full');
  assert.equal(background.representation, 'summary');
  assert.equal(background.content.split(' ').filter(Boolean).length, 20);
  assert.equal(background.content.includes('word39'), false);
  assert.equal(result.metadata.pruned_items_count, 1);
});

test('ContextCompressionStore round-trips gzip payloads in SQLite', () => {
  const db = new DatabaseSync(':memory:');
  migration.up(db);
  const store = new ContextCompressionStore(db);
  const saved = store.save({ projectId: 'p1', sourceId: 'src1', sourceType: 'workspace_file', content: 'const answer = 42;', importanceScore: 4, representation: 'summary' });
  const loaded = store.get({ projectId: 'p1', sourceId: 'src1', representation: 'summary' });
  assert.equal(loaded.content, 'const answer = 42;');
  assert.equal(loaded.importance_score, 4);
  assert.ok(loaded.compressed_bytes > 0);
  assert.equal(saved.source_id, 'src1');
});