const { Database } = (() => {
  try { return require('better-sqlite3'); } catch(_) { return {}; }
})();
const DB_PATH = require('path').join(__dirname, '..', 'data', 'app.db');
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
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// Serve the agent's workspace folder over HTTP so the Copilot IDE can show a
// live preview (and the agent can screenshot the rendered app).
// Workspace layout: os.tmpdir()/agent-ws-<projectId>

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
  return path.join(os.tmpdir(), `agent-ws-${projectId || 'default'}`);
}

function safeJoin(root, rel) {
  const target = path.resolve(root, (rel || '').replace(/^\/+/, ''));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

// ── GET /api/preview/:projectId ──────────────────────────────────────────────
// BUG-010 FIX: Recursively search for first index.html in project tree
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

router.get('/:projectId', (req, res) => {
  const root = workspaceOf(req.params.projectId);
  // BUG-010: Search recursively for index.html
  const indexRel = findIndexHtml(root);
  if (indexRel) {
    return res.redirect(`/api/preview/${req.params.projectId}/${indexRel}`);
  }
  // BUG-003: Fallback to SQLite if temp dir is missing/empty
  const dbFiles = getAllFilesFromDb(req.params.projectId);
  if (dbFiles.length > 0) {
    const htmlFile = dbFiles.find(f => f.path === 'index.html' || f.path.endsWith('/index.html'));
    if (htmlFile) {
      const relPath = htmlFile.path.startsWith('/') ? htmlFile.path.slice(1) : htmlFile.path;
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
  res.status(404).json({ error: 'Workspace not found' });
});

// ── GET /api/preview/:projectId/zip ─────────────────────────────────────────
// High-speed streaming zip with 1-click local launch scripts (node_modules/.git excluded)
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

// ── GET /api/preview/:projectId/*  (file server) ────────────────────────────
router.get('/:projectId/*', (req, res) => {
  const root = workspaceOf(req.params.projectId);
  const rel = req.params[0];
  const fp = safeJoin(root, rel);
  if (!fp) return res.status(400).json({ error: 'Invalid path' });
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
    // BUG-003 FIX: Fall back to SQLite if file not on disk
    const dbContent = getFileFromDb(req.params.projectId, rel);
    if (dbContent !== null) {
      const ext = require('path').extname(rel).toLowerCase();
      res.setHeader('Content-Type', MIME[ext] || 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.send(dbContent);
    }
    return res.status(404).json({ error: `Not found: ${rel}` });
  }
  const ext = path.extname(fp).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(fp);
});

module.exports = router;