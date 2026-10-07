// Ensure runtime hardening, task cancellation, and route bridges are active even if run without node -r
// P3 #69: a failed preload must never be silent — dropped hardening/cancellation
// while the server still starts is exactly how the -r preloaders went missing.
// In production a missing hardener is fatal; in dev it stays loud but non-fatal.
function preloadOrFail(modulePath, label) {
  try {
    require(modulePath);
  } catch (e) {
    console.error(`[server] FATAL: ${label} failed to load:`, e && e.message ? e.message : e);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}
preloadOrFail('./security-hardening', 'security-hardening');
preloadOrFail('./taskCancellation', 'taskCancellation');
preloadOrFail('./chatAgentRouteBridge', 'chatAgentRouteBridge');

const express = require('express');
const projectAuth = require('./services/projectAuthorization');
const workspaceManager = require('./services/workspaceManager');
const ProjectDAO = require('./db/dao/ProjectDAO');
const ConversationDAO = require('./db/dao/ConversationDAO');
const MessageDAO = require('./db/dao/MessageDAO');

const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dns = require('dns');
const logger = require('./logger');
const { notifyWorkspaceChange } = require('./projectStore');
const { initDatabase } = require('./db');
const { Server } = require('socket.io');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Windows pe IPv6 route kabhi-kabhi blackhole hota hai → Node fetch hang.
// IPv4 pehle try karo (Pollinations/Gemini/Telegram sab IPv4 se reliable).
dns.setDefaultResultOrder('ipv4first');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const db = initDatabase();

// Enable WAL mode for better concurrent performance
db.exec('PRAGMA journal_mode = WAL');

// Define tables (idempotent — safe to run on every start)
function createTables() {
  // projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active'
    )
  `);

  // workspace_files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT,
      last_modified TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // chat_history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // resumes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT,
      json_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Ensure workflows & workflow_runs tables exist (Milestone 2 P8)
  try {
    const migration005 = require('./db/migrations/005_workflows_schema');
    migration005.up(db);
  } catch (err) {
    logger.warn('Workflow schema migration notice:', err.message);
  }
}

// Run on startup
createTables();

// Helper: get project by ID from SQLite (fallback to demo data if not found)
function getProjectById(id) {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (row) return row;
  // Demo fallback
  if (id === 'proj_demo_1') return {
    project_id: 'proj_demo_1',
    project_name: 'AI-Dost Interactive Web App',
    description: 'Glassmorphism Web IDE & Autonomous AI Copilot Workspace',
    created_at: new Date().toISOString(),
    status: 'Active'
  };
  if (id === 'proj_demo_2') return {
    project_id: 'proj_demo_2',
    project_name: 'Python Calculator Engine',
    description: 'Standalone Python & Glassmorphic Web Calculator App',
    created_at: new Date().toISOString(),
    status: 'Completed'
  };
  return null;
}

// Helper: seed initial projects from existing demo data (run once)
function seedInitialProjects() {
  const count = db.prepare('SELECT COUNT(*) AS cnt FROM projects').get().cnt;
  if (count === 0) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO projects (id, name, description, created_at, status) VALUES (?, ?, ?, ?, ?)').run(
      'proj_demo_1',
      'AI-Dost Interactive Web App',
      'Glassmorphism Web IDE & Autonomous AI Copilot Workspace',
      now,
      'Active'
    );
    db.prepare('INSERT INTO projects (id, name, description, created_at, status) VALUES (?, ?, ?, ?, ?)').run(
      'proj_demo_2',
      'Python Calculator Engine',
      'Standalone Python & Glassmorphic Web Calculator App',
      now,
      'Completed'
    );
    logger.info('[SQLite] seeded initial projects from demo data');
  }
}
seedInitialProjects();

const app = express();

// Trust only loopback proxy (Next.js rewrites) so req.ip / rate limiter see real client
app.set('trust proxy', 'loopback');

// P1 FIX (#11-#14): the Next rewrite proxy must forward the real client IP — it only
// does so after frontend/scripts/apply-next-xff-patch.js runs (postinstall). If the
// frontend's next package is installed but unpatched, proxied requests would look
// loopback (identity + rate-limit spoofing). Warn loudly instead of failing hard
// (separate deploys legitimately have no frontend/node_modules here).
(function warnIfNextXffPatchMissing() {
  try {
    const fs = require('fs');
    const path = require('path');
    const proxyReq = path.join(
      __dirname, '..', 'frontend', 'node_modules', 'next',
      'dist', 'server', 'lib', 'router-utils', 'proxy-request.js'
    );
    if (!fs.existsSync(proxyReq)) return; // frontend not installed in this checkout
    const src = fs.readFileSync(proxyReq, 'utf8');
    if (!src.includes('AI-DOST:XFF-FORWARD')) {
      logger.warn(
        '[Security] frontend/node_modules/next proxy-request.js is NOT patched — ' +
        'run `node scripts/apply-next-xff-patch.js` in frontend/ (or reinstall). ' +
        'Until then, requests proxied via :3000 appear as loopback to this server.'
      );
    }
  } catch (_) { /* never block startup on a diagnostic */ }
})();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1000 : 50000, // Generous limit for local development & previews
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip preview routes, dev server polling, health checks, and exact-loopback requests
    const p = req.path || '';
    if (p.startsWith('/api/preview') || p.startsWith('/api/v1/preview') || p === '/health') return true;
    // P1 FIX (#11): loopback skip only for genuinely local clients in dev.
    // req.ip is trustworthy: direct clients' X-Forwarded-For is ignored by Express
    // (untrusted socket), and the Next rewrite proxy overwrites x-forwarded-for
    // with the real TCP peer (frontend/scripts/apply-next-xff-patch.js).
    // Production counts loopback as well.
    if (process.env.NODE_ENV !== 'production') {
      const ip = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/i, '');
      if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) return true;
    }
    return false;
  }
});

// Apply middlewares
app.use(compression());
app.use(apiLimiter);

// Security response headers (safe for API + HTML)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
});

// P1 FIX (#12): stable anonymous identity for non-local callers.
// Must run before any route so req.adUid is known on the FIRST request
// (cookie is minted server-side and returned via Set-Cookie on the response).
const anonIdentity = require('./middleware/anonIdentity');
app.use(anonIdentity);

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST CONCURRENCY QUEUE — Prevents event loop saturation under high load
// Without Redis/BullMQ, this lightweight semaphore queues concurrent AI calls.
// MAX_CONCURRENT_AI (default 20): simultaneous AI requests processed at once.
// Requests beyond limit are queued in-memory with FIFO ordering.
// ═══════════════════════════════════════════════════════════════════════════
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_AI || '20', 10);
let activeRequests = 0;
const waitQueue = [];

function acquireSlot() {
  return new Promise((resolve) => {
    if (activeRequests < MAX_CONCURRENT) {
      activeRequests++;
      resolve();
    } else {
      waitQueue.push(resolve);
    }
  });
}

function releaseSlot() {
  if (waitQueue.length > 0) {
    const next = waitQueue.shift();
    next(); // Give slot to next waiter
  } else {
    activeRequests--;
  }
}

// Apply queue only to AI-heavy endpoints (not health checks / static)
app.use(['/api/chat', '/api/v1/chat', '/api/agent/run'], async (req, res, next) => {
  const queuePos = waitQueue.length;
  if (queuePos > 0) {
    res.setHeader('X-Queue-Position', queuePos);
    logger.info(`⏳ Request queued (position ${queuePos}, active: ${activeRequests})`);
  }
  await acquireSlot();
  // P3 #40: Node fires BOTH 'finish' and 'close' on a normal end — release the
  // slot exactly once per request or activeRequests double-decrements (and can
  // drift negative under load).
  let slotReleased = false;
  const releaseOnce = () => {
    if (slotReleased) return;
    slotReleased = true;
    releaseSlot();
  };
  res.on('finish', releaseOnce);
  res.on('close', releaseOnce);
  next();
});



// Helper: Normalize file path to prevent duplicate files and cross-platform issues
function normalizeBackendPath(p) {
  return String(p || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim();
}

// Helper: save a project file to SQLite (and physical workspace)
function saveProjectFile(projectId, filePath, content) {
  try {
    const cleanPath = normalizeBackendPath(filePath);
    if (!cleanPath) return false;

    const fullPath = workspaceManager.resolvePath(projectId, cleanPath);
    fs.mkdirSync(require('path').dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');

    const existing = db.prepare('SELECT id FROM workspace_files WHERE project_id = ? AND (path = ? OR path = ? OR path = ? COLLATE NOCASE)').get(
      projectId,
      cleanPath,
      cleanPath.replace(/\//g, '\\'),
      `./${cleanPath}`
    );
    if (existing) {
      db.prepare('UPDATE workspace_files SET path = ?, content = ?, last_modified = datetime(\'now\') WHERE id = ?')
        .run(cleanPath, content, existing.id);
    } else {
      db.prepare('INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)')
        .run(projectId, cleanPath, content);
    }
    notifyWorkspaceChange(projectId, cleanPath, 'write');
    return true;
  } catch (e) {
    logger.error('[Server] saveProjectFile failed:', e.message || e);
    return false;
  }
}

// Helper: create a folder in the agent workspace + persist a .gitkeep marker so the UI tree sees it
function createProjectFolder(projectId, folderPath) {
  const safe = normalizeBackendPath(folderPath);
  if (!safe || safe.includes('..')) return false;
  try {
    const dir = workspaceManager.resolvePath(projectId, safe);
    fs.mkdirSync(dir, { recursive: true });
    saveProjectFile(projectId, `${safe}/.gitkeep`, '');
    return true;
  } catch (e) {
    logger.error('[Server] mkdir failed:', e.message || e);
    return false;
  }
}

// Helper: get all files for a project
function getProjectFiles(projectId) {
  try {
    const wsRoot = workspaceManager.getWorkspacePath(projectId);
    if (!fs.existsSync(wsRoot)) {
      const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
      return rows.reduce((acc, { path, content }) => {
        acc[path] = content || '';
        return acc;
      }, {});
    }
    const result = {};

    // P2 #49: bounded read — this runs on project list/refresh, so an
    // unbounded walk (count x size) could OOM or stall the event loop.
    const MAX_FILES = Number(process.env.PROJECT_FILES_MAX || 2000);
    const MAX_FILE_BYTES = Number(process.env.PROJECT_FILE_MAX_BYTES || 2 * 1024 * 1024);
    const MAX_TOTAL_BYTES = Number(process.env.PROJECT_FILES_MAX_TOTAL || 30 * 1024 * 1024);
    let fileCount = 0;
    let totalBytes = 0;
    let truncated = false;

    function walk(dir, base) {
      if (truncated) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (truncated) return;
        if (
          entry.name === 'node_modules' || 
          entry.name === '.git' || 
          entry.name === '.checkpoints' || 
          entry.name === 'Users' || 
          entry.name === 'package-lock.json' ||
          entry.name.startsWith('.') ||
          entry.name.endsWith('.map')
        ) continue;
        const full = require('path').join(dir, entry.name);
        const rel = (base ? `${base}/${entry.name}` : entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
          walk(full, rel);
        } else {
          if (fileCount >= MAX_FILES) { truncated = true; break; }
          let size = 0;
          try { size = fs.statSync(full).size; } catch (_) { continue; }
          // Oversize files are skipped entirely (a placeholder would be
          // written back verbatim if the editor saved it over the real file)
          if (size > MAX_FILE_BYTES || totalBytes + size > MAX_TOTAL_BYTES) continue;
          try {
            result[rel] = fs.readFileSync(full, 'utf8');
            fileCount++;
            totalBytes += size;
          } catch (_) { /* raced/deleted */ }
        }
      }
    }
    walk(wsRoot, '');

    // Eliminate duplicate nested project directories created by scaffolding
    const allKeys = Object.keys(result);
    const topDirs = Array.from(new Set(allKeys.filter(k => k.includes('/')).map(k => k.split('/')[0])));
    const duplicateKeys = new Set();
    for (const d of topDirs) {
      if (
        (result[`${d}/package.json`] && result['package.json']) ||
        (result[`${d}/src/App.jsx`] && result['src/App.jsx']) ||
        (result[`${d}/index.html`] && result['index.html'])
      ) {
        allKeys.filter(k => k.startsWith(`${d}/`)).forEach(k => duplicateKeys.add(k));
      }
    }
    duplicateKeys.forEach(k => delete result[k]);

    return result;
  } catch (e) {
    logger.warn(`[Server] getProjectFiles physical read failed for ${projectId}, falling back to legacy DB.`, e);
    const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
    return rows.reduce((acc, { path, content }) => {
      acc[path] = content || '';
      return acc;
    }, {});
  }
}

// Close DB on process exit
process.on('beforeExit', () => {
  try { db.close(); } catch(e){}
});

// HTTP request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const origEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - start;
        if (!res.headersSent) {
            res.setHeader('X-Response-Time-Ms', duration);
        }
        logger.http(req.method, req.url, res.statusCode, duration);
        return origEnd.apply(this, args);
    };
    next();
});

// Cross-Origin Isolation headers for WebContainer in-browser runtime
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

app.use(cors());
// No explicit limit: security-hardening dual-parser applies 2mb default /
// 50mb for image+pdf routes. (Fixed 50mb on all routes was a DoS vector.)
app.use(express.json());

// Generated images (Gemini fallback saves yahan)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve generated documents from the shared downloads dir (P2 #178 — the
// hard-coded frontend path 404'd inside the backend image where it doesn't exist)
app.use('/downloads', express.static(require('./services/downloadsDir').resolveDownloadsDir()));

// Live preview asset fallback handler: Resolves /src/* requests from preview apps with 0 404s
app.use('/src', (req, res) => {
  const rel = decodeURIComponent(req.path || '');
  // Reject path traversal + null bytes before any fs access
  if (!rel || rel.includes('\0') || rel.split(/[\\/]/).some(seg => seg === '..')) {
    return res.status(400).send('Invalid path');
  }
  const tmpDir = os.tmpdir();
  // P3 #41: scope the lookup to the requesting project's workspace. The old
  // code served the first match across ALL agent-ws-* dirs (sorted by mtime),
  // so project A's /src/foo.js could return project B's file.
  const scopeDir = resolveSrcWorkspaceScope(req, tmpDir);
  if (scopeDir === null) {
    return res.status(404).send('No workspace scope for /src request (pass ?projectId= or send a preview Referer)');
  }
  let candidate = null;
  try {
    const entries = scopeDir
      ? [path.basename(scopeDir)]
      : fs.readdirSync(tmpDir).filter(n => n.startsWith('agent-ws-'));
    for (const e of entries) {
      const target = path.join(tmpDir, e, 'src', rel.replace(/^\/+/, ''));
      if (fs.existsSync(target) && fs.statSync(target).isFile()) {
        candidate = target;
        break;
      }
    }
  } catch (err) {
    logger.warn('[Server] /src workspace scan failed:', err.message);
  }

  if (candidate) {
    const ext = path.extname(candidate).toLowerCase();
    const mime = (ext === '.jsx' || ext === '.js' || ext === '.ts' || ext === '.tsx' || ext === '.mjs')
      ? 'text/javascript; charset=utf-8'
      : (ext === '.css' ? 'text/css; charset=utf-8' : 'text/plain');
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(candidate);
  }
  res.status(404).send('Resource not found in active workspaces');
});

/**
 * P3 #41 — decide which agent-ws-* workspace a /src/* asset belongs to.
 * Returns:
 *   - absolute dir path when the request can be tied to one project
 *     (?projectId= / x-ai-dost-project header / preview Referer)
 *   - null when NO scope hint exists AND more than one workspace exists
 *     (ambiguous → caller must 404 instead of guessing by mtime)
 *   - undefined when there is exactly one workspace (unambiguous fallback)
 */
function resolveSrcWorkspaceScope(req, tmpDir) {
  let pid = (req.query && req.query.projectId) || (req.get && req.get('x-ai-dost-project')) || '';
  if (!pid) {
    const ref = (req.get && req.get('referer')) || '';
    if (ref) {
      try {
        const m = new URL(ref).pathname.match(/\/api\/(?:v1\/)?preview\/([^/?#]+)/);
        if (m) pid = decodeURIComponent(m[1]);
      } catch (_) { /* malformed referer */ }
    }
  }
  if (pid) {
    const safe = String(pid).replace(/[^A-Za-z0-9._-]/g, '').replace(/^[.-]+/, '');
    if (safe) {
      const scoped = path.join(tmpDir, `agent-ws-${safe}`);
      if (fs.existsSync(scoped)) return scoped;
    }
    return null; // scope requested but unknown workspace → 404
  }
  const all = fs.readdirSync(tmpDir).filter(n => n.startsWith('agent-ws-'));
  return all.length === 1 ? path.join(tmpDir, all[0]) : (all.length === 0 ? undefined : null);
}

// Routes
const chatRoutes    = require('./routes/chat');
const testRoutes    = require('./routes/test');
const imageRoutes   = require('./routes/image');
const pdfRoutes     = require('./routes/pdf');
const learningRoutes = require('./routes/learning');
const copilotMemoryRoutes = require('./routes/copilotMemory');
const gitRoutes     = require('./routes/git');
const agentRoutes   = require('./routes/agent');
const figmaRoutes   = require('./routes/figma');
const previewRoutes = require('./routes/preview');
const terminalRoutes = require('./routes/terminal');
const sandboxRoutes = require('./sandbox/routes');
const deployRoutes  = require('./routes/deploy');
const settingsRoutes = require('./routes/settings');
const researchRoutes = require('./routes/research');
const skillsRoutes = require('./routes/skills');
const analyticsRoutes = require('./routes/analytics');
const databaseRoutes  = require('./routes/database');
const assessmentRoutes = require('./routes/assessment');
const bharatRoutes     = require('./routes/bharat');
const writingRoutes    = require('./routes/writing');
const planningRoutes   = require('./routes/planning');
const travelRoutes     = require('./routes/travel');
const languageRoutes   = require('./routes/language');
const decisionRoutes   = require('./routes/decision');
const securityRoutes   = require('./routes/security');
const catalogRoutes    = require('./routes/catalog');
const openrouterRoutes = require('./routes/openrouter');
const rateLimiter = require('./middleware/rateLimiter');
const { apiGuard, execGuard, isLoopback, clientIp } = require('./middleware/localApiGuard');

// ── Tier A guard: block cross-site browser requests + public remote IPs ──
app.use('/api', apiGuard);
app.use('/api/v1', apiGuard);

// ── Tier B guard: code-exec / dangerous FS endpoints (loopback or Docker only) ──
app.use('/api/test', execGuard);
app.use('/api/interpreter', execGuard);
app.use('/api/terminal', execGuard);
app.use('/api/sandbox', execGuard);
app.use('/api/git', execGuard);
app.use('/api/deploy', execGuard);
app.use('/api/database', execGuard);
app.use('/api/agent', execGuard);
app.use('/api/chat/execute', execGuard);
app.use('/api/v1/ai', execGuard);
app.use('/api/settings', execGuard);
app.use('/api/v1/settings', execGuard);

app.use('/api/chat',     rateLimiter({ maxRequests: 50, windowSeconds: 60 }), chatRoutes);
app.use('/api/v1/chat',  rateLimiter({ maxRequests: 50, windowSeconds: 60 }), chatRoutes);
app.use('/api/catalog',  catalogRoutes);
app.use('/api/bharat',   bharatRoutes);
app.use('/api/test',     testRoutes);
app.use('/api/image',    imageRoutes);
app.use('/api/pdf',      pdfRoutes);
app.use('/api/learning', learningRoutes);
app.use(['/api/copilot/memory', '/api/v1/copilot/memory'], copilotMemoryRoutes);
app.use('/api/git',      gitRoutes);
app.use('/api/agent',    agentRoutes);
app.use('/api/figma',    figmaRoutes);
app.use('/api/preview',  previewRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/sandbox',  sandboxRoutes);
app.use('/api/deploy',   deployRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/skills',   skillsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/writing',   writingRoutes);
app.use('/api/planning',  planningRoutes);
app.use('/api/travel',    travelRoutes);
app.use('/api/language',  languageRoutes);
app.use('/api/decision',  decisionRoutes);
app.use('/api/security',  securityRoutes);
app.use('/api/openrouter', openrouterRoutes);

const projectGraphRoutes = require('./routes/projectGraph');
const workflowRoutes = require('./routes/workflows')(db);
const verifierRoutes = require('./routes/verifier');
app.use('/api/projects', projectGraphRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/verify', verifierRoutes);

// ── Automation & Watcher Engine (Milestone 2 P8) ────────────────────
const { getWorkflowEngine } = require('./services/workflowEngine');
const workflowEngine = getWorkflowEngine(db);
workflowEngine.start();

// Troubleshooting aliases (documented in AGENTS.md) — same data as /api/agent/quota-status
app.get('/api/quota-status', (_req, res) => res.redirect('/api/agent/quota-status'));
app.get('/api/circuit-breaker', (_req, res) => res.redirect('/api/agent/quota-status'));

// v1 aliases so the frontend API client (baseURL /api/v1) resolves correctly

app.use('/api/v1/test',     testRoutes);
app.use('/api/v1/image',    imageRoutes);
app.use('/api/v1/pdf',      pdfRoutes);
app.use('/api/v1/learning', learningRoutes);
app.use('/api/v1/git',      gitRoutes);
app.use('/api/v1/agent',    agentRoutes);
app.use('/api/v1/terminal', terminalRoutes);
app.use('/api/v1/sandbox',  sandboxRoutes);
app.use('/api/v1/deploy',   deployRoutes);
app.use('/api/v1/research', researchRoutes);
app.use('/api/v1/skills',   skillsRoutes);
app.use('/api/v1/projects', projectGraphRoutes);
app.use('/api/v1/preview',  previewRoutes);
app.use('/api/v1/figma',    figmaRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/workflows', workflowRoutes);
app.use('/api/v1/verify',   verifierRoutes);
app.use('/api/v1/database', databaseRoutes);
app.use('/api/v1/bharat',   bharatRoutes);
app.use('/api/v1/writing',  writingRoutes);
app.use('/api/v1/planning', planningRoutes);
app.use('/api/v1/travel',   travelRoutes);
app.use('/api/v1/language', languageRoutes);
app.use('/api/v1/decision', decisionRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/catalog',  catalogRoutes);
app.use('/api/v1/openrouter', openrouterRoutes);

// ── AI Assistant Endpoints (mounted at /api/v1/ai) ──────────────────────────
// This allows frontend calls to /ai/code-suggestions and /ai/lsp-diagnostics
// to resolve to /api/v1/ai/code-suggestions via the agent router.
app.use('/api/v1/ai',    agentRoutes);

// ── New API Routes ──────────────────────────────────────────────────────────

// Gemini Live API ephemeral token (client-side auth for WebSocket)
// Gated: loopback/Docker only (Tier B) — raw API key must never leave the machine.
// Returns both `key` (actual Gemini key the SDK expects as apiKey) and legacy `token`.
function geminiLiveTokenHandler(req, res) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Gemini API key not configured' });
  const token = Buffer.from(JSON.stringify({ key, exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64');
  res.json({ key, token, expiresIn: 1800 });
}

app.get('/api/gemini-live-token', execGuard, geminiLiveTokenHandler);
app.get('/api/v1/gemini-live-token', execGuard, geminiLiveTokenHandler);

// Voice session management
const voiceSessions = new Map();
// Periodic cleanup: drop sessions inactive for >1 hour (prevents unbounded Map growth)
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, s] of voiceSessions) {
    const last = new Date(s.started).getTime();
    if (!s.active || last < cutoff) voiceSessions.delete(id);
  }
}, 10 * 60 * 1000).unref();

app.post('/api/voice/start', (req, res) => {
  const sessionId = `voice-${Date.now()}`;
  voiceSessions.set(sessionId, { started: new Date(), active: true });
  res.json({ sessionId, status: 'started', message: 'Voice session started' });
});

app.post('/api/v1/voice/start', (req, res) => {
  const sessionId = `voice-${Date.now()}`;
  voiceSessions.set(sessionId, { started: new Date(), active: true });
  res.json({ sessionId, status: 'started', message: 'Voice session started' });
});

app.post('/api/voice/stop', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && voiceSessions.has(sessionId)) {
    voiceSessions.get(sessionId).active = false;
    res.json({ sessionId, status: 'stopped' });
  } else {
    res.status(404).json({ error: 'Voice session not found' });
  }
});

app.post('/api/v1/voice/stop', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && voiceSessions.has(sessionId)) {
    voiceSessions.get(sessionId).active = false;
    res.json({ sessionId, status: 'stopped' });
  } else {
    res.status(404).json({ error: 'Voice session not found' });
  }
});

// Resume builder: generate detailed structured resume from chat prompt
const resumeSystemPrompt = `You are a professional resume writer. Create a COMPLETE, DETAILED resume JSON from the user's prompt.

Return ONLY valid JSON (no markdown, no code fences, no prose) with EXACTLY this schema:
{
  "fullName": "string",
  "contact": { "email": "string", "phone": "string" },
  "summary": "string - 3-4 detailed sentences: who they are, top skills, key achievements, career goal",
  "experience": [ { "company": "string", "role": "string", "duration": "string", "bullets": ["3-5 detailed strings"] } ],
  "education": [ { "institution": "string", "degree": "string", "year": "string" } ],
  "skills": ["8-15 strings grouped by category"],
  "projects": [ { "name": "string", "description": "string - 1-2 sentences with tech used and result" } ],
  "certifications": ["string"]
}

STRICT RULES:
- NEVER return empty arrays or null.
- INFER THE INDUSTRY/ROLE: Read the user's prompt carefully. If they mention "Skill India", infer a training, education, management, or administrative role. If they mention a specific job, tailor everything to that job.
- If the user provides very little detail, GENERATE realistic placeholder content tailored to the inferred industry — the user will edit it later.
- Experience: 1-3 jobs, each with 3-5 bullets using action verbs + measurable results.
- Summary: minimum 3 sentences, never 1 line.
- Extract everything available from the user's prompt (real name, company, college, years, skills, phone, email) and USE it.
- Keep section labels English; content can be Hindi/Hinglish if the user wrote in Hindi.
- Double-check the JSON is valid and complete before responding.`;

const parseResumeJson = (content) => {
    const cleaned = String(content)
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found');
    return JSON.parse(cleaned.slice(start, end + 1));
};

// Safety net — agar LLM ne khali arrays diye to realistic placeholders bhar do
const enrichResume = (data, prompt) => {
    const role = (data.experience && data.experience[0] && data.experience[0].role) ||
        (prompt.match(/([A-Za-z ]+(developer|engineer|designer|analyst|manager|student|executive|coordinator|trainer))/i) || [null, 'Professional'])[1];
    if (!data.summary || data.summary.length < 30) {
        data.summary = `Passionate ${role} with hands-on experience delivering results. Skilled in industry best practices, focused on maintaining high standards and solving problems end-to-end. Always learning, always improving.`;
    }
    if (!Array.isArray(data.experience) || data.experience.length === 0) {
        data.experience = [{
            company: 'Target Organization',
            role,
            duration: '2023 - Present',
            bullets: [
                'Successfully managed daily operations and delivered key initiatives',
                'Collaborated with cross-functional teams to improve overall efficiency by 20%',
                'Resolved complex issues and maintained high satisfaction rates',
            ],
        }];
    }
    data.experience = data.experience.map((e) => ({
        company: e.company || 'Company',
        role: e.role || role,
        duration: e.duration || '2022 - Present',
        bullets: Array.isArray(e.bullets) && e.bullets.length >= 2
            ? e.bullets
            : [
                'Successfully managed daily operations and delivered key initiatives',
                'Collaborated with cross-functional teams to improve overall efficiency by 20%',
                'Resolved complex issues and maintained high satisfaction rates',
            ],
    }));
    if (!Array.isArray(data.education) || data.education.length === 0) {
        data.education = [{ institution: 'Your College / University', degree: 'Bachelor\'s Degree', year: '2021 - 2025' }];
    }
    if (!Array.isArray(data.skills) || data.skills.length === 0) {
        data.skills = ['Communication', 'Problem Solving', 'Project Management', 'Team Leadership', 'Adaptability'];
    }
    if (!Array.isArray(data.projects)) data.projects = [];
    if (!Array.isArray(data.certifications)) data.certifications = [];
    return data;
};

const resumeGenerateHandler = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    // Pura cascade use karo (Groq → Cerebras → Gemini → NVIDIA → ...) — sirf Groq nahi
    const chatRes = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${resumeSystemPrompt}\n\nUSER PROMPT: ${prompt}`,
        model: 'auto',
        mode: 'chat',
        section: 'resume',
      }),
      signal: AbortSignal.timeout(120000),
    });
    const chatData = await chatRes.json();
    const content = chatData.reply || chatData.message || '';

    if (!content || content.length < 30) {
      throw new Error('LLM returned empty response for resume');
    }

    let jsonData;
    try {
      jsonData = parseResumeJson(content);
    } catch (parseErr) {
      logger.warn('[Resume] JSON parse failed, attempting recovery:', parseErr.message);
      const nameMatch = prompt.match(/[a-zA-Z]+ [a-zA-Z]+/);
      jsonData = {
        fullName: nameMatch ? nameMatch[0] : 'Your Name',
        contact: null,
        summary: content.substring(0, 300),
        experience: [],
        education: [],
        skills: [],
      };
    }

    jsonData = enrichResume(jsonData, prompt);

    // Save to SQLite
    const stmt = db.prepare('INSERT INTO resumes (prompt, json_data) VALUES (?, ?)');
    stmt.run(prompt, JSON.stringify(jsonData));

    res.json(jsonData);
  } catch (e) {
    logger.error('Resume generation error:', e.message);
    const fallback = enrichResume({
      fullName: 'Your Name',
      contact: null,
      summary: '',
      experience: [],
      education: [],
      skills: [],
    }, prompt);
    const stmt = db.prepare('INSERT INTO resumes (prompt, json_data) VALUES (?, ?)');
    stmt.run(prompt, JSON.stringify(fallback));
    res.status(500).json({ error: 'Resume generation failed', detail: e.message });
  }
};
app.post('/api/v1/resume/generate', resumeGenerateHandler);

