const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// ── SQLite Initialization ─────────────────────────────────────────────
const dbPath = path.join(__dirname, 'data', 'app.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

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

// Helper: save a project file to SQLite
function saveProjectFile(projectId, filePath, content) {
  const existing = db.prepare('SELECT id FROM workspace_files WHERE project_id = ? AND path = ?').get(projectId, filePath);
  if (existing) {
    db.prepare('UPDATE workspace_files SET content = ?, last_modified = datetime(\'now\') WHERE id = ?')
      .run(content, existing.id);
  } else {
    db.prepare('INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)')
      .run(projectId, filePath, content);
  }
  return true;
}

// Helper: create a folder in the agent workspace + persist a .gitkeep marker so the UI tree sees it
function createProjectFolder(projectId, folderPath) {
  const safe = String(folderPath || '').replace(/^\/+|\/+$/g, '');
  if (!safe || safe.includes('..')) return false;
  try {
    const dir = path.join(os.tmpdir(), `agent-ws-${projectId}`, safe);
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
  const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
  return rows.reduce((acc, { path, content }) => {
    acc[path] = content || '';
    return acc;
  }, {});
}

// Close DB on process exit
process.on('beforeExit', () => {
  db.close();
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

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const chatRoutes    = require('./routes/chat');
const testRoutes    = require('./routes/test');
const imageRoutes   = require('./routes/image');
const pdfRoutes     = require('./routes/pdf');
const learningRoutes = require('./routes/learning');
const gitRoutes     = require('./routes/git');
const agentRoutes   = require('./routes/agent');
const previewRoutes = require('./routes/preview');
const terminalRoutes = require('./routes/terminal');

app.use('/api/chat',     chatRoutes);
app.use('/api/test',     testRoutes);
app.use('/api/image',    imageRoutes);
app.use('/api/pdf',      pdfRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/git',      gitRoutes);
app.use('/api/agent',    agentRoutes);
app.use('/api/preview',  previewRoutes);
app.use('/api/terminal', terminalRoutes);

// v1 aliases so the frontend API client (baseURL /api/v1) resolves correctly
app.use('/api/v1/chat',     chatRoutes);
app.use('/api/v1/test',     testRoutes);
app.use('/api/v1/image',    imageRoutes);
app.use('/api/v1/pdf',      pdfRoutes);
app.use('/api/v1/learning', learningRoutes);
app.use('/api/v1/git',      gitRoutes);
app.use('/api/v1/agent',    agentRoutes);
app.use('/api/v1/terminal', terminalRoutes);

// ── AI Assistant Endpoints (mounted at /api/v1/ai) ──────────────────────────
// This allows frontend calls to /ai/code-suggestions and /ai/lsp-diagnostics
// to resolve to /api/v1/ai/code-suggestions via the agent router.
app.use('/api/v1/ai',    agentRoutes);

// ── New API Routes ──────────────────────────────────────────────────────────

// Gemini Live API ephemeral token (client-side auth for WebSocket)
app.get('/api/gemini-live-token', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Gemini API key not configured' });
  const token = Buffer.from(JSON.stringify({ key, exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64');
  res.json({ token, expiresIn: 1800 });
});

app.get('/api/v1/gemini-live-token', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Gemini API key not configured' });
  const token = Buffer.from(JSON.stringify({ key, exp: Math.floor(Date.now() / 1000) + 1800 })).toString('base64');
  res.json({ token, expiresIn: 1800 });
});

// Voice session management
const voiceSessions = new Map();

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

// Resume builder: generate structured resume from chat prompt
const resumeGenerateHandler = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const GroqService = require('./services/groqService');

  const systemPrompt = `You are a resume writer. Given the user prompt, extract and return a structured JSON resume with these exact fields: fullName (string), contact (object with email+phone), summary (2-3 sentences string), experience (array of {company, role, duration, bullets}), education (array of {institution, degree, year}), skills (array of strings). Return ONLY valid JSON, no prose, no markdown formatting, no code blocks. If any field is unknown, use null or empty array.`;

  try {
    const resp = await GroqService.chat(`${systemPrompt} USER PROMPT: ${prompt}`, [], 'project', null);
    
    // GroqService.chat returns a string content from the LLM
    let content = '';
    if (typeof resp === 'string') {
      content = resp;
    } else if (resp && typeof resp === 'object') {
      // Handle object response if needed
      content = resp.content || resp.text || JSON.stringify(resp);
    }

    if (!content || content.length < 10) {
      // Fallback: simple pattern extraction
      const nameMatch = prompt.match(/[a-zA-Z]+ [a-zA-Z]+/);
      const data = {
        fullName: nameMatch ? nameMatch[0] : 'Your Name',
        contact: null,
        summary: 'AI-generated resume summary based on your prompt.',
        experience: [],
        education: [],
        skills: []
      };
      const stmt = db.prepare('INSERT INTO resumes (prompt, json_data) VALUES (?, ?)');
      stmt.run(prompt, JSON.stringify(data));
      return res.json(data);
    }

    // Strip markdown code blocks and extra whitespace
    const cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Parse the JSON response
    let jsonData;
    try {
      jsonData = JSON.parse(cleaned);
    } catch (parseErr) {
      // If LLM didn't return clean JSON, try to extract what we can
      console.warn('[Resume] JSON parse failed, attempting recovery:', parseErr.message);
      jsonData = {
        fullName: 'Your Name',
        contact: null,
        summary: content.substring(0, 200),
        experience: [],
        education: [],
        skills: []
      };
    }

    // Save to SQLite
    const stmt = db.prepare('INSERT INTO resumes (prompt, json_data) VALUES (?, ?)');
    stmt.run(prompt, JSON.stringify(jsonData));

    res.json(jsonData);
  } catch (e) {
    logger.error('Resume generation error:', e.message);
    const fallback = {
      fullName: 'Your Name',
      contact: null,
      summary: 'Resume generated with Waaw AI',
      experience: [],
      education: [],
      skills: []
    };
    const stmt = db.prepare('INSERT INTO resumes (prompt, json_data) VALUES (?, ?)');
    stmt.run(prompt, JSON.stringify(fallback));
    res.status(500).json({ error: 'Resume generation failed', detail: e.message });
  }
};
app.post('/api/resume/generate', resumeGenerateHandler);
app.post('/api/v1/resume/generate', resumeGenerateHandler);

// ── Project Memory endpoints (SQLite-backed) ──────────────────────────────
app.get(['/api/v1/memory/projects', '/api/projects'], (req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
    res.json(rows.map(r => ({
        project_id: r.id,
        project_name: r.name,
        description: r.description || '',
        created_at: r.created_at,
        status: r.status || 'Active'
    })));
});

app.post(['/api/v1/memory/project', '/api/project'], (req, res) => {
    const { project_name, description, user_id } = req.body;
    const id = (req.body && req.body.project_id) || 'proj_' + Date.now();
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (existing) {
      return res.json({
        project_id: existing.id,
        project_name: existing.name,
        description: existing.description || '',
        created_at: existing.created_at,
        status: existing.status || 'Active'
      });
    }
    const now = new Date().toISOString();
    db.prepare('INSERT INTO projects (id, name, description, created_at, status) VALUES (?, ?, ?, ?, ?)')
      .run(id, project_name || 'New AI-Dost Workspace', description || 'Interactive AI Copilot Workspace', now, 'Active');
    res.json({
        project_id: id,
        project_name: project_name || 'New AI-Dost Workspace',
        description: description || 'Interactive AI Copilot Workspace',
        created_at: now,
        status: 'Active'
    });
});

app.delete(['/api/v1/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    if (id.startsWith('proj_demo_')) return res.status(400).json({ error: 'Demo projects cannot be deleted' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    db.prepare('DELETE FROM workspace_files WHERE project_id = ?').run(id);
    res.json({ success: true, message: 'Project deleted' });
});

app.get(['/api/v1/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Project not found' });
    const files = getProjectFiles(id);
    const fileArr = Object.keys(files).map(path => ({ path, content: files[path] }));
    if (fileArr.length === 0) {
        fileArr.push(
            { path: 'README.md', content: `# ${row.name}\n\n${row.description || 'AI-Dost project'}\n` },
            { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>' + row.name + '</title>\n</head>\n<body>\n  <h1>' + row.name + '</h1>\n</body>\n</html>\n' }
        );
    }
    res.json({
        project_id: row.id,
        project_name: row.name,
        description: row.description || '',
        status: row.status || 'Active',
        created_at: row.created_at,
        files: fileArr
    });
});

app.post(['/api/v1/memory/project/:id/folder', '/api/project/:id/folder'], (req, res) => {
    const { id } = req.params;
    const folderPath = (req.body && (req.body.path || req.body.folder_path || req.body.name)) || null;
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    const ok = createProjectFolder(id, folderPath);
    if (!ok) return res.status(400).json({ error: 'folder create nahi hua (invalid path?)' });
    res.json({ success: true, message: 'Folder created' });
});

app.post(['/api/v1/memory/project/:id/rename', '/api/project/:id/rename'], (req, res) => {
    const { id } = req.params;
    const oldPath = String(req.body && (req.body.oldPath || req.body.old_path || req.body.path) || '').replace(/^\/+|\/+$/g, '');
    const newPath = String(req.body && (req.body.newPath || req.body.new_path) || '').replace(/^\/+|\/+$/g, '');
    if (!oldPath || !newPath || oldPath === newPath) return res.status(400).json({ error: 'oldPath + newPath required' });
    if (oldPath.includes('..') || newPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
    // Disk: file ya folder dono ko rename
    const wsRoot = path.join(os.tmpdir(), `agent-ws-${id}`);
    try {
      const oldFull = path.join(wsRoot, oldPath);
      const newFull = path.join(wsRoot, newPath);
      if (fs.existsSync(oldFull)) {
        fs.mkdirSync(path.dirname(newFull), { recursive: true });
        fs.renameSync(oldFull, newFull);
      }
    } catch (e) { logger.warn('[Server] disk rename failed:', e.message || e); }
    // DB: file exact-match, folder = prefix move
    const rows = db.prepare('SELECT path FROM workspace_files WHERE project_id = ?').all(id);
    const upd = db.prepare('UPDATE workspace_files SET path = ? WHERE project_id = ? AND path = ?');
    for (const r of rows) {
      if (r.path === oldPath) upd.run(newPath, id, r.path);
      else if (r.path.startsWith(oldPath + '/')) upd.run(newPath + r.path.slice(oldPath.length), id, r.path);
    }
    res.json({ success: true, message: 'Renamed' });
});

app.delete(['/api/v1/memory/project/:id/folder', '/api/project/:id/folder'], (req, res) => {
    const { id } = req.params;
    const folderPath = String((req.query && (req.query.path || req.query.folder_path)) || (req.body && (req.body.path || req.body.folder_path)) || '').replace(/^\/+|\/+$/g, '');
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    if (folderPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
    // Disk: folder + contents remove
    try {
      const full = path.join(os.tmpdir(), `agent-ws-${id}`, folderPath);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    } catch (e) { logger.warn('[Server] disk rm failed:', e.message || e); }
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND (path = ? OR path LIKE ?)').run(id, folderPath, folderPath + '/%');
    res.json({ success: true, message: 'Folder deleted' });
});

app.post(['/api/v1/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File saved successfully' });
});

app.put(['/api/v1/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File updated successfully' });
});

app.delete(['/api/v1/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const filePath = (req.query && (req.query.path || req.query.file_path)) || (req.body && (req.body.path || req.body.file_path));
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND path = ?').run(id, filePath);
    res.json({ success: true, message: 'File deleted successfully' });
});

// Find in Files — line-based search across a project's workspace (Ctrl+Shift+F)
app.get(['/api/v1/memory/project/:id/search', '/api/project/:id/search'], (req, res) => {
    const { id } = req.params;
    const q = String(req.query.q || '').trim();
    const caseSensitive = req.query.case === '1' || req.query.case === 'true';
    if (!q) return res.json({ query: '', results: [] });
    try {
        const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(id);
        const needle = caseSensitive ? q : q.toLowerCase();
        const results = [];
        let total = 0;
        for (const row of rows) {
            if (/node_modules|\/\.git\//.test(row.path)) continue;
            const lines = String(row.content || '').split('\n');
            for (let i = 0; i < lines.length; i++) {
                const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
                if (hay.includes(needle)) {
                    results.push({ path: row.path, line: i + 1, text: String(lines[i]).slice(0, 300) });
                    total++;
                    if (total >= 500) break;
                }
            }
            if (total >= 500) break;
        }
        res.json({ query: q, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Chat history persistence endpoints
app.get('/api/v1/chat/history', (req, res) => {
    const sessionId = req.query.session_id || 'default';
    const rows = db.prepare('SELECT id, role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC').all(sessionId);
    res.json({ success: true, session_id: sessionId, messages: rows });
});

app.post('/api/v1/chat/save', (req, res) => {
    const { session_id, messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
    const sid = session_id || 'default';
    const del = db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sid);
    const ins = db.prepare('INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)');
    const tx = db.transaction((msgs) => {
        for (const m of msgs) {
            if (m && m.role && typeof m.content === 'string') ins.run(sid, m.role, m.content);
        }
    });
    tx(messages);
    res.json({ success: true, saved: messages.length, cleared: del.changes });
});

app.delete('/api/v1/chat/history', (req, res) => {
    const sessionId = req.query.session_id || 'default';
    db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sessionId);
    res.json({ success: true, message: 'History cleared' });
});

// Root redirect to frontend dev server
app.get('/', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(frontendUrl);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        groqKey:       !!process.env.GROQ_API_KEY,
        geminiKey:     !!process.env.GEMINI_API_KEY,
        deepseekKey:   !!process.env.DEEPSEEK_API_KEY,
        openrouterKey: !!process.env.OPENROUTER_API_KEY,
        nvidiaKey:     !!process.env.NVIDIA_API_KEY,
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
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

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Server Error:', err.message, err.stack);
    if (!res.headersSent) {
        res.status(500).json({
            error: 'Internal server error',
            message: err.message || 'An unexpected error occurred',
        });
    }
});

// Global process error catchers — prevent crashes
process.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught Exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled Rejection:', reason?.message || reason);
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// ── Socket.io (real-time terminal) ───────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});
const { setupTerminalSocket } = require('./sockets/terminal');
setupTerminalSocket(io);

// ── LSP Proxy ───────────────────────────────────────────────────────
const { setupLspServer } = require('./lsp/lspServer');
setupLspServer(server);

server.listen(PORT, () => {
    logger.info(`🚀 AI Dost Server running on http://localhost:${PORT}`);
    logger.info(`   Health : http://localhost:${PORT}/health`);
    logger.info(`   Chat   : http://localhost:${PORT}/api/chat`);
    logger.info(`   Image  : http://localhost:${PORT}/api/image/generate`);
    logger.info(`   Test   : http://localhost:${PORT}/api/test/all`);
});
