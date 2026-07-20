const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Debug middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
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

app.use('/api/chat', chatRoutes);
app.use('/api/test', testRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/pdf', pdfRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        groqKey: !!process.env.GROQ_API_KEY,
        geminiKey: !!process.env.GEMINI_API_KEY,
        deepseekKey: !!process.env.DEEPSEEK_API_KEY
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
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
