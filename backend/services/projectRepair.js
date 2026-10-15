/**
 * P1 — Deterministic verification + repair
 * ============================================================================
 * P0 proved the generated code runs (or doesn't) with real evidence. It could
 * not FIX anything: a failed build simply reported failure and stopped, which is
 * the single biggest gap versus Replit / Bolt / Devin — all three close the loop
 * with generate → run → observe → repair.
 *
 * This module owns the "observe → repair" half. It deliberately does NOT call an
 * LLM itself: the caller injects `callLLM` so there is no import cycle with
 * routes/agent.js and so the provider cascade stays in one place.
 *
 * Design rules:
 *   - The LLM is shown the ACTUAL failure output, never a paraphrase.
 *   - A repair that changes nothing is not a repair; detect that and stop.
 *   - Repair attempts are bounded and observable.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../logger');

const MAX_PROMPT_FILE_BYTES = 18000;
const MAX_FILES_IN_PROMPT = 14;
const MAX_REPAIRED_FILE_BYTES = 400000;

/** Extensions worth handing to the model — the ones a build actually parses. */
const REPAIRABLE = /\.(jsx?|tsx?|mjs|cjs|css|html|json)$/i;

/**
 * Prefer the files the failure actually implicates. Falls back to the biggest
 * entry files when nothing matches, so the model always gets the app skeleton.
 */
function selectFilesForPrompt(files, hints = []) {
  const entries = Object.entries(files || {})
    .filter(([p]) => REPAIRABLE.test(p))
    .map(([p, content]) => ({ path: p, content: String(content ?? '') }));

  const needle = hints.map(h => String(h || '').toLowerCase()).filter(Boolean);
  const scored = entries.map(e => {
    const lower = e.path.toLowerCase();
    let score = 0;
    for (const n of needle) {
      const base = path.basename(lower);
      // The error usually names the entry file (App.jsx, main.jsx, index.css).
      if (base === n || base.startsWith(n)) score += 10;
      else if (lower.includes(n)) score += 4;
    }
    if (/(^|\/)(App|main|index)\.(jsx?|tsx?|css|html)$/.test(lower)) score += 3;
    if (/^(server|src\/services|src\/stores)\//.test(lower)) score -= 2; // backend, usually not the cause
    return { ...e, score };
  });

  scored.sort((a, b) => b.score - a.score || b.content.length - a.content.length);
  return scored.slice(0, MAX_FILES_IN_PROMPT);
}

function readProjectFiles(dir) {
  const out = {};
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.checkpoints']);

  const walk = (rel, depth) => {
    if (depth > 5) return;
    let entries;
    try {
      entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env.example') continue;
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        walk(relPath, depth + 1);
      } else if (REPAIRABLE.test(e.name)) {
        try {
          const stat = fs.statSync(path.join(dir, relPath));
          if (stat.size > MAX_REPAIRED_FILE_BYTES) continue;
          out[relPath] = fs.readFileSync(path.join(dir, relPath), 'utf8');
        } catch (_) {}
      }
    }
  };
  walk('', 0);
  return out;
}

/** Pull a JSON object out of a model response that may be wrapped in prose/fences. */
function parseFilePayload(raw) {
  if (!raw || typeof raw !== 'string') return [];
  let text = raw.trim();

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return [];
  const slice = text.slice(start, end + 1);

  for (const candidate of [slice, slice.replace(/\}\s*,\s*$/, '}')]) {
    try {
      const parsed = JSON.parse(candidate);
      const list = Array.isArray(parsed) ? parsed : parsed.files;
      if (Array.isArray(list)) {
        return list
          .filter(f => f && typeof f.path === 'string' && typeof f.content === 'string')
          .map(f => ({ path: f.path, content: f.content }));
      }
    } catch (_) {}
  }
  return [];
}

/**
 * Ask the model to fix a real, observed failure.
 *
 * @param {object}   opts
 * @param {string}   opts.dir        absolute project directory
 * @param {string}   opts.evidence   the REAL failure output (compiler/runtime)
 * @param {string}   opts.summary    short human description of what failed
 * @param {string}   opts.intent     the user's original goal, for context
 * @param {Function} opts.callLLM    async (system, user) => string
 * @param {number}   opts.attempt    1-based attempt number
 * @returns {Promise<{files:Array, raw:string, reason?:string}>}
 */
