const express = require('express');
const router = express.Router();
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const devServerManager = require('../sandbox/devServerManager');
const workspaceManager = require('../services/workspaceManager');
const logger = require('../logger');

const { Database } = (() => {
  try { return require('better-sqlite3'); } catch(_) { return {}; }
})();
const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

function getFileFromDb(projectId, filePath) {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const row = db.prepare('SELECT content FROM workspace_files WHERE project_id = ? AND path = ?').get(projectId, filePath);
    db.close();
    return row ? (row.content || '') : null;
  } catch (_) { return null; }
}

function getAllFilesFromDb(projectId) {
  try {
    const db = new Database(DB_PATH, { readonly: true });
    const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
    db.close();
    return rows;
  } catch (_) { return []; }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.java': 'text/plain; charset=utf-8',
  '.c': 'text/plain; charset=utf-8',
  '.cpp': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

function workspaceOf(projectId) {
  return workspaceManager.getWorkspacePath(projectId);
}

function safeJoin(root, rel) {
  const target = path.resolve(root, (rel || '').replace(/^\/+/, ''));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

function findIndexHtml(dir) {
  if (!fs.existsSync(dir)) return null;
  const root = path.join(dir, 'index.html');
  if (fs.existsSync(root)) return 'index.html';
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !['node_modules', '.git', '.checkpoints'].includes(e.name)) {
        const sub = findIndexHtml(path.join(dir, e.name));
        if (sub) return path.posix.join(e.name, sub);
      }
    }
  } catch (_) {}
  return null;
}

