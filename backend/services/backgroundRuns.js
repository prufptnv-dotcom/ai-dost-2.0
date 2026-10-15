/**
 * backgroundRuns — P9 long-running work: durable event log + live reattach bus.
 *
 * Contract:
 *  - begin()    registers the run (status 'running') before the first send().
 *  - record()   appends EVERY SSE event to SQLite (never throws into send()).
 *  - finish()   terminal transition (first one wins) + Telegram notify when the
 *               client already walked away from a background run.
 *  - onEvent()  in-process subscriber so a reattach SSE can tail a live run;
 *               listeners are per-run and dropped on finish.
 *  - replay()   ordered persisted events after a seq.
 *
 * Runs are in-process: a server restart orphans them, so initOnce() marks
 * every 'running' row 'interrupted' at boot (honest reattach > infinite wait).
 */
const { getDatabase } = require('../db');
const CopilotRunDAO = require('../db/dao/CopilotRunDAO');
const logger = require('../logger');

const TERMINAL_STATUSES = new Set(['done', 'failed', 'error', 'cancelled', 'interrupted']);

let dao = null;
let booted = false;
let bootFailed = false;
const live = new Map(); // runId -> Set<(event) => void>

function getDao() {
  if (bootFailed) return null;
  try {
    if (!dao) {
      dao = new CopilotRunDAO(getDatabase());
      if (!booted) {
        booted = true;
        const orphans = dao.markInterrupted();
        if (orphans > 0) logger.warn(`[BackgroundRuns] Marked ${orphans} orphaned run(s) interrupted after restart`);
      }
    }
    return dao;
  } catch (e) {
    bootFailed = true;
    logger.warn(`[BackgroundRuns] unavailable (run events not persisted): ${e.message}`);
    return null;
  }
}

function begin({ runId, projectId = null, prompt = '', background = false }) {
  const d = getDao();
  if (!d) return false;
  try {
    d.createRun({ runId, projectId, prompt, background });
    return true;
  } catch (e) {
    logger.warn(`[BackgroundRuns] begin failed for ${runId}: ${e.message}`);
    return false;
  }
}

function record(runId, event) {
  const d = getDao();
  if (!d) return 0;
  try {
    return d.appendEvent(runId, event);
  } catch (e) {
    logger.warn(`[BackgroundRuns] record failed for ${runId}: ${e.message}`);
    return 0;
  }
}

function finish(runId, status, finalMessage = null) {
  const d = getDao();
  let first = false;
  try {
    if (d) first = d.finishRun(runId, status, finalMessage);
  } catch (e) {
    logger.warn(`[BackgroundRuns] finish failed for ${runId}: ${e.message}`);
  }
  const set = live.get(runId);
  if (set) {
    for (const fn of set) {
      try { fn({ type: '__finished__', status }); } catch (_) { /* listener bug must not break the run */ }
    }
    live.delete(runId);
  }
  return first;
}

function get(runId) {
  const d = getDao();
  if (!d) return null;
  try { return d.getRun(runId); } catch (_) { return null; }
}

function replay(runId, afterSeq = 0, limit = 5000) {
  const d = getDao();
  if (!d) return [];
  try {
    return d.listEvents(runId, afterSeq, limit).map(r => {
      let payload;
      try { payload = JSON.parse(r.payload); } catch (_) { payload = null; }
      return payload ? { seq: r.seq, at: r.created_at, event: payload } : null;
    }).filter(Boolean);
  } catch (e) {
    logger.warn(`[BackgroundRuns] replay failed for ${runId}: ${e.message}`);
    return [];
  }
}

function list({ projectId = null, status = null, limit = 30 } = {}) {
  const d = getDao();
  if (!d) return [];
  try { return d.listRuns({ projectId, status, limit }); } catch (_) { return []; }
}

/** Live tail subscription; returns an unsubscribe fn. */
function onEvent(runId, fn) {
  if (!live.has(runId)) live.set(runId, new Set());
  live.get(runId).add(fn);
  return () => {
    const set = live.get(runId);
    if (set) {
      set.delete(fn);
      if (!set.size) live.delete(runId);
    }
  };
}

/** Fan a live event out to reattach listeners (persisted separately via record). */
function publish(runId, event) {
  const set = live.get(runId);
  if (!set) return;
  for (const fn of set) {
    try { fn(event); } catch (_) { /* one bad listener must not kill a run */ }
  }
}

function isLive(runId) {
  return live.has(runId);
}

// ── Telegram notify (optional, best-effort, never fails a run) ───────────────
// Raw Bot API call — deliberately independent of the polling loop so a
// background completion reaches the phone even if the bot singleton isn't
// wired up. Needs an explicit recipient list; without it we honestly skip.
async function notifyTelegram({ runId, status, message }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const ids = (process.env.TELEGRAM_ALLOWED_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!token || !ids.length) return { ok: false, reason: token ? 'no-allowed-ids' : 'no-token' };
  const icon = status === 'done' ? '✅' : status === 'interrupted' ? '🔌' : '⚠️';
  const text = `${icon} *AI-Dost background run ${status}*\n${String(message || '').slice(0, 600)}\n\`${runId}\``;
  const results = [];
  for (const chatId of ids) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      results.push(res.ok);
    } catch (e) {
      logger.info(`[BackgroundRuns] telegram notify failed for ${chatId}: ${e.message}`);
      results.push(false);
    }
  }
  return { ok: results.some(Boolean), sent: results.filter(Boolean).length };
}

/** Test seam — drop state between suites (never used in prod code paths). */
function _resetForTests() {
  dao = null;
  booted = false;
  bootFailed = false;
  live.clear();
}

module.exports = {
  begin,
  record,
  finish,
  get,
  replay,
  list,
  onEvent,
  publish,
  isLive,
  notifyTelegram,
  TERMINAL_STATUSES,
  _resetForTests,
};
