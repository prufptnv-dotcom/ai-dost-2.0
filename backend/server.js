const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./logger');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

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

// Fallback Project Memory endpoints
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