// Helper: Proxy HTTP request to backend dev server
function proxyToDevServer(req, res, server, relPath = '') {
  const hostPort = server.hostPort;
  const targetPath = '/' + relPath.replace(/^\/+/, '') + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');

  const headers = { ...req.headers };
  headers['host'] = `127.0.0.1:${hostPort}`;
  headers['x-forwarded-for'] = req.ip || req.connection.remoteAddress;
  headers['x-forwarded-proto'] = req.protocol;
  headers['x-forwarded-host'] = req.headers.host;

  const proxyReq = http.request({
    host: '127.0.0.1',
    port: hostPort,
    path: targetPath,
    method: req.method,
    headers: headers,
    timeout: 30000
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    logger.warn(`[Preview Proxy] Proxy error to 127.0.0.1:${hostPort}:`, err.message);
    if (!res.headersSent) {
      res.status(502).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Dev Server Gateway Error</title></head>
        <body style="background:#090a0f;color:#f87171;font-family:sans-serif;padding:30px;">
          <h2>⚠️ Dev Server Gateway Error</h2>
          <p>Could not proxy request to live dev server on port ${hostPort}.</p>
          <pre style="background:#18181b;padding:15px;border-radius:8px;color:#cbd5e1;">${err.message}</pre>
          <button onclick="location.reload()" style="background:#4f46e5;color:white;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;">Retry</button>
        </body>
        </html>
      `);
    }
  });

  req.pipe(proxyReq);
}

// ── HTML Rendering for Dev Server States ────────────────────────────────────
function renderStartingHtml(projectId, server) {
  const logs = (server?.logs || []).slice(-15).map(l => `<div>[${new Date(l.timestamp).toLocaleTimeString()}] ${l.message}</div>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="2">
  <title>Starting Dev Server — ${projectId}</title>
  <style>
    body { background: #090a0f; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #11141f; border: 1px solid #27272a; border-radius: 16px; padding: 32px; max-width: 580px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; }
    .spinner { width: 44px; height: 44px; border: 3px solid #27272a; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 18px; margin: 0 0 8px; color: #ffffff; }
    p { font-size: 13px; color: #94a3b8; margin: 0 0 20px; }
    .logs { background: #050608; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; text-align: left; max-height: 160px; overflow-y: auto; color: #38bdf8; line-height: 1.5; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div class="badge">STATE: ${server?.state || 'STARTING'}</div>
    <h2>Booting Dev Server...</h2>
    <p>Starting ${server?.framework || 'Web'} application inside the persistent workspace.</p>
    <div class="logs">
      ${logs || '<div>Initializing dependencies and runtime...</div>'}
    </div>
  </div>
</body>
</html>`;
}

function renderFailedHtml(projectId, server) {
  const errorText = server?.error || 'Dev server crashed during execution';
  const logs = (server?.logs || []).slice(-20).map(l => `<div>${l.message}</div>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Dev Server Failed — ${projectId}</title>
  <style>
    body { background: #090a0f; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #11141f; border: 1px solid #ef444440; border-radius: 16px; padding: 32px; max-width: 640px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    h2 { font-size: 18px; margin: 0 0 8px; color: #f87171; display: flex; align-items: center; gap: 8px; }
    p { font-size: 13px; color: #94a3b8; margin: 0 0 16px; }
    .err-box { background: rgba(239, 68, 68, 0.1); border: 1px solid #ef444430; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #fca5a5; margin-bottom: 16px; word-break: break-all; }
    .logs { background: #050608; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; max-height: 180px; overflow-y: auto; color: #94a3b8; margin-bottom: 20px; }
    .actions { display: flex; gap: 10px; }
    button { padding: 10px 18px; border-radius: 8px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; }
    .btn-retry { background: #6366f1; color: white; }
    .btn-retry:hover { background: #4f46e5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚠️ Dev Server Startup Failed</h2>
    <p>The dev server encountered an error while starting project <b>${projectId}</b>.</p>
    <div class="err-box">${errorText}</div>
    <div class="logs">${logs || 'No additional logs.'}</div>
    <div class="actions">
      <button class="btn-retry" onclick="fetch('/api/preview/${projectId}/dev/restart', {method:'POST'}).then(() => location.reload())">🔄 Restart Dev Server</button>
    </div>
  </div>
</body>
</html>`;
}

// ── GET /api/preview/:projectId/status ───────────────────────────────────────
router.get('/:projectId/status', (req, res) => {
  const { projectId } = req.params;
  const server = devServerManager.getServerByProject(projectId);
  if (!server) {
    return res.json({ success: true, running: false, state: 'STOPPED', url: null });
  }
  res.json({
    success: true,
    running: server.state === 'READY',
    state: server.state,
    url: server.url,
    hostPort: server.hostPort,
    containerPort: server.containerPort,
    framework: server.framework,
    startedAt: server.startedAt,
    logs: server.logs.slice(-50),
    error: server.error
  });
});

// ── POST /api/preview/:projectId/dev/start ──────────────────────────────────
router.post('/:projectId/dev/start', async (req, res) => {
  const { projectId } = req.params;
  const { projectPath, customCommand } = req.body || {};
  try {
    const result = await devServerManager.startDevServer(projectId, projectPath || '.', { projectId, customCommand });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/preview/:projectId/dev/stop ───────────────────────────────────
router.post('/:projectId/dev/stop', async (req, res) => {
  const { projectId } = req.params;
  try {
    await devServerManager.stopDevServer(projectId);
    res.json({ success: true, state: 'STOPPED' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/preview/:projectId/dev/restart ────────────────────────────────
router.post('/:projectId/dev/restart', async (req, res) => {
  const { projectId } = req.params;
  try {
    const result = await devServerManager.restartDevServer(projectId, { projectId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/preview/:projectId/zip ─────────────────────────────────────────
router.get('/:projectId/zip', (req, res) => {
  const root = workspaceOf(req.params.projectId);
  if (!fs.existsSync(root)) return res.status(404).json({ error: 'Workspace not found' });

  const { ZipArchive } = require('archiver');
  const safeName = (req.params.projectId || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}-workspace.zip"`);

  const archive = new ZipArchive({ zlib: { level: 9 } });

  archive.on('error', (err) => {
    logger.error('[Preview] Zip archive error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });

  archive.pipe(res);

  // 1-click Windows start script
  archive.append(`@echo off
echo ========================================================
echo  🚀 Starting ${safeName} (Generated by AI-Dost)
echo ========================================================
echo.
if not exist node_modules (
  echo [1/2] Installing dependencies...
  call npm install
)
echo.
echo [2/2] Starting Development Server...
call npm run dev
pause
`, { name: 'start-windows.bat' });

  // 1-click Mac/Linux start script
  archive.append(`#!/bin/bash
echo "========================================================"
echo " 🚀 Starting ${safeName} (Generated by AI-Dost)"
echo "========================================================"
echo ""
if [ ! -d "node_modules" ]; then
  echo "[1/2] Installing dependencies..."
  npm install
fi
echo ""
echo "[2/2] Starting Development Server..."
npm run dev
`, { name: 'start-mac-linux.sh', mode: 0o755 });

  // Archive workspace files
  archive.glob('**/*', {
    cwd: root,
    ignore: ['node_modules/**', '.git/**', '.checkpoints/**', '.next/**', 'dist/**', 'build/**', '*.log']
  });

  archive.finalize();
});

// ── GET /api/preview/:projectId and /api/preview/:projectId/* ───────────────
router.all('/:projectId', (req, res) => {
  const { projectId } = req.params;
  const server = devServerManager.getServerByProject(projectId);

  // 1. Live Dev Server Handling
  if (server) {
    if (server.state === 'READY') {
      return proxyToDevServer(req, res, server, '');
    }
    if (server.state === 'STARTING' || server.state === 'CREATING' || server.state === 'RESTARTING') {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(renderStartingHtml(projectId, server));
    }
    if (server.state === 'FAILED') {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(renderFailedHtml(projectId, server));
    }
  }

  // 2. Static File Workspace Fallback
  const root = workspaceOf(projectId);
  const indexRel = findIndexHtml(root);
  if (indexRel) {
    return res.redirect(`/api/preview/${projectId}/${indexRel}`);
  }

  // 3. SQLite Fallback
  const dbFiles = getAllFilesFromDb(projectId);
  if (dbFiles.length > 0) {
    const htmlFile = dbFiles.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'));
    if (htmlFile) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(htmlFile.content || '');
    }
    return res.json({ path: '/', entries: dbFiles.map(f => f.path), source: 'sqlite' });
  }

  if (fs.existsSync(root)) {
    const entries = fs.readdirSync(root, { withFileTypes: true })
      .filter(e => e.name !== '.checkpoints' && e.name !== '.git' && e.name !== 'node_modules');
    return res.json({ path: '/', entries: entries.map(e => e.name) });
  }

  res.status(404).json({ error: 'Workspace or live dev server not found' });
});

router.all('/:projectId/*', (req, res) => {
  const { projectId } = req.params;
  const relPath = req.params[0] || '';

  // 0. Security Guard: Block path traversal unconditionally
  let decoded = relPath;
  try { decoded = decodeURIComponent(relPath); } catch (_) {}
  if (decoded.includes('../') || decoded.includes('..\\') || decoded.startsWith('../') || decoded.startsWith('..\\') || decoded === '..' || decoded.includes('/../') || decoded.includes('\\..\\')) {
    return res.status(400).json({ error: 'Invalid path (traversal blocked)' });
  }

  const server = devServerManager.getServerByProject(projectId);

  // 1. Live Dev Server Proxy
  if (server) {
    if (server.state === 'READY') {
      return proxyToDevServer(req, res, server, relPath);
    }
    if (server.state === 'STARTING' || server.state === 'CREATING' || server.state === 'RESTARTING') {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(renderStartingHtml(projectId, server));
    }
    if (server.state === 'FAILED') {
      return res.setHeader('Content-Type', 'text/html; charset=utf-8').send(renderFailedHtml(projectId, server));
    }
  }

  // 2. Static Workspace File
  const root = workspaceOf(projectId);
  const fp = safeJoin(root, relPath);
  if (!fp) return res.status(400).json({ error: 'Invalid path (traversal blocked)' });

  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
    const dbContent = getFileFromDb(projectId, relPath);
    if (dbContent !== null) {
      const ext = path.extname(relPath).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(dbContent);
    }
    return res.status(404).json({ error: `Not found: ${relPath}` });
  }

  const ext = path.extname(fp).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(fp);
});

module.exports = router;
