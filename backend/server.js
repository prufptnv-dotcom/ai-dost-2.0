const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Debug & timing middleware
app.use((req, res, next) => {
    const start = Date.now();
    const origEnd = res.end;
    res.end = function(...args) {
        const duration = Date.now() - start;
        if (!res.headersSent) {
            res.setHeader('X-Response-Time-Ms', duration);
        }
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
        return origEnd.apply(this, args);
    };
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
const chatRoutes = require('./routes/chat');
const testRoutes = require('./routes/test');
const imageRoutes = require('./routes/image');
const pdfRoutes = require('./routes/pdf');
const learningRoutes = require('./routes/learning');
const gitRoutes = require('./routes/git');
const agentRoutes = require('./routes/agent');

app.use('/api/chat', chatRoutes);
app.use('/api/test', testRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/git', gitRoutes);
app.use('/api/agent', agentRoutes);

// Root redirect to frontend
app.get('/', (req, res) => {
    res.redirect('http://localhost:3001');
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        groqKey: !!process.env.GROQ_API_KEY,
        geminiKey: !!process.env.GEMINI_API_KEY,
        deepseekKey: !!process.env.DEEPSEEK_API_KEY,
        openrouterKey: !!process.env.OPENROUTER_API_KEY,
        nvidiaKey: !!process.env.NVIDIA_API_KEY
    });
});

// 404 handler for unknown API endpoints
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
    }
    next();
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    if (!res.headersSent) {
        res.status(500).json({
            error: 'Internal server error',
            message: err.message || 'An unexpected error occurred'
        });
    }
});

// Global process error catchers to avoid crashes
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 AI Dost Server running on http://localhost:${PORT}`);
    console.log('📋 Available endpoints:');
    console.log(`   - Health: http://localhost:${PORT}/health`);
    console.log(`   - Chat: http://localhost:${PORT}/api/chat`);
    console.log(`   - Image: http://localhost:${PORT}/api/image/generate`);
    console.log(`   - Test: http://localhost:${PORT}/api/test/all\n`);
});
