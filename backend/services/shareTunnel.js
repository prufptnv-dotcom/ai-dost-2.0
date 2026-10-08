'use strict';
/**
 * P7 — Share URL (free, zero-install, scoped).
 *
 * Replit-style "share my running app" without any cloud account:
 *
 *   1. A SCOPED share server listens on a random 127.0.0.1 port and only
 *      forwards ONE project's preview/instant paths to the backend. The public
 *      URL never sees /api/agent, /api/document, settings — nothing else.
 *      Access requires a per-share secret key (`?key=` on first visit, then an
 *      HttpOnly cookie), compared in constant time.
 *   2. A free tunnel publishes that port:
 *        provider 1: cloudflared quick tunnel (binary auto-downloaded once
 *                     to backend/data/bin — stable https://*.trycloudflare.com,
 *                     no account, no expiry while in use)
 *        provider 2: serveo.net SSH (zero-install fallback; anonymous mode is
 *                     rate-limited → TCP link with interstitial + short life)
 *      If both fail, we return an honest `tunnel-unavailable` error with a
 *      hint — we never fake a URL. (localhost.run anonymous -R tunnels stopped
 *      working: the remote now rejects "listen port 0" forwards.)
 *
 * SECURITY: the share proxy is a deliberate, key-gated local gateway. It strips
 * tunnel-added identity headers (X-Forwarded-For / Origin / Referer / Cf-*)
 * before proxying so localApiGuard evaluates THIS hop's real TCP peer
 * (127.0.0.1) instead of the visitor's public IP — path scoping + the secret
 * key remain the boundary; an attacker without the key never passes gate one.
 *
 * Records are in-memory: after a backend restart the user re-shares (the tunnel
 * subdomain would change anyway).
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const net = require('net');
const logger = require('../logger');

const COOKIE_NAME = 'aidost_share';

/** Hostnames that are noise in tunnel output (their own docs/marketing links). */
const URL_DENYLIST = new Set(['localhost.run', 'serveo.net', 'github.com', 'localhost.run.']);

function safeEqual(a, b) {
  try {
    const ba = Buffer.from(String(a || ''));
    const bb = Buffer.from(String(b || ''));
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch (_) {
    return false;
  }
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/**
 * Pull the first plausible tunnel URL out of provider output.
 * Exported for unit tests — feed it captured provider stdout/stderr.
 */
function extractTunnelUrl(provider, text) {
  const s = String(text || '');

  if (provider === 'cloudflared') {
    const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    return m ? m[0] : null;
  }

  if (provider === 'serveo') {
    // HTTP subdomain mode (granted only when free HTTP quota allows):
    const h = s.match(/https:\/\/[a-z0-9-]+\.serveo\.net/);
    if (h) return h[0];
    // Anonymous TCP mode: "Forwarding TCP connections from host:port"
    const t = s.match(/Forwarding TCP connections from ([a-z0-9.-]+):(\d+)/i);
    if (t) return `http://${t[1]}:${t[2]}`;
    return null;
  }

  // Generic fallback for other providers: an https URL that is not marketing.
  const urls = s.match(/https:\/\/[^\s'"<>]+/g) || [];
  for (const raw of urls) {
    const u = raw.replace(/[),.;]+$/, '');
    let host;
    try {
      host = new URL(u).hostname;
    } catch (_) {
      continue;
    }
    if (URL_DENYLIST.has(host)) continue;
    if (host.split('.').length < 2) continue;
    return u;
  }
  return null;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close((err) => (err ? reject(err) : resolve(p)));
    });
  });
}