// ==========================================
// Phase 1.1: Edit Generated Sections (AI Rewrite)
// ==========================================
const regenerateSectionHandler = async (req, res) => {
    const { section, sectionName, currentData, userPrompt, fullResumeContext } = req.body;
    const targetSection = section || sectionName;
    if (!targetSection || !currentData) return res.status(400).json({ error: 'section and currentData are required' });

    try {
        const systemInstruction = `You are an expert resume writer. The user wants to improve a specific section of their resume: "${targetSection}".

CURRENT CONTENT: ${JSON.stringify(currentData)}
FULL RESUME CONTEXT: ${JSON.stringify(fullResumeContext)}
USER REQUEST (if any): ${userPrompt || "Make it sound more professional, impactful, and results-oriented."}

Return ONLY the rewritten JSON object/array for this specific section, matching its schema perfectly. No markdown fences.`;

        const chatRes = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: systemInstruction,
                model: 'auto',
                mode: 'chat',
                section: 'resume',
            }),
            signal: AbortSignal.timeout(60000)
        });
        const chatData = await chatRes.json();
        const content = chatData.reply || chatData.message || '';

        let newSectionData;
        try {
            newSectionData = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
        } catch(e) {
            return res.status(500).json({ error: 'AI returned invalid JSON for section rewrite.' });
        }

        res.json({ newSectionData });
    } catch(e) {
        logger.error('Section rewrite error:', e);
        res.status(500).json({ error: 'Failed to rewrite section.' });
    }
};
app.post('/api/v1/resume/regenerate-section', regenerateSectionHandler);

