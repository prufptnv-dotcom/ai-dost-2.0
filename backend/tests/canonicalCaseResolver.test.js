'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  resolveCanonicalCase,
  CANONICAL_CASE_IDS,
  getCanonicalCase
} = require('../quality-evaluation/canonicalCaseResolver.js');

test('Canonical Case Resolver Suite', async (t) => {
  await t.test('1. Resolves all 6 canonical case IDs directly when given exact case ID', () => {
    assert.strictEqual(CANONICAL_CASE_IDS.length, 6);
    for (const id of CANONICAL_CASE_IDS) {
      const res = resolveCanonicalCase(id);
      assert.strictEqual(res.canonicalCase, id);
      assert.strictEqual(res.status, 'EVALUABLE');
      assert.ok(res.caseDef !== null);
      assert.strictEqual(res.caseDef.id, id);
    }
  });

  await t.test('2. Resolves requests via semantic prompt matching for each canonical case', () => {
    const prompts = [
      { prompt: 'Build a modern product landing page with hero banner, pricing toggle and CTA button', expected: 'landing-page-hero-features-cta' },
      { prompt: 'Create an analytics dashboard with search across metrics, charts, and csv export', expected: 'dashboard-search-charts-csv' },
      { prompt: 'Implement an online store product catalog with shopping cart drawer and checkout', expected: 'ecommerce-cart-checkout' },
      { prompt: 'Create an educational quiz application with timed questions and high scores', expected: 'education-quiz-progress' },
      { prompt: 'Build a full-stack api-backed crud application with Express backend and React', expected: 'api-backed-crud' },
      { prompt: 'Perform multi-step code repair with surgical diffs to fix unhandled runtime exception', expected: 'multi-step-repair' }
    ];

    for (const { prompt, expected } of prompts) {
      const res = resolveCanonicalCase(prompt);
      assert.strictEqual(res.canonicalCase, expected, `Prompt "${prompt}" must resolve to ${expected}`);
      assert.strictEqual(res.status, 'EVALUABLE');
    }
  });

  await t.test('3. Returns NOT_EVALUATED for empty, null, or undefined requests', () => {
    assert.strictEqual(resolveCanonicalCase('').status, 'NOT_EVALUATED');
    assert.strictEqual(resolveCanonicalCase(null).status, 'NOT_EVALUATED');
    assert.strictEqual(resolveCanonicalCase(undefined).status, 'NOT_EVALUATED');
    assert.strictEqual(resolveCanonicalCase('   ').status, 'NOT_EVALUATED');
  });

  await t.test('4. Returns NOT_EVALUATED for completely unrelated or unsupported requests', () => {
    const unrelated = [
      'Write a bash script to backup logs',
      'Explain quantum computing in Hindi',
      'Generate a random UUID generator utility',
      'Refactor database migrations for Postgres'
    ];

    for (const prompt of unrelated) {
      const res = resolveCanonicalCase(prompt);
      assert.strictEqual(res.canonicalCase, null);
      assert.strictEqual(res.status, 'NOT_EVALUATED');
      assert.ok(res.reason.includes('does not match any of the 6 canonical'));
    }
  });

  await t.test('5. Resolves via workspace file signals when prompt is generic', () => {
    const workspace = {
      'server.js': `app.get('/api/items', (req, res) => res.json([])); app.post('/api/items', (req, res) => {});`,
      'src/App.jsx': `export default function App() { return <div>Items</div>; }`
    };

    const res = resolveCanonicalCase('Make some improvements to the app', workspace);
    assert.strictEqual(res.canonicalCase, 'api-backed-crud');
    assert.strictEqual(res.status, 'EVALUABLE');
  });

  await t.test('6. getCanonicalCase retrieves valid definition and returns null for unknown case', () => {
    const valid = getCanonicalCase('ecommerce-cart-checkout');
    assert.ok(valid !== null);
    assert.strictEqual(valid.id, 'ecommerce-cart-checkout');

    const invalid = getCanonicalCase('nonexistent-case-id');
    assert.strictEqual(invalid, null);
  });
});