/** pathname must be exactly `prefix` or under `prefix/` (segment boundary). */
function within(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

function isAllowedPath(pathname, projectId) {
  return (
    pathname === '/' ||
    within(pathname, `/api/preview/${projectId}`) ||
    within(pathname, `/instant/${projectId}`) ||
    within(pathname, `/api/instant/${projectId}`) ||
    pathname.startsWith('/wc/') // vendored WebContainer runtime (P6), inert JS
  );
}

/**
 * The scoped server: gate on the key, then proxy only this project's paths.
 * `opts.proxyPort` lets unit tests point it at a fake backend.
 */
function startShareServer(projectId, key, opts = {}) {
  const proxyPort = opts.proxyPort || Number(process.env.PORT || 5000);

  const server = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url, 'http://share.local');
    } catch (_) {
      res.writeHead(400).end('bad request');
      return;
    }
    const pathname = url.pathname;

    if (!isAllowedPath(pathname, projectId)) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<h1>403 — not part of this shared preview</h1><p>This AI-Dost share exposes only the project preview.</p>'
      );
      return;
    }

    const qKey = url.searchParams.get('key') || '';
    const cKey = parseCookies(req.headers.cookie)[COOKIE_NAME] || '';
    const valid = safeEqual(qKey, key) || safeEqual(cKey, key);

    if (!valid) {
      // NEVER mint a cookie from a failed attempt — a wrong ?key must get
      // nothing but 403 (regression: this branch once sat inside `!valid`).
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<h1>403 — invalid share link</h1><p>Ask the owner for the full link including its <code>?key=</code>.</p>'
      );
      return;
    }

    // valid link on first visit → mint the cookie (secret leaves the URL) and
    // land directly on this project's preview root
    if (pathname === '/' && !cKey) {
      res.writeHead(302, {
        'Set-Cookie': `${COOKIE_NAME}=${key}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
        Location: `/api/preview/${projectId}/`,
      });
      res.end();
      return;
    }
    const targetPath = pathname === '/' ? `/api/preview/${projectId}/` + url.search : req.url;

    const headers = { ...req.headers, host: `127.0.0.1:${proxyPort}` };
    delete headers['accept-encoding']; // pipe the body untouched
    // ── hop identity (see file header) ──────────────────────────────────────
    // The backend runs `trust proxy = loopback`, so cloudflared's public
    // X-Forwarded-For would become req.ip → localApiGuard LOCAL_ONLY 403.
    // The TCP peer of THIS connection really is 127.0.0.1 — evaluate that.
    // Tunnel Origin/Referer are likewise non-local and would trip
    // isCrossSiteBrowser on POSTs (preview telemetry) from the shared page.
    delete headers['x-forwarded-for'];
    delete headers['x-forwarded-proto'];
    delete headers['x-forwarded-host'];
    delete headers['x-real-ip'];
    delete headers.origin;
    delete headers.referer;
    for (const k of Object.keys(headers)) {
      if (k.startsWith('cf-')) delete headers[k];
    }
    const upstream = http.request(
      { host: '127.0.0.1', port: proxyPort, method: req.method, path: targetPath, headers },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      }
    );
    upstream.on('error', (e) => {
      logger.warn(`[Share] upstream ${projectId}: ${e.message}`);
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('backend unreachable');
    });
    req.pipe(upstream);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port || 0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ── cloudflared bootstrap (one-time download) ────────────────────────────────
function cloudflaredPath() {
  return path.join(__dirname, '..', 'data', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
}

function httpsDownload(url, dest, redirectsLeft = 5, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        httpsDownload(res.headers.location, dest, redirectsLeft - 1, timeoutMs).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`download HTTP ${res.statusCode}`));
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close((e) => (e ? reject(e) : resolve())));
      out.on('error', reject);
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('download timeout')));
    req.on('error', reject);
  });
}

/** Return the cloudflared binary path, downloading it on first use (~55MB). */
async function ensureCloudflared() {
  const bin = cloudflaredPath();
  try {
    const st = await fs.promises.stat(bin);
    if (st.size > 5 * 1024 * 1024) return bin;
  } catch (_) {
    /* not downloaded yet */
  }
  const url =
    process.platform === 'win32'
      ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
      : process.arch === 'arm64'
        ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64'
        : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
  await fs.promises.mkdir(path.dirname(bin), { recursive: true });
  const tmp = `${bin}.part`;
  logger.info('[Share] downloading cloudflared (one-time, ~55MB)…');
  await httpsDownload(url, tmp);
  const st = await fs.promises.stat(tmp);
  if (st.size < 5 * 1024 * 1024) throw new Error(`cloudflared download truncated (${st.size} bytes)`);
  try {
    await fs.promises.unlink(bin);
  } catch (_) {}
  await fs.promises.rename(tmp, bin);
  logger.info('[Share] cloudflared ready');
  return bin;
}

/** Spawn a tunnel process; resolve {child, url} on first parsed URL. */
function spawnTunnel(bin, args, parse, timeoutMs) {
  return new Promise((resolve) => {
    let out = '';
    let settled = false;
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const done = (url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ child, url });
    };
    const onData = (buf) => {
      out += buf.toString('utf8');
      const u = parse(out);
      if (u) done(u);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => {
      out += `\nspawn-error: ${e.message}`;
      done(null);
    });
    child.on('exit', () => done(null));
    const timer = setTimeout(() => {
      if (!settled) {
        try {
          child.kill();
        } catch (_) {}
        done(null);
      }
    }, timeoutMs);
  });
}

/**
 * Spawn one tunnel provider and resolve with its public URL (or null on
 * timeout/failure). cloudflared = stable https quick tunnel (binary fetched
 * on first use); serveo = SSH fallback (anonymous quota-limited).
 */
async function openTunnel(provider, localPort, timeoutMs = 30000) {
  if (provider === 'cloudflared') {
    let bin;
    try {
      bin = await ensureCloudflared();
    } catch (e) {
      logger.warn(`[Share] cloudflared unavailable: ${e.message}`);
      return { child: null, url: null };
    }
    return spawnTunnel(
      bin,
      ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${localPort}`],
      (out) => extractTunnelUrl('cloudflared', out),
      timeoutMs
    );
  }

  if (provider === 'serveo') {
    const isWin = process.platform === 'win32';
    return spawnTunnel(
      'ssh',
      [
        '-o', 'StrictHostKeyChecking=no',
        '-o', `UserKnownHostsFile=${isWin ? 'NUL' : '/dev/null'}`,
        '-o', 'ConnectTimeout=8',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=3',
        '-T',
        '-R', `0:localhost:${localPort}`,
        'serveo.net',
      ],
      (out) => extractTunnelUrl('serveo', out),
      timeoutMs
    );
  }

  return { child: null, url: null };
}