// ==========================================
// Phase 1.2: ATS Analyzer & Job Description Matcher
// ==========================================
const atsAnalyzeHandler = async (req, res) => {
    const { resumeData, jobDescription } = req.body;
    if (!resumeData || !jobDescription) return res.status(400).json({ error: 'resumeData and jobDescription are required' });

    try {
        const prompt = `You are an expert ATS (Applicant Tracking System). Analyze this resume against this Job Description.

RESUME: ${JSON.stringify(resumeData)}
JOB DESCRIPTION: ${jobDescription}

Calculate an ATS match score (0-100) and extract keywords.
Return ONLY valid JSON matching this schema exactly (no markdown fences):
{
  "score": number,
  "matchingKeywords": ["string"],
  "missingKeywords": ["string"],
  "feedback": "1-2 sentences of specific actionable advice to improve the score"
}`;

        const chatRes = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: prompt,
                model: 'auto',
                mode: 'chat',
                section: 'resume',
            }),
            signal: AbortSignal.timeout(60000)
        });
        const chatData = await chatRes.json();
        const content = chatData.reply || chatData.message || '';

        let analysis;
        try {
            analysis = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
        } catch(e) {
            return res.status(500).json({ error: 'AI returned invalid JSON for ATS analysis.' });
        }

        res.json(analysis);
    } catch(e) {
        logger.error('ATS Analysis error:', e);
        res.status(500).json({ error: 'Failed to analyze ATS score.' });
    }
};
app.post('/api/v1/resume/ats-analyze', atsAnalyzeHandler);

