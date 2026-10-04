/**
 * Copilot self-learning memory service (zero-cost, zero-LLM).
 *
 * Design goals (user requirement):
 *   - Notes survive PROJECT DELETION (user_id-scoped, no FK to projects).
 *   - Auto-learn after every Copilot run: deterministic extraction only —
 *     no extra LLM calls (free-tier quota safe), no latency added to retrieval
 *     (synchronous SQLite + pure-JS scoring, <5ms for hundreds of notes).
 *   - Retrieval injects only RELEVANT notes (token overlap or same-project)
 *     so prompts stay compact → accuracy up, speed unchanged.
 */
const { getDatabase } = require('../db');
const CopilotNoteDAO = require('../db/dao/CopilotNoteDAO');

const MAX_CANDIDATES = 300;
const DEFAULT_LIMIT = 5;
const MAX_PROMPT_CHARS = 700;

const STOP = new Set(
  ('a an the and or but if then else for to of in on at by with from is are was were be been being this that ' +
   'these those it its as not no yes do does did done have has had you your yours we our us they them he she i me ' +
   'my can could should would will shall may might must about into over under again further once here there all any ' +
   'both each few more most other some such than too very just so also kya kaise batao banao banao bana do karo kar ' +
   'hoga hai ho se me ka ki ke aur ya pe par wale wali chahiye mujhe tum tumhara app site bana').split(/\s+/)
);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter(t => t && t.length > 2 && !STOP.has(t));
}

function safeParseTags(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

function safeDb(db) {
  if (db) return db;
  try {
    return getDatabase();
  } catch (_) {
    return null;
  }
}

/**
 * Save notes (dedupe by exact content → success_count bump).
 * notes: [{ kind, content, tags?, projectId?, source? }]
 * Returns { saved, deduped, failed }.
 */
function learnNotes(notes, { userId = 'local-user', projectId = null, source = 'run', db = null } = {}) {
  const d = safeDb(db);
  if (!d || !Array.isArray(notes) || notes.length === 0) return { saved: 0, deduped: 0, failed: 0 };
  const dao = new CopilotNoteDAO(d);
  let saved = 0;
  let deduped = 0;
  let failed = 0;
  for (const raw of notes.slice(0, 10)) {
    try {
      const row = dao.create({
        userId,
        projectId: raw.projectId != null ? raw.projectId : projectId,
        kind: raw.kind,
        content: raw.content,
        tags: raw.tags || [],
        source: raw.source || source,
      });
      if (!row) failed += 1;
      else if (row.deduped) deduped += 1;
      else saved += 1;
    } catch (_) {
      failed += 1;
    }
  }
  return { saved, deduped, failed };
}

/**
 * Rank user notes for the current prompt. Same-project notes and
 * token-overlap notes only (no random noise). Scoring:
 *   overlap*2 + sameProject 1.5 + min(success_count,5)*0.3 + recency (≤1, 30d decay)
 * Returns note rows (oldest rank order irrelevant — caller formats).
 */
function retrieveNotes({ userId = 'local-user', projectId = null, prompt = '', limit = DEFAULT_LIMIT, db = null } = {}) {
  const d = safeDb(db);
  if (!d) return [];
  const dao = new CopilotNoteDAO(d);
  let rows;
  try {
    rows = dao.listByUser(userId, MAX_CANDIDATES);
  } catch (_) {
    return [];
  }
  if (!rows.length) return [];

  const qSet = new Set(tokenize(prompt));
  const now = Date.now();
  const scored = [];
  for (const row of rows) {
    const tags = safeParseTags(row.tags);
    const hay = `${row.content || ''} ${tags.join(' ')}`.toLowerCase();
    let overlap = 0;
    for (const t of qSet) {
      if (hay.includes(t)) overlap += 1;
    }
    const sameProject = Boolean(projectId) && row.project_id === projectId;
    // Only relevant notes: prompt match OR current project OR global note w/ match.
    if (overlap === 0 && !sameProject) continue;
    let recency = 0;
    const updated = Date.parse(String(row.updated_at || '').replace(' ', 'T') + 'Z');
    if (!Number.isNaN(updated)) {
      const days = Math.max(0, (now - updated) / 86400000);
      recency = Math.max(0, 1 - days / 30);
    }
    const score = overlap * 2 + (sameProject ? 1.5 : 0) + Math.min(row.success_count || 1, 5) * 0.3 + recency;
    scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.min(Math.max(limit, 1), 12)).map(s => s.row);
}

/** Format selected notes as "- [kind] content" lines within MAX_PROMPT_CHARS. */
function formatNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return '';
  const lines = [];
  let used = 0;
  for (const n of notes) {
    const line = `- [${n.kind || 'lesson'}] ${n.content}`;
    if (used + line.length > MAX_PROMPT_CHARS) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}

/**
 * Deterministic lesson extraction at run end (no LLM).
 * status: 'success' | 'error'
 */
function extractRunNotes({ prompt, status, message = '', heals = [], filesTouched = 0 } = {}) {
  const out = [];
  const p = String(prompt || '').trim().replace(/\s+/g, ' ').slice(0, 180);
  if (!p) return out;
  const tags = [...new Set(tokenize(prompt))].slice(0, 6);
  const hay = p.toLowerCase();
  const STACK = ['react', 'vite', 'express', 'nextjs', 'next', 'astro', 'svelte', 'tailwind', 'sqlite', 'mongo',
    'docker', 'node', 'python', 'fastapi', 'websocket', 'jwt', 'redux', 'prisma', 'mysql', 'postgres', 'redis',
    'pwa', 'dashboard', 'kanban', 'auth', 'payment', 'chart'];
  for (const s of STACK) {
    if (hay.includes(s) && !tags.includes(s) && tags.length < 8) tags.push(s);
  }
  if (status === 'success') {
    out.push({
      kind: 'lesson',
      content: `Run OK: "${p}"${filesTouched ? ` (${filesTouched} files)` : ''} — approach worked, reuse this structure.`,
      tags,
      source: 'run',
    });
  } else {
    out.push({
      kind: 'fix',
      content: `Run failed: "${p}" → ${String(message || 'unknown error').replace(/\s+/g, ' ').slice(0, 180)}`,
      tags,
      source: 'run',
    });
  }
  for (const h of heals.slice(0, 3)) {
    const e = String((h && h.error) || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (e) out.push({ kind: 'fix', content: `Self-heal trigger: ${e}`, tags, source: 'run' });
  }
  return out;
}

module.exports = { learnNotes, retrieveNotes, formatNotes, extractRunNotes, tokenize };