/** projectId → record */
const shares = new Map();

/**
 * Start (or return the existing) share for a project.
 * `opts.tunnel:false` skips SSH — used by unit tests and local diagnostics.
 */
async function startShare(projectId, opts = {}) {
  if (!projectId) throw new Error('projectId required');
  const existing = shares.get(projectId);
  if (existing && existing.active) return describe(existing);
  if (existing) {
    // stale record (tunnel died / was stopped) — reclaim its server + port
    // before replacing, otherwise every re-share leaks a listener
    try {
      existing.server && existing.server.close();
    } catch (_) {}
    if (existing.ssh) {
      try {
        existing.ssh.kill();
      } catch (_) {}
    }
    shares.delete(projectId);
  }

  const key = crypto.randomBytes(18).toString('base64url');
  const { server, port } = await startShareServer(projectId, key, opts);
  const record = {
    projectId,
    key,
    sharePort: port,
    server,
    provider: null,
    url: null,
    ssh: null,
    active: true,
    startedAt: Date.now(),
    lastError: null,
  };
  shares.set(projectId, record);

  if (opts.tunnel === false) {
    record.provider = 'none';
    return describe(record);
  }

  for (const provider of ['cloudflared', 'serveo']) {
    try {
      const { child, url } = await openTunnel(provider, port, opts.tunnelTimeoutMs || 30000);
      if (url) {
        record.provider = provider;
        record.url = url;
        record.ssh = child;
        child.on('exit', () => {
          record.active = false;
          record.ssh = null;
          record.url = null;
          logger.info(`[Share] tunnel for ${projectId} closed`);
        });
        logger.info(`[Share] ${projectId} → ${url} (via ${provider})`);
        return describe(record);
      }
      try { child && child.kill(); } catch (_) {}
    } catch (e) {
      record.lastError = e.message;
      logger.warn(`[Share] provider ${provider} failed: ${e.message}`);
    }
  }

  // no tunnel — keep the scoped server (still useful for LAN/local links) but be honest
  record.provider = null;
  record.lastError = 'tunnel-unavailable: outbound SSH (22/443) blocked or both providers down';
  record.active = false;
  record.ssh = null;
  return describe(record);
}

function describe(record) {
  const base = record.url ? String(record.url).replace(/\/+$/, '') : null;
  let hint = null;
  if (!base) {
    hint =
      'Tunnel unavailable (cloudflared download failed and SSH fallback blocked). ' +
      'Share over LAN instead: http://<this-machine-ip>:' +
      record.sharePort;
  } else if (record.provider === 'serveo') {
    hint =
      'serveo free-tier link: HTTP warning page on first load, expires after ~10 min idle. ' +
      'Prefer cloudflared (auto-downloaded) for a stable https link.';
  }
  return {
    success: Boolean(base),
    projectId: record.projectId,
    url: base ? `${base}/?key=${record.key}` : null,
    key: record.key,
    provider: record.provider,
    localPort: record.sharePort,
    active: record.active,
    lastError: record.lastError,
    hint,
  };
}

function getShare(projectId) {
  const r = shares.get(projectId);
  return r ? describe(r) : { success: false, projectId, active: false, url: null };
}

async function stopShare(projectId) {
  const r = shares.get(projectId);
  if (!r) return { success: false, error: 'no active share' };
  r.active = false;
  if (r.ssh) {
    try { r.ssh.kill(); } catch (_) {}
    r.ssh = null;
  }
  if (r.server) {
    try { r.server.close(); } catch (_) {}
  }
  shares.delete(projectId);
  return { success: true };
}

function stopAllShares() {
  for (const id of Array.from(shares.keys())) stopShare(id).catch(() => {});
}

function listShares() {
  return Array.from(shares.values()).map(describe);
}

module.exports = {
  startShare,
  getShare,
  stopShare,
  stopAllShares,
  listShares,
  startShareServer,
  extractTunnelUrl,
  isAllowedPath,
  parseCookies,
};
