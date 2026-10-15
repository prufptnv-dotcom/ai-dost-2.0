/**
 * opencodeService.js — OpenCode platform gateway provider (P10.1)
 *
 * Routes LLM calls through the locally installed OpenCode server:
 *   POST /session  {directory}                       -> session id
 *   POST /session/:id/message {parts, model, ...}    -> {info, parts[]}
 * Text is extracted from `parts[]` (type === 'text').
 *
 * No API key is required — OpenCode's own platform gateway supplies auth
 * (verified live: 9 free models, cost 0, ~8-13s warm per call).
 *
 * Safety:
 *   - The headless server AND every session run inside a scratch temp dir
 *     (`%TEMP%\aidost-opencode-gen`), never inside the AI-Dost repo. The
 *     `build` agent's external-directory permission is `ask` → non-interactive
 *     calls are denied, so it cannot write outside the scratch dir.
 *   - Server binds 127.0.0.1 with basic auth; the password is random per boot
 *     and stored only in a local state file (tmp).
 *   - Windows P0 rules: real `.exe` spawns directly with shell:false; `.cmd`
 *     wrappers go through cmd.exe with literal-args guard (no metacharacters).
 *
 * Server lifecycle: one headless `opencode serve` is shared across calls.
 * State file `{baseUrl, password, pid}` enables reuse across backend restarts;
 * a health probe decides reuse vs respawn.
 *
 * Env:
 *   OPENCODE_ENABLED=false        disable provider entirely
 *   OPENCODE_BIN=/path/to/opencode  override binary resolution
 *   OPENCODE_PORT=4789            preferred port for our headless server
 *   OPENCODE_MODEL=provider/model default model (free platform gateway)
 *   OPENCODE_TIMEOUT_MS=60000     per-request timeout
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const logger = require('../logger');

const SCRATCH_DIR = path.join(os.tmpdir(), 'aidost-opencode-gen');
const STATE_FILE = path.join(os.tmpdir(), 'aidost-opencode-state.json');
const DEFAULT_MODEL = 'opencode/mimo-v2.6-flash-free';
const DEFAULT_PORT = 4789;
const DEFAULT_TIMEOUT_MS = 60000;
const HEALTH_TRIES = 30;
const HEALTH_INTERVAL_MS = 500;

/** @type {string|null|undefined} undefined = unresolved, null = not found */
let binaryCache;
/** In-flight ensureServer (concurrent cascade calls share one spawn). */
let serverPromise = null;

function envInt(name, fallback) {
  const v = parseInt(process.env[name] || '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function basicAuth(password) {
  return 'Basic ' + Buffer.from(`opencode:${password}`, 'utf8').toString('base64');
}

/**
 * Resolve the real opencode executable. The npm shim (`opencode.cmd`) cannot be
 * spawned directly on Windows (spawn EINVAL — see P0), so real `.exe` paths are
 * preferred and PATH lookup is a last resort.
 */
function resolveBinary() {
  if (binaryCache !== undefined) return binaryCache;
  const candidates = [];
  if (process.env.OPENCODE_BIN) candidates.push(process.env.OPENCODE_BIN);
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'npm', 'node_modules', 'opencode-ai', 'bin', 'opencode.exe'));
  }
  candidates.push(path.join(os.homedir(), '.local', 'bin', 'opencode'));
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) { binaryCache = c; return c; }
    } catch (_) { /* keep looking */ }
  }
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['opencode'], {
      encoding: 'utf8', timeout: 3000,
    }).split(/\r?\n/)[0].trim();
    if (out) { binaryCache = out; return out; }
  } catch (_) { /* not on PATH */ }
  binaryCache = null;
  return null;
}

function isEnabled() {
  if (process.env.OPENCODE_ENABLED === 'false') return false;
  return Boolean(resolveBinary());
}

/** Windows P0: reject any arg that could restructure a command line. */
function assertSafeArgs(args) {
  const BAD = /[;&|<>$()`\n\r"^%!]/;
  for (const a of args) {
    if (BAD.test(String(a))) throw new Error(`opencodeService: unsafe spawn arg rejected: ${String(a).slice(0, 40)}`);
  }
}

function spawnSafe(bin, args, opts) {
  assertSafeArgs(args);
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)) {
    // cmd.exe /s strips the outer quotes; inner quotes keep a spaced .cmd path intact.
    const cmdline = [`"${bin}"`, ...args].join(' ');
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${cmdline}"`], { ...opts, shell: false });
  }
  return spawn(bin, args, { ...opts, shell: false });
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) { return null; }
}

function writeState(state) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)); } catch (_) { /* non-fatal */ }
}

