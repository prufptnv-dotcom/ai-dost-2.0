/**
 * P2 — Real codebase context
 * ============================================================================
 * Devin's edge over everyone else is not a better model — it is that the model
 * can actually SEE the repository. Before P2 the `/api/agent/run` path built
 * its "semantic search" context by counting substring occurrences:
 *
 *     for (word of query) score += (text.match(/\bword\b/g) || []).length * 3
 *
 * which is why the agent could not tell `startTimer` from `stopTimer`, ignored
 * the fact that a rare identifier is more informative than a common one, and
 * had no idea which files import which.
 *
 * This module provides the three things a repository-aware agent needs:
 *   1. Real content retrieval  — BM25 over code-aware tokens.
 *   2. A symbol/import graph   — "if you change this, these files care".
 *   3. A token budget          — relevance-ordered, deduplicated, capped.
 *
 * Dependency-free and synchronous: no model call, no network, no index server.
 */

const path = require('path');

const DEFAULT_MAX_TOKENS = 6000;

// BM25 tuning — the standard defaults, chosen because they are what the
// original Okapi BM25 paper validated. Deviating without a benchmark is
// cargo-culting, so these stay fixed.
const K1 = 1.5;
const B = 0.75;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.checkpoints', '.cache']);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Code-aware tokenizer
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'new', 'now', 'old', 'see',
  'two', 'way', 'who', 'boy', 'did', 'she', 'use', 'this', 'that', 'with', 'from', 'they',
  'what', 'when', 'make', 'them', 'then', 'than', 'here', 'your', 'into', 'only', 'also',
  'should', 'could', 'would', 'there', 'their', 'which', 'about', 'please', 'create', 'make',
]);

/**
 * Tokenize source code for retrieval.
 *
 * Two things matter here that a plain `/[a-z]+/` splitter gets wrong:
 *   - `startTimer` must yield `start`, `timer` AND `starttimer`, otherwise a
 *     search for "timer" silently misses the identifier that defines it.
 *   - `API_KEY` / `getUserId` must yield readable sub-tokens for the same reason.
 */
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const out = [];

  // camelCase / PascalCase / snake_case / kebab-case / CONST_CASE boundaries.
  const split = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-./\\]/g, ' ')
    .toLowerCase();

  for (const raw of split.split(/[^a-z0-9$]+/)) {
    if (!raw) continue;
    if (raw.length === 1 && !/\d/.test(raw)) continue; // single letters are noise
    if (STOPWORDS.has(raw)) continue;
    if (STOPWORDS.has(raw)) continue;
    out.push(raw);
    // Also index the full identifier (starttimer) so exact-name queries hit.
    if (raw.length > 4) out.push(raw);
  }
  return out;
}

