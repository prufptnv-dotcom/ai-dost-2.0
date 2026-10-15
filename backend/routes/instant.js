'use strict';
/**
 * P6 — Instant in-browser execution (WebContainer).
 *
 * Bolt-style: the generated project runs FULLY IN THE BROWSER — no host npm
 * install, no dev-server wait. Architecture:
 *
 *   GET /instant/:projectId        → wrapper page WITH COOP/COEP headers
 *                                     (crossOriginIsolated → SharedArrayBuffer
 *                                     → WebContainer.boot() with NO API key,
 *                                     proven by temp_ui_audit/wc_spike)
 *   GET /api/instant/:projectId/files → FileSystemTree JSON (workspace → mount)
 *   GET /wc/*                      → vendored @webcontainer/api dist (same-origin
 *                                     scripts keep COEP happy — no CDN needed)
 *
 * The wrapper boots, mounts the files, runs `npm install` (their package CDN)
 * + the dev script, then points an inner iframe at `server-ready`. Status is
 * postMessage'd to the parent (PreviewPane) for a live phase chip.
 *
 * Main app stays COOP/COEP-free — only this wrapper page is isolated, so no
 * fonts/CDNs in the app can break.
 *
 * File source policy: the FS workspace (what vite actually serves = truth)
 * first, then SQLite IDE rows for paths the FS does not have. Bounded walk.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const router = express.Router();
const logger = require('../logger');
const projectStore = require('../projectStore');
const workspaceManager = require('../services/workspaceManager');

const WC_DIST = path.join(__dirname, '..', 'node_modules', '@webcontainer', 'api', 'dist');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.cache', 'coverage', '__pycache__', '.venv']);
const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp', 'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'wav', 'zip', 'gz', 'pdf', 'wasm', 'exe', 'dll', 'node', 'db', 'sqlite']);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_DEPTH = 6;

function isolationHeaders(res) {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function safeProjectId(v) {
  const id = String(v || '').trim();
  if (!id || id.length > 80 || id.includes('..') || id.includes('/') || id.includes('\\') || id.includes('\0')) return null;
  return id;
}

/** FS walk → { [relPath]: { file: { contents } } } (bounded, text-ish only). */
function collectFromFs(dir, relBase, out, state, depth) {
  if (depth > MAX_DEPTH || state.files >= MAX_FILES || state.total > MAX_TOTAL_BYTES) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return;
  }
  for (const e of entries) {
    if (state.files >= MAX_FILES || state.total > MAX_TOTAL_BYTES) return;
    const rel = relBase ? `${relBase}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collectFromFs(path.join(dir, e.name), rel, out, state, depth + 1);
      continue;
    }
    if (!e.isFile()) continue;
    if (e.name.startsWith('.') && !/^\.env\.(example|sample|template)$/i.test(e.name)) continue;
    const ext = e.name.includes('.') ? e.name.split('.').pop().toLowerCase() : '';
    if (BINARY_EXT.has(ext)) continue;
    const abs = path.join(dir, e.name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch (_) {
      continue;
    }
    if (st.size > MAX_FILE_BYTES) continue;
    let contents;
    try {
      contents = fs.readFileSync(abs, 'utf8');
    } catch (_) {
      continue;
    }
    // reject non-text (NUL bytes) — fs.readFile utf8 silently mangles binaries
    if (contents.includes('\0')) continue;
    out[rel] = { file: { contents } };
    state.files += 1;
    state.total += st.size;
  }
}

/**
 * Build the FileSystemTree for a project: FS workspace (dev-server truth)
 * first, SQLite IDE rows fill in paths the FS is missing.
 * Returns { files, source, error }.
 */
function buildTree(projectId) {
  const files = {};
  const state = { files: 0, total: 0 };
  let fsCount = 0;
  let dbCount = 0;

  try {
    const dir = workspaceManager.getWorkspacePath(projectId);
    if (dir && fs.existsSync(dir)) {
      collectFromFs(dir, '', files, state, 0);
      fsCount = Object.keys(files).length;
    }
  } catch (e) {
    logger.warn(`[Instant] FS walk failed for ${projectId}: ${e.message}`);
  }

  try {
    const rows = projectStore.getProjectFiles(projectId);
    if (Array.isArray(rows)) {
      for (const r of rows) {
        if (state.files >= MAX_FILES || state.total > MAX_TOTAL_BYTES) break;
        const p = String(r.path || '').replace(/\\/g, '/');
        if (!p || p.includes('..') || p.startsWith('/') || /^[a-zA-Z]:/.test(p)) continue;
        if (files[p]) continue; // FS wins — it is what the dev server serves
        const contents = String(r.content || '');
        if (contents.includes('\0')) continue;
        files[p] = { file: { contents } };
        state.files += 1;
        state.total += Buffer.byteLength(contents);
        dbCount += 1;
      }
    }
  } catch (e) {
    logger.warn(`[Instant] SQLite read failed for ${projectId}: ${e.message}`);
  }

  if (!files['package.json']) {
    return { files, source: `fs:${fsCount} db:${dbCount}`, error: 'no-package-json' };
  }
  return { files, source: `fs:${fsCount} db:${dbCount}`, error: null };
}

// ── FileSystemTree for mounting ──────────────────────────────────────────────
router.get('/api/instant/:projectId/files', (req, res) => {
  const projectId = safeProjectId(req.params.projectId);
  if (!projectId) return res.status(400).json({ error: 'invalid projectId' });
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const { files, source, error } = buildTree(projectId);
    if (error) {
      return res.status(404).json({
        error: 'no-package-json',
        message: 'No package.json in this workspace — nothing to run in-browser. Use Live mode instead.',
        filesMounted: Object.keys(files).length,
        source,
      });
    }
    res.json({ files, source, count: Object.keys(files).length });
  } catch (e) {
    logger.error(`[Instant] files failed for ${projectId}: ${e.message}`);
    res.status(500).json({ error: 'build-failed', message: e.message });
  }
});

// ── vendored WebContainer runtime (same-origin → COEP-safe) ──────────────────
router.get('/wc/*', (req, res) => {
  const rel = String(req.params[0] || '');
  const abs = path.resolve(WC_DIST, rel);
  if (!abs.startsWith(WC_DIST + path.sep) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return res.status(404).send('not found');
  }
  res.setHeader('Content-Type', rel.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(fs.readFileSync(abs));
});

// ── engine reachability preflight (honest fast-fail) ─────────────────────────
// WebContainer.boot() hangs FOREVER if StackBlitz's engine endpoint is down
// (observed 2026-10-08: every /headless?version=* → 404 while the site itself
// is 200 — outage on their side; the spike booted fine a day earlier). The
// wrapper asks THIS route first (server-side probe = no CORS), so users get a
// truthful error in seconds instead of an eternal "booting" bar.
const ENGINE_URL = 'https://stackblitz.com/headless?version=1.6.4';
const ENGINE_CACHE_MS = 30000;
let engineCache = null;

function probeEngineOnce() {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (!settled) {
        settled = true;
        resolve({ ...v, at: Date.now() });
      }
    };
    let req;
    try {
      req = https.get(ENGINE_URL, (r) => {
        r.resume();
        done({ ok: r.statusCode >= 200 && r.statusCode < 400, status: r.statusCode, error: null });
      });
    } catch (e) {
      return done({ ok: false, status: 0, error: String(e.message || e) });
    }
    req.setTimeout(5000, () => {
      req.destroy(new Error('engine probe timeout'));
    });
    req.on('error', (e) => done({ ok: false, status: 0, error: e.message }));
  });
}

router.get('/api/instant/engine-status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const now = Date.now();
  if (engineCache && now - engineCache.at < ENGINE_CACHE_MS) {
    return res.json({ ...engineCache, cached: true });
  }
  engineCache = await probeEngineOnce();
  res.json({ ...engineCache, cached: false });
});

// ── the isolated wrapper page ────────────────────────────────────────────────
router.get('/instant/:projectId', (req, res) => {
  const projectId = safeProjectId(req.params.projectId);
  if (!projectId) return res.status(400).send('invalid projectId');
  isolationHeaders(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderWrapper(projectId));
});

function renderWrapper(projectId) {
  // NOTE: plain string concat only — no nested template literals (node --check
  // + prompt-template backtick gotchas in this repo).
  const boot = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>AI-Dost Instant Run</title><style>',
    'body{margin:0;background:#090a0f;color:#e5e7eb;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;display:flex;flex-direction:column;height:100vh}',
    '#bar{padding:8px 12px;border-bottom:1px solid #1e2233;background:#131622;display:flex;gap:10px;align-items:center;flex-shrink:0}',
    '#phase{color:#818cf8;font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:.08em}',
    '#note{color:#6b7280;font-size:10px;margin-left:auto}',
    '#log{padding:8px 12px;max-height:110px;overflow:auto;color:#9ca3af;font-size:11px;flex-shrink:0;border-bottom:1px solid #1e2233;white-space:pre-wrap}',
    '#log .err{color:#f87171}#log .ok{color:#34d399}',
    '#frame{flex:1;border:0;width:100%;background:#fff}',
    '#booting{padding:24px;color:#6b7280}',
    '.spin{display:inline-block;width:9px;height:9px;border:2px solid #4b5563;border-top-color:#818cf8;border-radius:50%;animation:sp 1s linear infinite;vertical-align:-1px}',
    '@keyframes sp{to{transform:rotate(360deg)}}',
    '</style></head><body>',
    '<div id="bar"><span class="spin"></span><span id="phase">starting</span>',
    '<span id="note">runs in YOUR browser &mdash; no server install</span></div>',
    '<div id="log"></div>',
    '<div id="booting">Booting in-browser runtime&hellip;</div>',
    '<iframe id="frame" style="display:none" sandbox="allow-scripts allow-forms allow-modals allow-same-origin"></iframe>',
    '<script type="module">',
    "const PROJECT = " + JSON.stringify(projectId) + ';',
    "const filesUrl = '/api/instant/' + encodeURIComponent(PROJECT) + '/files';",
    "const $ = (id) => document.getElementById(id);",
    "const phaseEl = $('phase'); const logEl = $('log');",
    "window.__instant = { phase: 'init', readyUrl: null, error: null, log: [] };",
    "function say(p, msg, cls) {",
    "  window.__instant.phase = p; window.__instant.log.push(p + ': ' + msg);",
    "  phaseEl.textContent = p.replace(/-/g, ' ');",
    "  const line = document.createElement('div'); if (cls) line.className = cls;",
    "  line.textContent = msg; logEl.appendChild(line); logEl.scrollTop = logEl.scrollHeight;",
    "  try { parent.postMessage({ source: 'aidost-instant', phase: p, message: msg, project: PROJECT }, '*'); } catch (e) {}",
    "}",
    "function fatal(p, msg) {",
    "  window.__instant.error = msg; say(p, msg, 'err');",
    "  const b = document.createElement('div');",
    "  b.innerHTML = '<p style=\"color:#f87171\">' + msg + '</p>' +",
    "    '<p>Instant mode could not run this project. Use <b>Mode: Proxy</b> (Live) for the full-stack preview.</p>';",
    "  $('booting').replaceChildren(b); $('booting').style.display = 'block';",
    "  $('frame').style.display = 'none';",
    "}",
    "try {",
    "  say('booting', 'Booting WebContainer (crossOriginIsolated=' + window.crossOriginIsolated + ')');",
    "  if (!window.crossOriginIsolated) throw new Error('page is not crossOriginIsolated — COOP/COEP headers missing');",
    "  say('engine', 'Checking engine endpoint reachability…');",
    "  const engine = await (await fetch('/api/instant/engine-status')).json().catch(() => ({ ok: false, status: 0, error: 'status probe failed' }));",
    "  if (!engine.ok) {",
    "    throw new Error('WebContainer engine UNREACHABLE — StackBlitz /headless returned ' + (engine.status || engine.error || 'no response') + ' (their outage, not yours). Instant mode is down RIGHT NOW — use Mode: Proxy meanwhile.');",
    "  }",
    "  say('engine', 'Engine endpoint OK (HTTP ' + engine.status + ')', 'ok');",
    "  const { WebContainer } = await import('/wc/index.js');",
    "  say('booting', 'Runtime imported');",
    "  const wc = await Promise.race([",
    "    WebContainer.boot(),",
    "    new Promise((_, rej) => setTimeout(() => rej(new Error('engine handshake timed out after 45s — their /headless endpoint may be flaky; reload to retry')), 45000)),",
    "  ]);",
    "  say('booted', 'WebContainer booted (no API key)', 'ok');",
    "  $('booting').style.display = 'none';",
    "  say('files', 'Fetching project files…');",
    "  const resp = await fetch(filesUrl);",
    "  const data = await resp.json();",
    "  if (!resp.ok || data.error) throw new Error(data.message || data.error || ('files HTTP ' + resp.status));",
    "  say('files', 'Mounting ' + data.count + ' files (' + data.source + ')…');",
    "  await wc.mount(data.files);",
    "  say('mounted', 'Filesystem mounted', 'ok');",
    "  let pkg = {};",
    "  try { pkg = JSON.parse((data.files['package.json'] || {}).file ? data.files['package.json'].file.contents : '{}'); } catch (e) {}",
    "  const scripts = pkg.scripts || {};",
    "  const devCmd = scripts.dev || scripts.start;",
    "  if (!devCmd) throw new Error('package.json has no dev/start script');",
    "  const startText = String(scripts.start || '');",
    "  const devText = String(scripts.dev || '');",
    "  const needApi = startText && /node\\b|server\\.js/.test(startText) && !/node\\b|server\\.js|concurrently/.test(devText);",
    "  if (needApi) {",
    "    say('api', 'Starting backend process: npm run start');",
    "    const apiProc = await wc.spawn('npm', ['run', 'start']);",
    "    apiProc.output.pipeTo(new WritableStream({ write: (d) => { const t = String(d).trim(); if (t) window.__instant.log.push('api: ' + t); } })).catch(() => {});",
    "    apiProc.exit.then(() => say('api', 'backend process exited')).catch(() => {});",
    "  }",
    "  say('install', 'npm install in-browser (CDN, cached)…');",
    "  const inst = await wc.spawn('npm', ['install']);",
    "  inst.output.pipeTo(new WritableStream({ write: (d) => { const t = String(d).trim(); if (t && /error|warn ERR/i.test(t)) say('install', t, 'err'); } })).catch(() => {});",
    "  const code = await inst.exit;",
    "  if (code !== 0) throw new Error('npm install exited with code ' + code);",
    "  say('install', 'Dependencies installed', 'ok');",
    "  let resolved = false;",
    "  wc.on('server-ready', (port, url) => {",
    "    if (resolved) return; resolved = true;",
    "    window.__instant.readyUrl = url;",
    "    say('ready', 'Ready on port ' + port + ' — rendering app', 'ok');",
    "    $('frame').src = url;",
    "    $('frame').style.display = 'block';",
    "  });",
    "  say('running', 'Running: npm run ' + (scripts.dev ? 'dev' : 'start'));",
    "  const dev = await wc.spawn('npm', ['run', scripts.dev ? 'dev' : 'start']);",
    "  dev.output.pipeTo(new WritableStream({ write: (d) => { const t = String(d).trim(); if (t) say('dev', t); } })).catch(() => {});",
    "  dev.exit.then((c) => { if (!resolved) fatal('dev', 'dev process exited (' + c + ') before the server was ready'); }).catch(() => {});",
    "  setTimeout(() => { if (!resolved && !window.__instant.error) fatal('timeout', 'No server-ready after 120s — see log above'); }, 120000);",
    "} catch (e) {",
    "  fatal('error', String((e && e.message) || e));",
    "}",
    '</script></body></html>',
  ];
  return boot.join('');
}

module.exports = router;
module.exports.buildTree = buildTree;
module.exports.renderWrapper = renderWrapper;