async function probe(baseUrl, password, timeoutMs = 2500) {
  try {
    const res = await fetch(`${baseUrl}/session`, {
      headers: { Authorization: basicAuth(password) },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function ensureServer() {
  if (!isEnabled()) {
    throw new Error('OpenCode binary not found (set OPENCODE_BIN or install opencode) / OPENCODE_ENABLED=false');
  }
  if (serverPromise) return serverPromise;
  serverPromise = (async () => {
    try {
      // 1. Reuse the recorded server if it still answers with our password
      //    (survives backend restarts — the orphaned server keeps serving).
      const state = readState();
      if (state && state.baseUrl && state.password && (await probe(state.baseUrl, state.password))) {
        return state;
      }

      // 2. Fresh spawn (cwd = scratch so the build agent lives in a sandbox dir).
      const bin = resolveBinary();
      if (!bin) throw new Error('OpenCode binary not found');
      const password = crypto.randomBytes(18).toString('hex');
      const port = envInt('OPENCODE_PORT', DEFAULT_PORT);
      const baseUrl = `http://127.0.0.1:${port}`;
      fs.mkdirSync(SCRATCH_DIR, { recursive: true });

      const child = spawnSafe(bin, ['serve', '--port', String(port), '--hostname', '127.0.0.1'], {
        cwd: SCRATCH_DIR,
        env: { ...process.env, OPENCODE_SERVER_PASSWORD: password },
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('error', (err) => logger.warn('[OpenCode] serve spawn error:', err.message));
      let spawnError = null;
      child.once('error', (err) => { spawnError = err; });
      child.unref?.();

      let alive = false;
      for (let i = 0; i < HEALTH_TRIES; i++) {
        await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error(`OpenCode serve exited early (code=${child.exitCode})${spawnError ? `: ${spawnError.message}` : ''} — port ${port} busy?`);
        }
        if (await probe(baseUrl, password, 1200)) { alive = true; break; }
      }
      if (!alive) throw new Error(`OpenCode serve did not become healthy on ${baseUrl} in ${HEALTH_TRIES * HEALTH_INTERVAL_MS}ms`);

      const fresh = { baseUrl, password, pid: child.pid, startedAt: Date.now() };
      writeState(fresh);
      logger.info(`[OpenCode] headless server ready at ${baseUrl} (pid ${child.pid})`);
      return fresh;
    } finally {
      // Allow a future call to retry a failed spawn (clear the memo only on failure).
    }
  })();
  try {
    return await serverPromise;
  } catch (err) {
    serverPromise = null; // self-heal: next call retries
    throw err;
  }
}

function parseModel(spec) {
  const s = String(spec || process.env.OPENCODE_MODEL || DEFAULT_MODEL).trim();
  const idx = s.indexOf('/');
  if (idx <= 0 || idx === s.length - 1) {
    throw new Error(`OpenCode: invalid model spec "${s}" (expected provider/model)`);
  }
  return { providerID: s.slice(0, idx), modelID: s.slice(idx + 1) };
}

function formatHistory(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const lines = history.slice(-8).map((h) => {
    const role = (h && h.role ? h.role : 'user').toUpperCase();
    const content = h && typeof h.content === 'string' ? h.content : '';
    return `${role}: ${content}`;
  });
  return lines.join('\n') + '\n\n';
}

async function request(baseUrl, password, pathname, { method = 'POST', body, timeoutMs }) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { Authorization: basicAuth(password), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenCode API ${method} ${pathname} -> HTTP ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`OpenCode API ${pathname} returned non-JSON: ${text.slice(0, 120)}`);
  }
}

class OpenCodeService {
  /** Fast pre-check (no spawn) — used by cascade builders to skip cleanly. */
  static isAvailable() {
    return isEnabled();
  }

  /** Resolved default model spec ("provider/model"). */
  static defaultModel() {
    return process.env.OPENCODE_MODEL || DEFAULT_MODEL;
  }

  /**
   * Drop-in chat() compatible with llmCascade services:
   *   chat(message, history = [], mode = 'agent', customKey = null, options = {})
   * Returns the assistant reply as a string; throws on any failure so callers'
   * cascade loops can move on. `options.model` / `options.timeoutMs` override
   * defaults; `customKey` is honored when it looks like a model spec.
   */
  static async chat(message, history = [], mode = 'agent', customKey = null, options = {}) {
    if (typeof message !== 'string' || !message.trim()) {
      throw new Error('OpenCode: empty prompt');
    }
    const timeoutMs = options.timeoutMs || envInt('OPENCODE_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
    const modelSpec = (options.model || (typeof customKey === 'string' && customKey.includes('/') ? customKey : null) || OpenCodeService.defaultModel());
    const model = parseModel(modelSpec);

    const { baseUrl, password } = await ensureServer();
    const session = await request(baseUrl, password, '/session', {
      body: { directory: SCRATCH_DIR },
      timeoutMs: Math.min(timeoutMs, 15000),
    });
    if (!session || !session.id) throw new Error('OpenCode: session create returned no id');

    let out;
    try {
      out = await request(baseUrl, password, `/session/${session.id}/message`, {
        body: {
          parts: [{ type: 'text', text: formatHistory(history) + message }],
          model: { providerID: model.providerID, modelID: model.modelID },
          agent: 'build',
          mode: 'primary',
        },
        timeoutMs,
      });
    } finally {
      // Best-effort cleanup so AI-Dost calls don't pollute the user's TUI list.
      try {
        fetch(`${baseUrl}/session/${session.id}`, {
          method: 'DELETE',
          headers: { Authorization: basicAuth(password) },
          signal: AbortSignal.timeout(2000),
        }).catch(() => {});
      } catch (_) { /* ignore */ }
    }

    const parts = Array.isArray(out && out.parts) ? out.parts : [];
    const reply = parts
      .filter((p) => p && p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim();
    if (!reply) {
      throw new Error(`OpenCode: empty reply (finish=${(out && out.info && out.info.finish) || 'unknown'})`);
    }
    return reply;
  }

  /** Reset memoized state (tests). */
  static _resetForTests() {
    binaryCache = undefined;
    serverPromise = null;
  }

  /** Internals exposed for unit tests. */
  static _internals = {
    parseModel,
    formatHistory,
    resolveBinary,
    isEnabled,
    assertSafeArgs,
    SCRATCH_DIR,
    STATE_FILE,
    DEFAULT_MODEL,
  };
}

module.exports = OpenCodeService;
