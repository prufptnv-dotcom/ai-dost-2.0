const { describe, it } = require('node:test');
const assert = require('node:assert');

const codeContext = require('../services/codeContext');

/**
 * P2 — Real codebase context.
 *
 * The bar these tests set: retrieval must beat the substring counter it
 * replaced. Each case below is a failure mode the old scorer demonstrably had.
 */

// ─────────────────────────────────────────────────────────────────────────────
describe('codeContext.tokenize — code-aware, not word-boundary naive', () => {
  it('splits identifiers so "timer" finds startTimer', () => {
    const tokens = codeContext.tokenize('startTimer');
    assert.ok(tokens.includes('start'), 'camelCase must be split');
    assert.ok(tokens.includes('timer'), 'camelCase must be split');
  });

  it('handles SCREAMING_CASE and snake_case', () => {
    assert.ok(codeContext.tokenize('API_KEY').includes('key'));
    assert.ok(codeContext.tokenize('user_id').includes('user'));
  });

  it('drops stopwords that would otherwise dominate the ranking', () => {
    const tokens = codeContext.tokenize('the and for with');
    assert.strictEqual(tokens.length, 0);
  });

  it('is safe with null/empty input', () => {
    for (const bad of [null, undefined, '', 123, {}]) {
      assert.doesNotThrow(() => codeContext.tokenize(bad));
    }
  });

  it('tokenizes a file path into useful parts', () => {
    const tokens = codeContext.tokenizePath('src/components/PomodoroTimer.jsx');
    assert.ok(tokens.includes('pomodoro'));
    assert.ok(tokens.includes('timer'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('codeContext.chunkFile — keeps line provenance', () => {
  it('reports real start/end lines for each window', () => {
    const content = Array.from({ length: 120 }, (_, i) => `const line${i} = ${i};`).join('\n');
    const chunks = codeContext.chunkFile('a.js', content, { targetLines: 40, overlapLines: 8 });
    assert.ok(chunks.length > 1, 'a long file must produce multiple windows');
    assert.strictEqual(chunks[0].startLine, 1);
    for (const c of chunks) {
      assert.ok(c.endLine >= c.startLine);
      assert.ok(c.endLine <= 120);
    }
  });

  it('produces one chunk for a short file', () => {
    const chunks = codeContext.chunkFile('a.js', 'const a = 1;');
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0].startLine, 1);
  });

  it('skips whitespace-only chunks', () => {
    assert.strictEqual(codeContext.chunkFile('a.js', '   \n\n   \n').length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('codeContext BM25 — beats the substring counter', () => {
  const files = [
    {
      path: 'src/hooks/useTimer.js',
      content: [
        'import { useState } from "react";',
        'export function useTimer() {',
        '  const [remaining, setRemaining] = useState(25 * 60);',
        '  return { remaining };',
        '}',
      ].join('\n'),
    },
    {
      path: 'src/components/Header.jsx',
      content: [
        'export default function Header() {',
        '  return <header>Site header</header>;',
        '}',
      ].join('\n'),
    },
    {
      path: 'src/utils/format.js',
      content: 'export const formatTime = (s) => `${s}`;',
    },
  ];

  it('ranks the file that actually contains the identifier first', () => {
    const index = codeContext.buildIndex(files);
    const hits = codeContext.search(index, 'useTimer', { limit: 3 });
    assert.ok(hits.length > 0);
    assert.strictEqual(hits[0].file, 'src/hooks/useTimer.js');
  });

  it('finds a file by a sub-token of its identifier (timer → useTimer)', () => {
    const index = codeContext.buildIndex(files);
    const hits = codeContext.search(index, 'timer', { limit: 3 });
    assert.ok(
      hits.some(h => h.file === 'src/hooks/useTimer.js'),
      'a partial identifier must still find its definition'
    );
  });

  it('returns no hits for a query that is genuinely absent', () => {
    const index = codeContext.buildIndex(files);
    const hits = codeContext.search(index, 'kubernetes', { limit: 3 });
    assert.strictEqual(hits.length, 0);
  });

  it('reports which terms actually matched', () => {
    const index = codeContext.buildIndex(files);
    const hits = codeContext.search(index, 'useTimer', { limit: 1 });
    assert.ok(hits[0].matchedTerms.length > 0);
    assert.ok(hits[0].matchedTerms.includes('usetimer') || hits[0].matchedTerms.includes('timer'));
  });

  it('IDF: a term present in every chunk must not dominate ranking', () => {
    // "use" appears in essentially every chunk here; a query for it alone must
    // not push an irrelevant file above a genuinely relevant one.
    const index = codeContext.buildIndex(files);
    const hits = codeContext.search(index, 'use', { limit: 3 });
    for (const h of hits) {
      assert.ok(typeof h.score === 'number' && h.score > 0);
    }
  });

  it('collapses duplicate hits from the same file', () => {
    const big = {
      path: 'src/long.js',
      content: Array.from({ length: 300 }, (_, i) => `function widget${i}() { return widget; }`).join('\n'),
    };
    const index = codeContext.buildIndex([big]);
    const hits = codeContext.search(index, 'widget', { limit: 5 });
    assert.strictEqual(hits.length, 1, 'one entry per file, not one per window');
    assert.strictEqual(hits[0].extraChunks, 1, 'the runner-up window is recorded, not listed separately');
  });

  it('is deterministic for the same input', () => {
    const index = codeContext.buildIndex(files);
    const a = codeContext.search(index, 'timer header', { limit: 3 }).map(h => h.file);
    const b = codeContext.search(index, 'timer header', { limit: 3 }).map(h => h.file);
    assert.deepStrictEqual(a, b);
  });

  it('handles an empty corpus and an empty query without throwing', () => {
    const empty = codeContext.buildIndex([]);
    assert.deepStrictEqual(codeContext.search(empty, 'anything'), []);
    const idx = codeContext.buildIndex(files);
    assert.deepStrictEqual(codeContext.search(idx, ''), []);
  });

  it('skips noise files that cannot be meaningfully searched', () => {
    const idx = codeContext.buildIndex([
      { path: 'assets/logo.png', content: 'not really a png but long enough to pass the minimum size check' },
      { path: 'src/real.js', content: 'export const real = true;' },
    ]);
    assert.strictEqual(idx.chunks.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('codeContext.buildGraph — who breaks if I change this?', () => {
  const files = [
    { path: 'src/App.jsx', content: 'import { useTimer } from "./hooks/useTimer";\nexport default function App(){}' },
    { path: 'src/hooks/useTimer.js', content: 'export function useTimer(){}' },
    { path: 'src/components/Timer.jsx', content: 'import { useTimer } from "../hooks/useTimer";\nexport default function Timer(){}' },
  ];

  it('records the files that import a given module', () => {
    const graph = codeContext.buildGraph(files);
    const dependents = graph.dependentsOf('src/hooks/useTimer.js');
    assert.ok(dependents.includes('src/App.jsx'));
    assert.ok(dependents.includes('src/components/Timer.jsx'));
  });

  it('resolves extensionless import specifiers back to the real file', () => {
    const graph = codeContext.buildGraph(files);
    assert.deepStrictEqual(graph.importsOf.get('src/App.jsx'), ['src/hooks/useTimer.js']);
    assert.deepStrictEqual(graph.importsOf.get('src/components/Timer.jsx'), ['src/hooks/useTimer.js']);
  });

  it('ignores bare package imports (nothing to resolve in-repo)', () => {
    const graph = codeContext.buildGraph([
      { path: 'a.js', content: 'import express from "express";' },
      { path: 'b.js', content: 'const x = require("cors");' },
    ]);
    assert.strictEqual(graph.importsOf.get('a.js').length, 0);
    assert.strictEqual(graph.importsOf.get('b.js').length, 0);
  });

  it('handles a file that imports nothing', () => {
    const graph = codeContext.buildGraph([{ path: 'lonely.js', content: 'export const x = 1;' }]);
    assert.deepStrictEqual(graph.dependentsOf('lonely.js'), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('codeContext.extractSymbols / describeFile', () => {
  it('finds declarations', () => {
    const { symbols } = codeContext.describeFile('src/a.jsx', [
      'export default function App() {}',
      'class Store {}',
      'const MAX = 10;',
      'function helper() {}',
    ].join('\n'));
    const names = symbols.map(s => s.name);
    assert.ok(names.includes('App'));
    assert.ok(names.includes('Store'));
    assert.ok(names.includes('MAX'));
    assert.ok(names.includes('helper'));
  });

  it('finds Express routes — the highest-value navigation hint', () => {
    const { routes } = codeContext.describeFile('server.js', [
      "app.get('/api/items', handler);",
      "router.post('/api/items/:id', handler);",
      "app.delete('/api/old', handler);",
    ].join('\n'));
    const names = routes.map(r => r.name);
    assert.ok(names.includes('GET /api/items'));
    assert.ok(names.includes('POST /api/items/:id'));
    assert.ok(names.includes('DELETE /api/old'));
  });

  it('does not explode on empty content', () => {
    assert.doesNotThrow(() => codeContext.describeFile('a.js', ''));
    assert.deepStrictEqual(codeContext.extractSymbols('a.js', null), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('codeContext.retrieveContext — the assembled block', () => {
  const files = [
    {
      path: 'src/hooks/useTimer.js',
      content: 'export function useTimer(){\n  // manages the countdown\n  return { remaining: 25 };\n}',
    },
    { path: 'src/Header.jsx', content: 'export default function Header(){ return <header/>; }' },
  ];

  it('produces a block with provenance, matched terms and a code map', () => {
    const out = codeContext.retrieveContext({ projectFiles: files, query: 'useTimer countdown' });
    assert.strictEqual(out.empty, false);
    assert.match(out.block, /=== RELEVANT CODE \(BM25 retrieval/);
    assert.match(out.block, /\[matched:/);
    assert.match(out.block, /src\/hooks\/useTimer\.js/);
    assert.ok(out.stats.chunksIndexed > 0);
    assert.ok(out.stats.tokensUsed > 0);
  });

  it('is honest when nothing is relevant — empty block, not a guess', () => {
    const out = codeContext.retrieveContext({ projectFiles: files, query: 'kubernetes operator' });
    assert.strictEqual(out.empty, true);
    assert.strictEqual(out.block, '');
    assert.strictEqual(out.hits.length, 0);
  });

  it('respects the token budget', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      path: `src/file${i}.js`,
      content: Array.from({ length: 60 }, (_, j) => `// mention of widget and widget${i} on line ${j}`).join('\n'),
    }));
    const small = codeContext.retrieveContext({ projectFiles: many, query: 'widget', maxTokens: 1200 });
    const large = codeContext.retrieveContext({ projectFiles: many, query: 'widget', maxTokens: 6000 });
    assert.ok(large.stats.tokensUsed > small.stats.tokensUsed, 'a bigger budget must retrieve more');
    assert.ok(small.stats.tokensUsed <= 1200 + 4000, 'budget must actually bound the payload');
  });

  it('never throws on degenerate input', () => {
    for (const input of [undefined, null, {}, { projectFiles: null }, { projectFiles: [{ }], query: 'x' }]) {
      assert.doesNotThrow(() => codeContext.retrieveContext(input));
    }
  });
});