// ==========================================
// Phase 1.3: Auto-Tailor Resume to JD
// ==========================================
const autoTailorHandler = async (req, res) => {
    const { resumeData, jobDescription, missingKeywords } = req.body;
    if (!resumeData || !jobDescription) return res.status(400).json({ error: 'resumeData and jobDescription are required' });

    try {
        const systemInstruction = `You are an expert ATS resume writer. The user wants to tailor their resume to fit a specific Job Description.

CURRENT RESUME: ${JSON.stringify(resumeData)}
JOB DESCRIPTION: ${jobDescription}
MISSING KEYWORDS TO INTEGRATE: ${missingKeywords ? JSON.stringify(missingKeywords) : 'None provided'}

Your task: Rewrite the "summary" and "experience" sections to naturally integrate the missing keywords and align with the JD's requirements. Do NOT lie or invent completely fake jobs, but rephrase their existing experience to sound like a perfect fit.

Return ONLY the updated full resume JSON object matching the exact schema. No markdown fences.`;

        const chatRes = await fetch(`http://127.0.0.1:${process.env.PORT || 5000}/api/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: systemInstruction,
                model: 'auto',
                mode: 'chat',
                section: 'resume',
            }),
            signal: AbortSignal.timeout(90000)
        });
        const chatData = await chatRes.json();
        const content = chatData.reply || chatData.message || '';

        let tailoredResume;
        try {
            tailoredResume = JSON.parse(content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
        } catch(e) {
            return res.status(500).json({ error: 'AI returned invalid JSON for tailored resume.' });
        }

        res.json({ tailoredResume });
    } catch(e) {
        logger.error('Auto Tailor error:', e);
        res.status(500).json({ error: 'Failed to auto-tailor resume.' });
    }
};
app.post('/api/v1/resume/auto-tailor', autoTailorHandler);

// ── Document engine (docx / pptx / csv) ────────────────────────────────────
const documentRoutes = require('./routes/documents');
const evalRoutes     = require('./routes/eval');
const rlhfRoutes     = require('./routes/rlhf');
const crewRoutes         = require('./routes/crew');
const interpreterRoutes  = require('./routes/interpreter');
app.use('/api/document', documentRoutes);
app.use('/api/eval', evalRoutes);
app.use('/api/v1/document', documentRoutes);
app.use('/api/rlhf', rlhfRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/interpreter', interpreterRoutes);

// ── Dedicated Copilot IDE Session History (SQLite-backed) ──────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS copilot_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      prompt_summary TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      session_data TEXT
    )
  `);
} catch (e) {
  logger.warn('[Server] copilot_sessions table init note:', e.message || e);
}

app.get(['/api/copilot/sessions', '/api/v1/copilot/sessions'], (req, res) => {
  try {
    const rows = db.prepare('SELECT id, title, prompt_summary, created_at, updated_at, session_data FROM copilot_sessions ORDER BY updated_at DESC').all();
    const sessions = rows.map(r => {
      try {
        const parsed = JSON.parse(r.session_data || '{}');
        return {
          ...parsed,
          id: r.id,
          title: r.title,
          promptSummary: r.prompt_summary,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      } catch (_) {
        return { id: r.id, title: r.title, createdAt: r.created_at, updatedAt: r.updated_at };
      }
    });
    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/copilot/sessions', '/api/v1/copilot/sessions'], (req, res) => {
  try {
    const session = req.body || {};
    const id = session.id || `copilot-session-${Date.now()}`;
    const title = session.title || 'Untitled Workspace';
    const promptSummary = session.promptSummary || '';
    const createdAt = session.createdAt || Date.now();
    const updatedAt = session.updatedAt || Date.now();
    const sessionData = JSON.stringify(session);

    db.prepare(`
      INSERT INTO copilot_sessions (id, title, prompt_summary, created_at, updated_at, session_data)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        prompt_summary = excluded.prompt_summary,
        updated_at = excluded.updated_at,
        session_data = excluded.session_data
    `).run(id, title, promptSummary, createdAt, updatedAt, sessionData);

    res.json({ success: true, session: { ...session, id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete(['/api/copilot/sessions/:id', '/api/v1/copilot/sessions/:id'], (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM copilot_sessions WHERE id = ?').run(id);
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? OR project_id = ?').run(id, `workspace_${id}`);
    workspaceManager.deleteWorkspace(id);
    workspaceManager.deleteWorkspace(`workspace_${id}`);
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Project Memory endpoints (SQLite-backed) ──────────────────────────
app.get(['/api/v1/memory/projects', '/api/memory/projects', '/api/projects'], (req, res) => {
    const userId = projectAuth.resolveUser(req);
    const projectDao = new ProjectDAO(db);
    const rows = projectDao.list(userId === 'local-user' ? null : userId);
    res.json(rows.map(r => ({
        project_id: r.id,
        project_name: r.name,
        description: r.description || '',
        created_at: r.created_at,
        status: r.status || 'Active'
    })));
});

app.post(['/api/v1/memory/project', '/api/memory/project', '/api/project'], (req, res) => {
    const userId = projectAuth.resolveUser(req);
    const { project_name, description } = req.body || {};
    const id = (req.body && req.body.project_id) || 'proj_' + Date.now();

    const projectDao = new ProjectDAO(db);
    const existing = projectDao.getById(id);
    if (existing) {
        if (!projectAuth.verifyOwnership(existing, userId)) {
            return res.status(403).json({ success: false, error: `Access denied: You do not have permission to access project '${id}'` });
        }
        return res.json({
            project_id: existing.id,
            project_name: existing.name,
            description: existing.description || '',
            created_at: existing.created_at,
            status: existing.status || 'Active'
        });
    }

    const { project } = workspaceManager.ensureWorkspaceSync(id, userId, {
        description: description || 'Interactive AI Copilot Workspace'
    });
    if (project_name) {
        projectDao.update(id, { name: project_name, description: description || 'Interactive AI Copilot Workspace' }, userId);
    }

    const updated = projectDao.getById(id);
    res.json({
        project_id: updated.id,
        project_name: updated.name,
        description: updated.description || '',
        created_at: updated.created_at,
        status: updated.status || 'Active'
    });
});

app.delete(['/api/v1/memory/project/:id', '/api/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    if (id.startsWith('proj_demo_')) return res.status(400).json({ error: 'Demo projects cannot be deleted' });

    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const projectDao = new ProjectDAO(db);
    projectDao.delete(id, auth.user.id);
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? OR project_id = ?').run(id, `workspace_${id}`);
    db.prepare('DELETE FROM copilot_sessions WHERE id = ?').run(id);
    workspaceManager.deleteWorkspace(id, auth.user.id);
    workspaceManager.deleteWorkspace(`workspace_${id}`, auth.user.id);
    res.json({ success: true, message: 'Project deleted' });
});

app.get(['/api/v1/memory/project/:id', '/api/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req, { autoCreateIfMissing: true, autoCreateSessionProject: true });
    if (!auth.authorized) {
        // A workspace load for a project that doesn't exist yet is NOT an error —
        // the editor wants an empty file list. autoCreateIfMissing only covers
        // 'default'/'copilot-workspace' (anti-DoS: no row per arbitrary id), so
        // session ids like 'copilot-session-<ts>' used to 404 here and spam the
        // browser console on every CopilotIDE mount. Return 200 + empty files.
        if (auth.status === 404 && auth.project === undefined) {
            return res.json({
                project_id: id,
                project_name: id,
                description: '',
                status: 'Active',
                created_at: null,
                files: []
            });
        }
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const row = auth.project;
    const files = getProjectFiles(id);
    const fileArr = Object.keys(files).map(p => ({ path: p, content: files[p] }));
    res.json({
        project_id: row.id,
        project_name: row.name,
        description: row.description || '',
        status: row.status || 'Active',
        created_at: row.created_at,
        files: fileArr
    });
});

app.post(['/api/v1/memory/project/:id/folder', '/api/memory/project/:id/folder', '/api/project/:id/folder'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req, { autoCreateIfMissing: true, autoCreateSessionProject: true });
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const folderPath = (req.body && (req.body.path || req.body.folder_path || req.body.name)) || null;
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    const ok = createProjectFolder(id, folderPath);
    if (!ok) return res.status(400).json({ error: 'folder create nahi hua (invalid path?)' });
    res.json({ success: true, message: 'Folder created' });
});

app.post(['/api/v1/memory/project/:id/rename', '/api/memory/project/:id/rename', '/api/project/:id/rename'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const oldPath = String(req.body && (req.body.oldPath || req.body.old_path || req.body.path) || '').replace(/^\/+|\/+$/g, '');
    const newPath = String(req.body && (req.body.newPath || req.body.new_path) || '').replace(/^\/+|\/+$/g, '');
    if (!oldPath || !newPath || oldPath === newPath) return res.status(400).json({ error: 'oldPath + newPath required' });
    if (oldPath.includes('..') || newPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
    
    try {
      const fullOld = workspaceManager.resolvePath(id, oldPath);
      const fullNew = workspaceManager.resolvePath(id, newPath);
      if (fs.existsSync(fullOld)) {
        fs.mkdirSync(require('path').dirname(fullNew), { recursive: true });
        fs.renameSync(fullOld, fullNew);
      }
    } catch (e) { logger.warn('[Server] disk rename failed:', e.message || e); }

    try {
      const rows = db.prepare('SELECT path FROM workspace_files WHERE project_id = ?').all(id);
      const upd = db.prepare('UPDATE workspace_files SET path = ? WHERE project_id = ? AND path = ?');
      for (const r of rows) {
        if (r.path === oldPath) upd.run(newPath, id, r.path);
        else if (r.path.startsWith(oldPath + '/')) upd.run(newPath + r.path.slice(oldPath.length), id, r.path);
      }
    } catch (e) { logger.warn('[Server] DB rename failed', e); }
    notifyWorkspaceChange(id, newPath, 'rename');
    res.json({ success: true, message: 'Renamed' });
});

app.delete(['/api/v1/memory/project/:id/folder', '/api/memory/project/:id/folder', '/api/project/:id/folder'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const folderPath = String((req.query && (req.query.path || req.query.folder_path)) || (req.body && (req.body.path || req.body.folder_path)) || '').replace(/^\/+|\/+$/g, '');
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    if (folderPath.includes('..')) return res.status(400).json({ error: 'invalid path' });

    try {
      const full = workspaceManager.resolvePath(id, folderPath);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    } catch (e) { logger.warn('[Server] disk rm failed:', e.message || e); }
    
    try {
      db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND (path = ? OR path LIKE ?)').run(id, folderPath, folderPath + '/%');
    } catch(e){}
    notifyWorkspaceChange(id, folderPath, 'delete');
    res.json({ success: true, message: 'Folder deleted' });
});

app.post(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req, { autoCreateIfMissing: true, autoCreateSessionProject: true });
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File saved successfully' });
});

app.put(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File updated successfully' });
});

app.delete(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const filePath = String((req.query && (req.query.path || req.query.file_path)) || (req.body && (req.body.path || req.body.file_path)) || '');
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    
    try {
      const fullPath = workspaceManager.resolvePath(id, filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch(e) {}
    
    try {
      db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND path = ?').run(id, filePath);
    } catch(e) {}
    notifyWorkspaceChange(id, filePath, 'delete');
    res.json({ success: true, message: 'File deleted successfully' });
});

// Find in Files — line-based search across a project's physical workspace (Ctrl+Shift+F)
app.get(['/api/v1/memory/project/:id/search', '/api/project/:id/search'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const q = String(req.query.q || '').trim();
    const caseSensitive = req.query.case === '1' || req.query.case === 'true';
    if (!q) return res.json({ query: '', results: [] });
    try {
        const wsRoot = workspaceManager.getWorkspacePath(id);
        const needle = caseSensitive ? q : q.toLowerCase();
        const results = [];
        let total = 0;
        
        function searchDir(dir, base) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                const full = require('path').join(dir, entry.name);
                const rel = base ? base + '/' + entry.name : entry.name;
                if (entry.isDirectory()) {
                    searchDir(full, rel);
                } else {
                    try {
                        const content = fs.readFileSync(full, 'utf8');
                        const lines = content.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
                            if (hay.includes(needle)) {
                                results.push({ path: rel, line: i + 1, text: String(lines[i]).slice(0, 300) });
                                total++;
                                if (total >= 500) return;
                            }
                        }
                    } catch(e) {}
                }
                if (total >= 500) return;
            }
        }
        
        searchDir(wsRoot, '');
        res.json({ query: q, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Chat history persistence endpoints (delegated to ConversationDAO / MessageDAO with legacy fallback)
// P1 FIX (#13): strict conversation ownership.
// - owner = conv.user_id, legacy rows (no conv / NULL user_id) belong to 'local-user'.
// - The old `&& userId !== 'local-user'` bypass let ANY caller read/write/delete
//   local-user data; now ownership is checked with strict equality (local-user
//   still passes because its own identity resolves to 'local-user').
// - 'all' listing: local-user sees everything (status quo), other identities see
//   only conversations they own.
function conversationOwnerMap() {
    const map = new Map();
    try {
        db.prepare('SELECT id, user_id FROM conversations').all()
            .forEach(c => map.set(c.id, c.user_id || 'local-user'));
    } catch (_) {}
    return map;
}

function filterRowsByOwner(rows, userId, owners) {
    if (userId === 'local-user') return rows || [];
    return (rows || []).filter(r => owners.get(r.session_id || 'default') === userId);
}

function getChatHistory(req, res) {
    const sessionId = req.query.session_id;
    const userId = projectAuth.resolveUser(req);
    const conversationDao = new ConversationDAO(db);
    const messageDao = new MessageDAO(db);

    if (sessionId && sessionId !== 'all') {
        const conv = conversationDao.getById(sessionId);
        if (conv) {
            const owner = conv.user_id || 'local-user';
            if (owner !== userId) {
                return res.status(403).json({ success: false, error: `Access denied: You do not own conversation '${sessionId}'` });
            }

            const msgs = messageDao.listByConversation(sessionId);
            if (msgs && msgs.length > 0) {
                const formatted = msgs.map(m => ({
                    id: m.id.startsWith(`${sessionId}_`) ? m.id.slice(sessionId.length + 1) : m.id,
                    session_id: sessionId,
                    role: m.role,
                    content: m.content,
                    timestamp: m.created_at
                }));
                return res.json({
                    success: true,
                    session_id: sessionId,
                    messages: formatted,
                    history: formatted
                });
            }

            // Conversation exists and is owned by the caller — legacy rows for this
            // session belong to it as well.
            const rows = db.prepare('SELECT id, session_id, role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC').all(sessionId);
            const formatted = rows.map(r => ({ ...r, session_id: r.session_id || sessionId }));
            return res.json({ success: true, session_id: sessionId, messages: formatted, history: formatted });
        }

        // No conversation row: legacy ownerless session (chat_history only).
        const rows = db.prepare('SELECT id, session_id, role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC').all(sessionId);
        if (rows.length > 0 && userId !== 'local-user') {
            return res.status(403).json({ success: false, error: `Access denied: You do not own conversation '${sessionId}'` });
        }
        const formatted = rows.map(r => ({ ...r, session_id: r.session_id || sessionId }));
        return res.json({ success: true, session_id: sessionId, messages: formatted, history: formatted });
    }

    // Return all messages across sessions when no session_id is specified or session_id === 'all'
    const owners = conversationOwnerMap();
    let allRows = [];
    try {
        allRows = db.prepare('SELECT id, session_id, role, content, timestamp FROM chat_history ORDER BY id ASC').all();
        allRows = filterRowsByOwner(allRows, userId, owners);
    } catch (e) {
        // P3 #62: never swallow DB errors silently — schema/IO failures used to
        // surface as an empty history with no trace in the logs.
        logger.error('[Server] chat_history SELECT failed:', e.message);
    }

    if (!allRows || allRows.length === 0) {
        try {
            const msgs = db.prepare(`
                SELECT m.id, m.conversation_id AS session_id, m.role, m.content, m.created_at AS timestamp
                FROM messages m
                ORDER BY m.created_at ASC
            `).all();
            allRows = filterRowsByOwner(msgs, userId, owners);
        } catch (e) {
            logger.error('[Server] messages SELECT failed:', e.message);
        }
    }

    const formattedAll = (allRows || []).map(r => ({ ...r, session_id: r.session_id || 'default' }));
    res.json({ success: true, session_id: 'all', messages: formattedAll, history: formattedAll });
}

function deleteChatHistory(req, res) {
    const sessionId = req.query.session_id || 'default';
    const userId = projectAuth.resolveUser(req);
    const conversationDao = new ConversationDAO(db);

    const conv = conversationDao.getById(sessionId);
    if (conv) {
        const owner = conv.user_id || 'local-user';
        if (owner !== userId) {
            return res.status(403).json({ success: false, error: `Access denied: You do not own conversation '${sessionId}'` });
        }
        conversationDao.delete(sessionId);
    } else {
        // Legacy ownerless rows: only the local identity may delete them.
        const legacy = db.prepare('SELECT 1 FROM chat_history WHERE session_id = ? LIMIT 1').get(sessionId);
        if (legacy && userId !== 'local-user') {
            return res.status(403).json({ success: false, error: `Access denied: You do not own conversation '${sessionId}'` });
        }
    }
    db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sessionId);

    // Delete any workspace files, copilot sessions, and physical directories associated with this session!
    // Fulfills: "Agar chat delete ho jaati hai, to IDE ka bhi code delete ho jaana chahiye"
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? OR project_id = ? OR project_id = ?').run(sessionId, `workspace_${sessionId}`, `chat_${sessionId}`);
    db.prepare('DELETE FROM copilot_sessions WHERE id = ?').run(sessionId);
    const projectDao = new ProjectDAO(db);
    projectDao.delete(sessionId, userId);
    projectDao.delete(`workspace_${sessionId}`, userId);
    workspaceManager.deleteWorkspace(sessionId, userId);
    workspaceManager.deleteWorkspace(`workspace_${sessionId}`, userId);

    res.json({ success: true, message: 'History cleared' });
}

function saveChatHistory(req, res) {
    const { session_id, messages, project_id } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
    const sid = session_id || 'default';
    const projId = project_id || 'default';
    const userId = projectAuth.resolveUser(req);

    const conversationDao = new ConversationDAO(db);
    const messageDao = new MessageDAO(db);

    // Verify ownership if conversation exists
    let conv = conversationDao.getById(sid);
    if (conv) {
        const owner = conv.user_id || 'local-user';
        if (owner !== userId) {
            return res.status(403).json({ success: false, error: `Access denied: You do not own conversation '${sid}'` });
        }
    } else {
        // New session id: if legacy ownerless chat_history rows already exist for it,
        // only the local identity may take it over (blocks session-id hijacking that
        // silently destroys another caller's history).
        const legacy = db.prepare('SELECT 1 FROM chat_history WHERE session_id = ? LIMIT 1').get(sid);
        if (legacy && userId !== 'local-user') {
            return res.status(403).json({ success: false, error: `Access denied: Conversation '${sid}' belongs to another user` });
        }
    }

    // Upsert conversation record
    if (!conv) {
        workspaceManager.ensureWorkspaceSync(projId, userId);
        conv = conversationDao.create({
            id: sid,
            projectId: projId,
            userId,
            title: messages[0]?.content ? String(messages[0].content).slice(0, 40) : 'Chat Session',
            surface: 'chat'
        });
    }

    // Clean previous messages in universal DB and legacy chat_history
    messageDao.deleteByConversation(sid);
    const del = db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sid);

    try {
        const ins = db.prepare('INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)');
        const tx = db.transaction((msgs) => {
            for (let i = 0; i < msgs.length; i++) {
                const m = msgs[i];
                if (m && m.role && typeof m.content === 'string') {
                    ins.run(sid, m.role, m.content);
                    const uniqueMsgId = `${sid}_${m.id || Date.now()}_${i}`;
                    messageDao.create({
                        id: uniqueMsgId,
                        conversationId: sid,
                        role: m.role,
                        content: m.content
                    });
                }
            }
        });
        tx(messages);
        res.json({ success: true, saved: messages.length, cleared: del.changes });
    } catch (e) {
        console.error("saveChatHistory ERROR:", e);
        res.status(500).json({ error: e.message });
    }
}

app.get('/api/chat/history', getChatHistory);
app.get('/api/v1/chat/history', getChatHistory);
app.delete('/api/chat/history', deleteChatHistory);
app.post('/api/chat/save', saveChatHistory);
app.post('/api/v1/chat/save', saveChatHistory);

// Root redirect to frontend dev server
app.get('/', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(frontendUrl);
});

// Health check — API key presence booleans only for local callers (no remote key fingerprinting)
app.get(['/health', '/api/health', '/api/v1/health'], (req, res) => {
    const body = {
        status: 'OK',
        timestamp: new Date().toISOString(),
    };
    if (isLoopback(clientIp(req))) {
        const providers = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'OPENROUTER_API_KEY', 'NVIDIA_API_KEY'];
        body.keysConfigured = providers.filter(k => !!process.env[k]).length;
    }
    res.json(body);
});

// Metrics endpoint — loopback only
app.get('/metrics', (req, res) => {
    if (!isLoopback(clientIp(req)) && process.env.ALLOW_PUBLIC_API !== '1') {
        return res.status(403).json({ error: 'Metrics are local-only' });
    }
    res.json({
        success: true,
        metrics: logger.metric.get(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// 404 handler for unknown API endpoints
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
    }
    next();
});

// ── Error-normalization middleware ──────────────────────────────────────
const { toAppError } = require('./utils/errors');

app.use((err, req, res, next) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
        return res.status(400).json({ error: 'Invalid JSON in request body', code: 'BAD_JSON' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
    }
    if (err && err.type && err.type.startsWith('entity.')) {
        return res.status(400).json({ error: err.message || 'Malformed request body', code: 'BAD_BODY' });
    }

    const normalized = toAppError(err);
    logger.error(`[${req.method} ${req.originalUrl}] ${normalized.code}: ${normalized.message}`);
    if (normalized.status >= 500) logger.error(normalized.stack || '');

    if (!res.headersSent) {
        res.status(normalized.status).json({
            error: normalized.message,
            code: normalized.code,
            ...(normalized.details ? { details: normalized.details } : {}),
        });
    }
});

// Global process error catchers — prevent crashes
process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', err?.message, err?.stack);
});

process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled Rejection:', reason?.message || reason);
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const { localOrigin } = require('./middleware/localApiGuard');
const io = new Server(server, {
  cors: {
    // Local origins (Next on :3000, backend :5000) + non-browser clients only.
    // Blocks evil websites from opening Socket.IO sessions against this host.
    origin: (origin, cb) => {
      if (!origin || localOrigin(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});
const { setupTerminalSocket } = require('./sockets/terminal');
setupTerminalSocket(io);

const { setupCollaborationSocket } = require('./sockets/collaboration');
setupCollaborationSocket(io);

// ── Sandbox WebSocket Server ──────────────────────────────────────
const SandboxWebSocketServer = require('./sandbox/wsServer');
const sandboxWs = new SandboxWebSocketServer(server);
sandboxWs.on('log', (data) => logger.info(`[Sandbox:${data.sandboxId}] ${data.message}`));

// ── LSP Proxy ───────────────────────────────────────────────────────
const { setupLspServer } = require('./lsp/lspServer');
setupLspServer(server);

// ── Raw Terminal WebSocket (CodeEditor widget) ─────────────────────
const { setupTerminalWsServer } = require('./sockets/terminalWs');
setupTerminalWsServer(server);

// ── Dev Server HMR & WebSocket Reverse Proxy ────────────────────────
const devServerManager = require('./sandbox/devServerManager');
const net = require('net');

server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  const pathname = url.split('?')[0];
  // engine.io registered its own upgrade listener first — never touch its path
  if (pathname.startsWith('/socket.io')) return;

  let projectId = null;
  const previewMatch = pathname.match(/^\/api\/preview\/([^\/]+)/);
  if (previewMatch) {
    projectId = previewMatch[1];
  } else {
    const referer = request.headers['referer'] || '';
    const refMatch = referer.match(/\/api\/preview\/([^\/\?]+)/);
    if (refMatch) projectId = refMatch[1];
    if (!projectId) {
      // Vite HMR fallback: `ws://host/?token=X` has no project in the path and
      // WS handshakes carry no Referer — resolve the project through the token
      // index the preview proxy fills when it serves `/@vite/client`.
      const tok = (url.match(/[?&]token=([^&\s]+)/) || [])[1];
      if (tok) projectId = devServerManager.getProjectByHmrToken(decodeURIComponent(tok));
    }
  }

  if (projectId) {
    const devServer = devServerManager.getServerByProject(projectId);
    if (devServer && devServer.hostPort && devServer.state === 'READY') {
      // #26: we take ownership of this socket — catch-all must not destroy it
      socket.__upgradeHandled = true;
      const devSocket = net.connect(devServer.hostPort, '127.0.0.1', () => {
        devSocket.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);
        for (let i = 0; i < request.rawHeaders.length; i += 2) {
          let headerName = request.rawHeaders[i];
          let headerVal = request.rawHeaders[i + 1];
          if (headerName.toLowerCase() === 'host') headerVal = `127.0.0.1:${devServer.hostPort}`;
          devSocket.write(`${headerName}: ${headerVal}\r\n`);
        }
        devSocket.write('\r\n');
        if (head && head.length > 0) devSocket.write(head);
        devSocket.pipe(socket);
        socket.pipe(devSocket);
      });

      devSocket.on('error', (err) => {
        logger.warn(`[HMR Proxy] Error connecting to dev server :${devServer.hostPort}:`, err.message);
        socket.destroy();
      });
      socket.on('error', () => {
        devSocket.destroy();
      });
    }
  }
});

// ── Catch-all upgrade handler (MUST stay registered LAST — #26) ────────
// Every real WS consumer above claims its socket via `socket.__upgradeHandled`.
// Anything else (unknown path, HMR proxy with no READY dev server, socket.io
// path miss) previously hung forever as a dead TCP/FD leak. Engine.io owns
// '/socket.io' (it handles or errors those upgrades itself).
server.on('upgrade', (request, socket) => {
  const pathname = ((request.url || '').split('?')[0]) || '';
  if (pathname.startsWith('/socket.io')) return;
  if (socket.__upgradeHandled) return;
  logger.warn(`[WS] Unclaimed upgrade destroyed: ${pathname} from ${socket.remoteAddress || 'unknown'}`);
  socket.destroy();
});

function startServer(port = PORT) {
  return server.listen(port, () => {
    logger.info(`🚀 AI Dost Server running on http://localhost:${port}`);
    logger.info(`   Health : http://localhost:${port}/health`);
    logger.info(`   Chat   : http://localhost:${port}/api/chat`);
    logger.info(`   Image  : http://localhost:${port}/api/image/generate`);
    logger.info(`   Test   : http://localhost:${port}/api/test/all`);
  });
}

if (require.main === module) {
  startServer();

  // ── Telegram bot (optional — TELEGRAM_BOT_TOKEN env se enable) ──────────────
  try {
    const { startTelegramBot } = require('./services/telegramBot');
    startTelegramBot();
  } catch (e) {
    logger.warn('⚠️ Telegram bot start fail:', e.message);
  }
}

module.exports = { app, server, io, sandboxWs, db, startServer, PORT };