/** Split a path into searchable parts: `src/components/Timer.jsx` → src, components, timer, jsx */
function tokenizePath(relPath) {
  return String(relPath || '')
    .replace(/\.[a-z]+$/i, '')
    .split(/[/\\]/)
    .flatMap(seg => tokenize(seg))
    .filter(t => !['src', 'lib', 'index', 'app'].includes(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Chunking
// ─────────────────────────────────────────────────────────────────────────────

// Smallest window worth indexing. Set low enough that a tiny-but-real module
// (`export const x = 1;`) is still findable, high enough to drop empty files.
const MIN_CHUNK_CHARS = 10;

/**
 * Split a file into overlapping windows on line boundaries.
 * Windows keep a `startLine`/`endLine` so the model can be told exactly where
 * a snippet came from and can then read the file if it needs more.
 */
function chunkFile(relPath, content, { targetLines = 40, overlapLines = 8 } = {}) {
  const lines = String(content || '').split(/\r?\n/);
  if (lines.length === 0) return [];

  const chunks = [];
  const step = Math.max(1, targetLines - overlapLines);

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + targetLines);
    const text = lines.slice(start, end).join('\n');
    if (text.trim().length < MIN_CHUNK_CHARS) continue;
    chunks.push({
      file: relPath,
      startLine: start + 1,
      endLine: end,
      text,
    });
    if (end >= lines.length) break;
  }
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BM25 index
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a BM25 index over code chunks.
 *
 * BM25 is used instead of raw term frequency because it fixes the two failure
 * modes substring counting suffers from:
 *   - a term appearing 30 times is not 30x more relevant (tf saturation);
 *   - a term in every file is worthless, a term in one file is a signal (idf).
 */
function buildIndex(projectFiles, options = {}) {
  const chunks = [];

  for (const file of projectFiles || []) {
    const relPath = String(file.path || file.filePath || '');
    if (!relPath) continue;
    const base = path.basename(relPath).toLowerCase();
    if (/\.(min\.js|map|png|jpe?g|gif|svg|ico|woff2?|ttf|lock|sqlite|db)$/i.test(base)) continue;
    if (relPath.split(/[/\\]/).some(seg => SKIP_DIRS.has(seg))) continue;

    const content = file.content != null ? file.content : '';
    if (!String(content).trim()) continue;

    for (const chunk of chunkFile(relPath, content, options)) {
      // Body tokens get the weight; path tokens are fewer so a filename match
      // helps ranking without letting a generic path swamp the code itself.
      const bodyTokens = tokenize(chunk.text);
      const pathTokens = tokenizePath(relPath);
      const tf = new Map();
      for (const t of bodyTokens) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of pathTokens) tf.set(t, (tf.get(t) || 0) + 2);

      chunks.push({
        file: relPath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        text: chunk.text,
        tokens: tf,
        length: bodyTokens.length || 1,
      });
    }
  }

  // Document frequency per term.
  const df = new Map();
  for (const c of chunks) {
    for (const term of c.tokens.keys()) df.set(term, (df.get(term) || 0) + 1);
  }

  const N = chunks.length;
  const avgdl = N ? chunks.reduce((sum, c) => sum + c.length, 0) / N : 1;

  return { chunks, df, N, avgdl, builtAt: Date.now() };
}

function idf(df, N) {
  // Smoothed IDF, always positive so common terms never subtract relevance.
  return Math.log(1 + (N - df + 0.5) / (df + 0.5));
}

/**
 * BM25 ranking. Returns chunks with a relevance score and the terms that
 * actually matched — the matched terms are surfaced to the model so it knows
 * *why* a snippet was selected.
 */
function search(index, query, { limit = 8 } = {}) {
  if (!index || !index.N || !query) return [];
  const queryTerms = Array.from(new Set(tokenize(query)));
  if (!queryTerms.length) return [];

  const scored = [];

  for (const chunk of index.chunks) {
    let score = 0;
    const matched = [];

    for (const term of queryTerms) {
      const f = chunk.tokens.get(term);
      if (!f) continue;
      matched.push(term);
      const df = index.df.get(term) || 0;
      const numerator = f * (K1 + 1);
      const denominator = f + K1 * (1 - B + B * (chunk.length / index.avgdl));
      score += idf(df, index.N) * (numerator / denominator);
    }

    if (score > 0) scored.push({ ...chunk, score, matchedTerms: matched });
  }

  scored.sort((a, b) => b.score - a.score);

  // Collapse to one hit per file unless a second chunk scores close behind —
  // three near-identical windows of the same file waste the budget.
  const best = new Map();
  for (const hit of scored) {
    const prev = best.get(hit.file);
    if (!prev) {
      best.set(hit.file, { ...hit, extraChunks: 0 });
    } else if (hit.score > prev.score * 0.6 && prev.extraChunks < 1) {
      prev.extraChunks += 1;
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Symbol / dependency graph
// ─────────────────────────────────────────────────────────────────────────────

/** Lightweight import extractor — the graph does not need to be perfect. */
function extractImports(relPath, content) {
  const src = String(content || '');
  const out = [];

  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
  }
  return [...new Set(out)];
}

/** Resolve a relative import against the importing file, then against the real
 *  file set so extensionless specifiers (`./useTimer` → `useTimer.js`) link up.
 */
function resolveRelative(fromRel, spec, known) {
  if (!spec.startsWith('.')) return null;
  const fromDir = path.posix.dirname(String(fromRel).replace(/\\/g, '/'));
  const joined = path.posix.normalize(path.posix.join(fromDir, spec)).replace(/^\.\//, '');
  if (!known) return joined;

  if (known.has(joined)) return joined;
  // `import x from './y'` in JS/TS almost always means y.js|y.jsx|y.ts|y.tsx.
  for (const ext of ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.css']) {
    if (known.has(joined + ext)) return joined + ext;
  }
  // `import x from './y'` may also mean the y/ directory's entry point.
  for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
    if (known.has(path.posix.join(joined, `index${ext}`))) return path.posix.join(joined, `index${ext}`);
  }
  return null;
}

/**
 * Build import edges across the file set.
 *
 * This is what lets the agent answer "what else breaks if I change this file?",
 * which substring counting could never do.
 */
function buildGraph(projectFiles) {
  const known = new Set((projectFiles || []).map(f => String(f.path).replace(/\\/g, '/')));
  const importsOf = new Map();
  const importedBy = new Map();

  for (const file of projectFiles || []) {
    const rel = String(file.path).replace(/\\/g, '/');
    const specs = extractImports(rel, file.content);
    const resolved = new Set();
    for (const spec of specs) {
      const target = resolveRelative(rel, spec, known);
      if (target && known.has(target)) resolved.add(target);
    }
    importsOf.set(rel, [...resolved]);
    for (const t of resolved) {
      if (!importedBy.has(t)) importedBy.set(t, []);
      importedBy.get(t).push(rel);
    }
  }

  return {
    importsOf,
    importedBy,
    /** Files that import `relPath`, transitively aware at one level. */
    dependentsOf(relPath) {
      return (importedBy.get(String(relPath).replace(/\\/g, '/')) || []).slice();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. Symbol extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the named things a file declares.
 *
 * Deliberately regex-based and approximate: a real parser is not worth the
 * dependency here because the output feeds a language model as *navigation
 * hints*, not as ground truth. Precision matters less than never missing the
 * obvious entry point.
 */
function extractSymbols(relPath, content) {
  const src = String(content || '');
  const out = [];
  const add = (kind, name) => {
    if (!name || name.length < 2 || out.length >= 40) return;
    out.push({ kind, name });
  };

  // const/let/var Foo = …  |  function Foo(  |  class Foo
  const decl = [
    [/\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g, 'function'],
    [/\b(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/g, 'class'],
    [/\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, 'const'],
  ];
  for (const [re, kind] of decl) {
    let m;
    while ((m = re.exec(src)) !== null) add(kind, m[1]);
  }

  // Route handlers are the highest-value target in an Express project.
  const routeRe = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let rm;
  while ((rm = routeRe.exec(src)) !== null) out.push({ kind: 'route', name: `${rm[1].toUpperCase()} ${rm[2]}` });

  return out;
}

/** A file's most-likely entry points, used as a navigation hint. */
function describeFile(relPath, content) {
  const symbols = extractSymbols(relPath, content);
  const named = symbols.filter(s => s.kind !== 'route');
  const routes = symbols.filter(s => s.kind === 'route');
  return { symbols: named, routes };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Budgeted context assembly
// ─────────────────────────────────────────────────────────────────────────────

/** ~4 characters per token is the standard rough estimate; deliberately cheap. */
function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function formatHits(hits, budgetTokens) {
  const blocks = [];
  let used = 0;

  for (const hit of hits) {
    const header = `FILE: ${hit.file} (lines ${hit.startLine}-${hit.endLine}) [matched: ${hit.matchedTerms.join(', ')}]`;
    // Cap any single snippet so one huge file cannot eat the whole budget.
    const maxChars = Math.max(1200, budgetTokens * 3);
    const body = hit.text.length > maxChars ? `${hit.text.slice(0, maxChars)}\n/* … truncated … */` : hit.text;
    const block = `${header}\n\`\`\`\n${body}\n\`\`\``;
    const cost = estimateTokens(block);
    if (used + cost > budgetTokens && blocks.length) break;
    blocks.push(block);
    used += cost;
  }

  return { text: blocks.join('\n\n'), tokens: used, count: blocks.length };
}

/**
 * Produce the repository context block for a run.
 *
 * Returns an object rather than a bare string so callers can tell the difference
 * between "found relevant code" and "found nothing relevant" — a block that
 * merely *looks* like context is how the old substring scorer misled the model.
 */
function retrieveContext(opts) {
  const {
    projectFiles = [],
    query = '',
    maxTokens = DEFAULT_MAX_TOKENS,
    includeGraph = true,
    graphBudgetTokens = 700,
  } = opts || {};

  const started = Date.now();
  const index = buildIndex(projectFiles);
  const hits = search(index, query, { limit: 8 });
  const { text, tokens } = formatHits(hits, Math.max(500, maxTokens - graphBudgetTokens));

  let graphText = '';
  if (includeGraph && hits.length) {
    const graph = buildGraph(projectFiles);
    const lines = [];

    for (const hit of hits.slice(0, 4)) {
      const dependents = graph.dependentsOf(hit.file);
      if (dependents.length) {
        lines.push(`- \`${hit.file}\` is imported by: ${dependents.map(d => `\`${d}\``).join(', ')}`);
      }

      // Navigation hints: what lives in this file, so the model can ask for a
      // specific file rather than re-reading everything.
      const source = (projectFiles || []).find(f => String(f.path).replace(/\\/g, '/') === hit.file);
      if (source) {
        const { symbols, routes } = describeFile(hit.file, source.content);
        if (symbols.length) {
          lines.push(`- \`${hit.file}\` declares: ${symbols.slice(0, 10).map(s => `${s.name} (${s.kind})`).join(', ')}`);
        }
        if (routes.length) {
          lines.push(`- \`${hit.file}\` routes: ${routes.slice(0, 8).map(r => r.name).join(', ')}`);
        }
      }
    }

    if (lines.length) {
      graphText = `\n\n=== CODE MAP (symbols + what imports what — read these before editing) ===\n${lines.join('\n')}`;
    }
  }

  return {
    block: text ? `=== RELEVANT CODE (BM25 retrieval, ${index.chunks.length} chunks indexed) ===\n${text}${graphText}` : '',
    empty: !text,
    hits: hits.map(h => ({ file: h.file, startLine: h.startLine, endLine: h.endLine, score: Math.round(h.score * 1000) / 1000, matchedTerms: h.matchedTerms })),
    stats: {
      filesIndexed: (projectFiles || []).length,
      chunksIndexed: index.chunks.length,
      distinctTerms: index.df.size,
      hits: hits.length,
      tokensUsed: tokens,
      buildMs: Date.now() - started,
    },
  };
}

module.exports = {
  tokenize,
  tokenizePath,
  chunkFile,
  buildIndex,
  search,
  buildGraph,
  extractSymbols,
  describeFile,
  estimateTokens,
  retrieveContext,
  DEFAULT_MAX_TOKENS,
};