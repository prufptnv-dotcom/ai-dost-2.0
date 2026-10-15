/**
 * P5 — Error→Fix learning memory
 * ============================================================================
 * Replit / Bolt / Devin can repair a broken build. What none of them ship is a
 * memory of WHICH repair fixed WHICH error, so the same failure does not cost
 * a full LLM round-trip the next time.
 *
 * This module turns every successful repair into a durable, delete-proof note
 * (`copilot_notes`) keyed by a NORMALIZED error signature, and injects a known
 * fix into the repair prompt when the same underlying error comes back — even
 * in a different project.
 *
 * Why normalization matters: `vite build` errors embed absolute paths, line
 * numbers, ports and hashes, so two identical failures never compare equal
 * byte-for-byte. The signature strips the volatile parts so the SAME error
 * matches the SAME known fix.
 */

const logger = require('../logger');
const { learnNotes, retrieveNotes, formatNotes, tokenize } = require('./copilotMemory');

const MAX_FIXES = 3;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Error signature normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reduce an error message to the parts that identify it.
 *
 * Volatile, per-run data is collapsed:
 *   - absolute paths              C:\Users\…\project → <path>
 *   - line:column                 :12:3              → :#
 *   - hex hashes / build ids      C6G_3qQV           → <hash>
 *   - ports / numbers             5173               → #
 *   - timestamps / durations      3.48s              → #s
 *   - quoted file names           'src/App.jsx'      → kept (identifies the file)
 *
 * The goal is that "the same failure" always produces the same signature, so a
 * known fix can be found by token overlap.
 */
function errorSignature(error) {
  if (!error || typeof error !== 'string') return '';

  return error
    // 1. Durations BEFORE number-collapsing: `348ms` is one unit, not a number
    //    followed by a word. `3.48s`, `512ms`, `2 mins`.
    .replace(/\b\d+(?:\.\d+)?\s*(ms|sec|secs|s|mins?|minutes|hours)\b/gi, '#$1')
    // 2. Absolute paths WITH the file extension (and optional :line:col tail),
    //    spaces inside the path allowed — `C:\Users\vikash kumar\…\App.jsx:12:3`.
    .replace(/[A-Za-z]:\\[^\n]*?\.(?:jsx?|tsx?|mjs|cjs|css|scss|html?|json|py|md|ya?ml|tsconfig)(?::\d+:\d+)?/g, '<path>')
    .replace(/(^|[\s"'`(])\/[^\n]*?\.(?:jsx?|tsx?|mjs|cjs|css|scss|html?|json|py|md|ya?ml|tsconfig)(?::\d+:\d+)?/g, '$1<path>')
    // 3. Hashed build-asset names: ≥8 chars, mixed letters+digits, directly
    //    before an extension — `index-C6G_3qQV.css` → `index.<hash>.css`.
    //    The dual lookahead protects real identifiers like `useTimer.js`
    //    (no digit) and `App.jsx` (too short).
    .replace(/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{8,}(?=\.[a-z]{1,5}\b)/g, '<hash>')
    .replace(/[0-9a-f]{12,}/gi, '<hash>')
    // 4. Any remaining line:col positions (`47:12`, `89:4` — digit count must
    //    not matter, a position is a position).
    .replace(/:\d+:\d+/g, ':#')
    .replace(/\b\d+:\d+\b/g, '#')
    // 5. Bare volatile numbers: ports, counts, ids. Single digits kept — they
    //    are often semantically meaningful (e.g. `exit code 1`).
    .replace(/\b\d{2,6}\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/** Tokens that actually identify an error — used both to store and to match. */
function signatureTokens(error) {
  const sig = errorSignature(error).toLowerCase();
  return [...new Set(tokenize(sig))].filter(t => t.length > 2).slice(0, 12);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Learn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a fix that WORKED. `error` is the real failure text, `files` the ones
 * the repair rewrote, `summary` a one-line human description of the fix.
 *
 * Returns {saved, deduped} — a repeat of the same signature just bumps its
 * success_count (exact-content dedupe), which is exactly what ranking uses to
 * prefer battle-tested fixes.
 */
function learnFix({ error, files = [], summary = '', projectId = null, db = null } = {}) {
  const sig = errorSignature(error);
  const tags = signatureTokens(error);
  if (!sig || !tags.length || !summary.trim()) {
    return { saved: 0, deduped: 0, reason: 'no usable error or fix description' };
  }

  const fileList = files.filter(Boolean).map(f => String(f)).slice(0, 6);
  const content = `FIX: ${summary.trim().slice(0, 260)}${fileList.length ? ` | changed: ${fileList.join(', ')}` : ''}`;

  const res = learnNotes(
    [{ kind: 'fix', content, tags: [...tags, 'fix'], source: 'repair', projectId }],
    { projectId, source: 'repair', db }
  );

  logger.info(`[fixMemory] ${res.deduped ? 'refreshed' : 'learned'} fix for "${sig.slice(0, 90)}"`);
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Retrieve
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find known fixes for an error we are about to repair.
 *
 * Returns up to MAX_FIXES notes whose signature tokens overlap the new error.
 * The underlying ranker already handles token overlap + recency + success
 * count, so a fix that has proven itself repeatedly surfaces first.
 */
function knownFixesFor({ error, projectId = null, limit = MAX_FIXES, db = null } = {}) {
  const tags = signatureTokens(error);
  if (!tags.length) return [];

  // The ranker needs text to overlap — feed it the signature, which is what
  // the stored tags were built from.
  const rows = retrieveNotes({
    prompt: tags.join(' '),
    projectId,
    limit: limit * 2, // widen, then filter to fixes
    db,
  });

  return rows
    .filter(r => r.kind === 'fix')
    .slice(0, limit);
}

/** Format known fixes as a prompt block. Empty string when there is nothing. */
function formatKnownFixes(fixes) {
  if (!Array.isArray(fixes) || !fixes.length) return '';
  const lines = fixes.map(f => {
    const times = (f.success_count || 1) > 1 ? ` (worked ${f.success_count}×)` : '';
    return `- ${f.content}${times}`;
  });
  return `=== KNOWN FIXES FOR THIS ERROR (apply these first) ===\n${lines.join('\n')}`;
}

module.exports = {
  errorSignature,
  signatureTokens,
  learnFix,
  knownFixesFor,
  formatKnownFixes,
};