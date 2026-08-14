const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./logger');
const Database = require('better-sqlite3');

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
  const stmt = db.prepare(
    `INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET content = ?, last_modified = datetime('now')`
  );
  stmt.run(projectId, filePath, content);
  return true;
}

// Helper: get all files for a project
function getProjectFiles(projectId) {
  const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all();
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

app.use('/api/chat',     chatRoutes);
app.use('/api/test',     testRoutes);
app.use('/api/image',    imageRoutes);
app.use('/api/pdf',      pdfRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/git',      gitRoutes);
app.use('/api/agent',    agentRoutes);

// ── AI Assistant Endpoints (mounted at /api/v1/ai) ──────────────────────────
// This allows frontend calls to /ai/code-suggestions and /ai/lsp-diagnostics
// to resolve to /api/v1/ai/code-suggestions via the agent router.
app.use('/api/v1/ai',    agentRoutes);

// ── New API Routes ──────────────────────────────────────────────────────────

// Gemini Live API ephemeral token (client-side auth for WebSocket)
app.get('/api/gemini-live-token', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Gemini API key not configured' });
  // Simple JWT-like token valid for 30 minutes
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

app.post('/api/voice/stop', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && voiceSessions.has(sessionId)) {
    voiceSessions.get(sessionId).active = false;
    res.json({ sessionId, status: 'stopped' });
  } else {
    res.status(404).json({ error: 'Voice session not found' });
  }
});

// Resume builder: generate structured resume from chat prompt
app.post('/api/resume/generate', async (req, res) => {
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
});

// Fallback Project Memory endpoints (existing, keep unchanged)
app.get(['/api/v1/memory/projects', '/api/projects'], (req, res) => {
    res.json([
        {
            project_id: 'proj_demo_1',
            project_name: 'AI-Dost Interactive Web App',
            description: 'Glassmorphism Web IDE & Autonomous AI Copilot Workspace',
            created_at: new Date().toISOString(),
            status: 'Active'
        },
        {
            project_id: 'proj_demo_2',
            project_name: 'Python Calculator Engine',
            description: 'Standalone Python & Glassmorphic Web Calculator App',
            created_at: new Date().toISOString(),
            status: 'Completed'
        }
    ]);
});

app.post(['/api/v1/memory/project', '/api/project'], (req, res) => {
    const { project_name, description } = req.body;
    res.json({
        project_id: 'proj_' + Date.now(),
        project_name: project_name || 'New AI-Dost Workspace',
        description: description || 'Interactive AI Copilot Workspace',
        created_at: new Date().toISOString(),
        status: 'Active'
    });
});

app.get(['/api/v1/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    res.json({
        project_id: id || 'proj_demo_1',
        project_name: id === 'proj_demo_2' ? 'Python Calculator Engine' : 'AI-Dost Interactive Web App',
        description: 'Interactive Development Sandbox & AI Copilot Workspace',
        status: 'Development',
        files: [
            { path: 'main.py', content: '# Write python code here...\nprint("Hello from AI-Dost Sandbox!")\n' },
            { path: 'index.html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="container">\n    <h1>Welcome to AI-Dost Sandbox</h1>\n    <p>AI Copilot Workspace is active and ready!</p>\n  </div>\n</body>\n</html>\n' },
            { path: 'style.css', content: 'body {\n  background: #05060a;\n  color: #06b6d4;\n  font-family: sans-serif;\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  height: 100vh;\n  margin: 0;\n}\n.container {\n  text-align: center;\n  border: 1px solid rgba(6, 182, 212, 0.2);\n  padding: 32px;\n  border-radius: 16px;\n  background: rgba(14, 16, 24, 0.8);\n}\n' }
        ]
    });
});

app.post(['/api/v1/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    res.json({ success: true, message: 'File added successfully' });
});

app.put(['/api/v1/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    res.json({ success: true, message: 'File updated successfully' });
});

app.delete(['/api/v1/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    res.json({ success: true, message: 'File deleted successfully' });
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
app.listen(PORT, () => {
    logger.info(`🚀 AI Dost Server running on http://localhost:${PORT}`);
    logger.info(`   Health : http://localhost:${PORT}/health`);
    logger.info(`   Chat   : http://localhost:${PORT}/api/chat`);
    logger.info(`   Image  : http://localhost:${PORT}/api/image/generate`);
    logger.info(`   Test   : http://localhost:${PORT}/api/test/all`);
});