async function requestRepair(opts) {
  const { dir, evidence, summary, intent, callLLM, attempt = 1 } = opts;
  if (typeof callLLM !== 'function') {
    return { files: [], reason: 'no callLLM supplied' };
  }

  const onDisk = readProjectFiles(dir);
  // Filenames mentioned in the error steer which files we show the model.
  const hints = String(evidence || '').match(/[\w.-]+\.(?:jsx?|tsx?|css|html|json)/g) || [];
  const selected = selectFilesForPrompt(onDisk, hints);

  if (!selected.length) {
    return { files: [], reason: 'no editable source files found' };
  }

  const fileBlock = selected
    .map(f => {
      const body = f.content.length > MAX_PROMPT_FILE_BYTES
        ? `${f.content.slice(0, MAX_PROMPT_FILE_BYTES)}\n/* … truncated … */`
        : f.content;
      return `FILE: ${f.path}\n\`\`\`\n${body}\n\`\`\``;
    })
    .join('\n\n');

  const system = `You are a senior engineer repairing a project that FAILED to build.

You will be shown the real compiler/runtime output. Diagnose the actual root cause and fix it.

Rules:
- Fix the ROOT CAUSE, not the symptom. Never silence an error by deleting the check or swallowing the exception.
- Return ONLY the files you changed, complete and in full. Do not return unchanged files.
- Do not invent new dependencies unless the failure is genuinely a missing module.
- Preserve all existing behaviour that is not part of the failure.
- Reply with a single JSON object and nothing else:
  {"files":[{"path":"src/App.jsx","content":"…"}]}`;

  const user = `ORIGINAL GOAL:
${String(intent || '(not provided)').slice(0, 500)}

FAILURE (${summary || 'build/verification failed'}):
\`\`\`
${String(evidence || '').slice(0, 6000) || '(no output captured)'}
\`\`\`

PROJECT FILES:
${fileBlock}

Return the corrected file(s) as JSON now.`;

  let raw = '';
  try {
    raw = await callLLM(system, user);
  } catch (e) {
    return { files: [], reason: `LLM call failed: ${e.message}` };
  }

  const files = parseFilePayload(raw);
  if (!files.length) {
    return { files: [], raw, reason: 'model returned no usable file payload' };
  }
  return { files, raw };
}

/**
 * Did the repair actually change anything? A no-op repair is a hard stop —
 * re-asking a model that already failed identically only burns quota.
 */
function diffAgainstDisk(dir, repairedFiles) {
  const applied = [];
  const unchanged = [];
  for (const f of repairedFiles) {
    let current = null;
    try { current = fs.readFileSync(path.join(dir, f.path), 'utf8'); } catch (_) {}
    if (current === f.content) unchanged.push(f.path);
    else applied.push(f);
  }
  return { applied, unchanged };
}

/**
 * Run generate → verify → repair until it passes or the budget runs out.
 *
 * `verify` is injected so this stays a pure orchestrator: it must re-run the
 * REAL build + browser check after every attempt, never trust the model's
 * claim that it fixed something.
 *
 * `opts.initialVerification`, when supplied, is a verification the caller
 * already ran. The loop trusts it for the FIRST check instead of paying for a
 * duplicate build + browser launch; re-verifications after each applied repair
 * still run for real. Only the duplicate initial check is skipped.
 *
 * @returns {Promise<{ok:boolean, verified:boolean, attempts:number, verification:object, repairs:Array}>}
 */
async function repairUntilVerified(opts) {
  const {
    dir,
    verify,
    repair,
    maxAttempts = 3,
    onLog,
    onAttempt,
  } = opts;

  if (typeof verify !== 'function') {
    throw new TypeError('repairUntilVerified requires a verify() function');
  }

  let verification = opts.initialVerification || await verify(0);
  const repairs = [];
  let attempts = 0;

  // An UNVERIFIED first run is not a failure to repair — there is no error to
  // hand the model. Only a genuine, actionable failure enters the loop.
  while (attempts < maxAttempts && !verification.ok && hasActionableFailure(verification)) {
    attempts++;
    if (onLog) onLog(`🔧 Repair attempt ${attempts}/${maxAttempts} — feeding the real failure back to the model…`);

    const result = await repair(verification, attempts);
    repairs.push({ attempt: attempts, ...result });

    if (typeof onAttempt === 'function') onAttempt(result);

    if (!result || !result.applied || !result.applied.length) {
      if (onLog) {
        onLog(
          result?.reason
            ? `⚠️ Repair attempt ${attempts} produced no usable change (${result.reason}) — stopping.`
            : `⚠️ Repair attempt ${attempts} produced no usable change — stopping.`
        );
      }
      break;
    }

    if (onLog) onLog(`🛠️ Applied ${result.applied.length} repaired file(s): ${result.applied.map(f => f.path).join(', ')}`);

    // Re-verify for real. The build is the only witness that counts.
    verification = await verify(attempts);
  }

  return {
    ok: Boolean(verification?.ok),
    verified: Boolean(verification?.ok),
    attempts,
    verification,
    repairs,
  };
}

/**
 * Is there a concrete, actionable failure to hand the model?
 * "No build script" or "playwright missing" are not repairable by editing code.
 */
function hasActionableFailure(verification) {
  const rt = verification?.runtime;
  if (rt?.unverified || rt?.unavailable) return false;
  if (rt?.reason && /playwright not installed|no parser available/i.test(rt.reason)) return false;
  if (verification?.build?.skipped && rt && !rt.attempted) return false;
  return Boolean(
    (verification?.build && verification.build.ok === false) ||
    (rt && rt.attempted && rt.ok === false)
  );
}

/**
 * Did this repair change the dependency manifest?
 *
 * When it did, the next build would otherwise run against a stale
 * `node_modules` and fail with `'<tool>' is not recognized` forever. The
 * model's usual "fix" for that is to rewrite the build script as
 * `npm install && <tool> build`, which hides the harness bug inside the
 * generated project instead of resolving it.
 */
function manifestChanged(paths) {
  return (paths || []).some(p => {
    const norm = String(p || '').replace(/\\/g, '/');
    return norm === 'package.json' || norm.endsWith('/package.json');
  });
}

module.exports = {
  requestRepair,
  repairUntilVerified,
  parseFilePayload,
  readProjectFiles,
  selectFilesForPrompt,
  hasActionableFailure,
  diffAgainstDisk,
  manifestChanged,
};