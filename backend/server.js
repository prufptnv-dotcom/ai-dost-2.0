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
const dns = require('dns');
const crypto = require('crypto');

// Windows pe IPv6 route kabhi-kabhi blackhole hota hai → Node fetch hang.
// IPv4 pehle try karo (Pollinations/Gemini/Telegram sab IPv4 se reliable).
dns.setDefaultResultOrder('ipv4first');

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

// Cross-Origin Isolation headers for WebContainer in-browser runtime
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Generated images (Gemini fallback saves yahan)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Serve generated documents from frontend/public/downloads
app.use('/downloads', express.static(path.join(__dirname, '../frontend/public/downloads')));

// Routes
const chatRoutes    = require('./routes/chat');
const testRoutes    = require('./routes/test');
const imageRoutes   = require('./routes/image');
const pdfRoutes     = require('./routes/pdf');
const learningRoutes = require('./routes/learning');
const gitRoutes     = require('./routes/git');
const agentRoutes   = require('./routes/agent');
const figmaRoutes   = require('./routes/figma');
const previewRoutes = require('./routes/preview');
const terminalRoutes = require('./routes/terminal');
const sandboxRoutes = require('./sandbox/routes');
const deployRoutes = require('./routes/deploy');

app.use('/api/chat',     chatRoutes);
app.use('/api/test',     testRoutes);
app.use('/api/image',    imageRoutes);
app.use('/api/pdf',      pdfRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/git',      gitRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/figma', figmaRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/terminal', terminalRoutes);
app.use('/api/sandbox',  sandboxRoutes);
app.use('/api/deploy',   deployRoutes);

// Troubleshooting aliases (documented in AGENTS.md) — same data as /api/agent/quota-status
app.get('/api/quota-status', (_req, res) => res.redirect('/api/agent/quota-status'));
app.get('/api/circuit-breaker', (_req, res) => res.redirect('/api/agent/quota-status'));

// v1 aliases so the frontend API client (baseURL /api/v1) resolves correctly
app.use('/api/v1/chat',     chatRoutes);
app.use('/api/v1/test',     testRoutes);
app.use('/api/v1/image',    imageRoutes);
app.use('/api/v1/pdf',      pdfRoutes);
app.use('/api/v1/learning', learningRoutes);
app.use('/api/v1/git',      gitRoutes);
app.use('/api/v1/agent',    agentRoutes);
app.use('/api/v1/terminal', terminalRoutes);
app.use('/api/v1/sandbox',  sandboxRoutes);
app.use('/api/v1/deploy',   deployRoutes);

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
app.use('/api/document', documentRoutes);
app.use('/api/eval', evalRoutes);
app.use('/api/v1/document', documentRoutes);

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

app.post(['/api/v1/memory/project', '/api/memory/project', '/api/project'], (req, res) => {
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

app.delete(['/api/v1/memory/project/:id', '/api/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    if (id.startsWith('proj_demo_')) return res.status(400).json({ error: 'Demo projects cannot be deleted' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    db.prepare('DELETE FROM workspace_files WHERE project_id = ?').run(id);
    res.json({ success: true, message: 'Project deleted' });
});

app.get(['/api/v1/memory/project/:id', '/api/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    let row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!row) {
        // Auto-create workspace record if not found
        const now = new Date().toISOString();
        db.prepare('INSERT INTO projects (id, name, description, created_at, status) VALUES (?, ?, ?, ?, ?)').run(
            id,
            id === 'copilot-workspace' ? 'Copilot Workspace' : id,
            'Autonomous AI Copilot Workspace',
            now,
            'Active'
        );
        row = { id, name: id, description: 'Autonomous AI Copilot Workspace', created_at: now, status: 'Active' };
    }
    const files = getProjectFiles(id);
    const fileArr = Object.keys(files).map(path => ({ path, content: files[path] }));
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
    const folderPath = (req.body && (req.body.path || req.body.folder_path || req.body.name)) || null;
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    const ok = createProjectFolder(id, folderPath);
    if (!ok) return res.status(400).json({ error: 'folder create nahi hua (invalid path?)' });
    res.json({ success: true, message: 'Folder created' });
});

app.post(['/api/v1/memory/project/:id/rename', '/api/memory/project/:id/rename', '/api/project/:id/rename'], (req, res) => {
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

app.delete(['/api/v1/memory/project/:id/folder', '/api/memory/project/:id/folder', '/api/project/:id/folder'], (req, res) => {
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

app.post(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File saved successfully' });
});

app.put(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File updated successfully' });
});

app.delete(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
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

// Chat history persistence endpoints (registered under both /api and /api/v1 —
// frontend proxies /api/chat/history; keep aliases in sync)
function getChatHistory(req, res) {
    const sessionId = req.query.session_id || 'default';
    const rows = db.prepare('SELECT id, role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC').all(sessionId);
    res.json({ success: true, session_id: sessionId, messages: rows });
}

function deleteChatHistory(req, res) {
    const sessionId = req.query.session_id || 'default';
    db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sessionId);
    res.json({ success: true, message: 'History cleared' });
}

function saveChatHistory(req, res) {
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
}

app.get('/api/chat/history', getChatHistory);
app.get('/api/v1/chat/history', getChatHistory);
app.delete('/api/chat/history', deleteChatHistory);
app.delete('/api/v1/chat/history', deleteChatHistory);
app.post('/api/chat/save', saveChatHistory);
app.post('/api/v1/chat/save', saveChatHistory);

// Root redirect to frontend dev server
app.get('/', (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
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

// ── Error-normalization middleware ──────────────────────────────────────
// Converts any thrown/rejected error into a consistent JSON envelope.
// Handles: AppError, JSON parse errors, body-parser errors, timeouts.
const { toAppError } = require('./utils/errors');

app.use((err, req, res, next) => {
    // Body-parser / JSON parse errors (malformed request body)
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

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// ── Socket.io (real-time terminal) ───────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});
const { setupTerminalSocket } = require('./sockets/terminal');
setupTerminalSocket(io);

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
