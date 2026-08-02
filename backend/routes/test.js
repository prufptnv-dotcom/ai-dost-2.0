const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Code Execution Fallback Endpoint
router.post('/execute', (req, res) => {
    const { language, code } = req.body;
    const lang = (language || 'python').toLowerCase();
    
    let stdinData = '';
    if (code && code.includes('input(')) {
        stdinData = 'User\nFriend1\nFriend2\nFriend3\n';
    }

    const tmpDir = os.tmpdir();
    const ext = lang === 'javascript' || lang === 'js' ? 'js' : 'py';
    const filePath = path.join(tmpDir, `sandbox_${Date.now()}.${ext}`);

    try {
        fs.writeFileSync(filePath, code, 'utf-8');
    } catch (err) {
        return res.status(500).json({ stdout: '', stderr: err.message, exit_code: 1 });
    }

    const cmd = ext === 'js' ? `node "${filePath}"` : `python "${filePath}"`;

    const child = exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(filePath); } catch (e) {}

        if (error && error.killed) {
            return res.json({
                stdout: stdout || '',
                stderr: 'Execution Error: Timed out after 15 seconds.',
                exit_code: 124,
                duration: 15000
            });
        }

        res.json({
            stdout: stdout || '',
            stderr: stderr || (error ? error.message : ''),
            exit_code: error ? error.code || 1 : 0,
            duration: 100
        });
    });

    if (stdinData) {
        child.stdin.write(stdinData);
        child.stdin.end();
    }
});

// Test endpoint for all APIs
router.get('/all', async (req, res) => {
    const results = {};
    
    // Test Groq
    try {
        const GroqService = require('../services/groqService');
        const groqResponse = await GroqService.chat('Hello, say hi');
        results.groq = { status: '✅ Working', response: groqResponse.substring(0, 50) };
    } catch (e) {
        results.groq = { status: '❌ Failed', error: e.message };
    }
    
    // Test Gemini
    try {
        const GeminiService = require('../services/geminiService');
        const geminiResponse = await GeminiService.chat('Hello, say hi');
        results.gemini = { status: '✅ Working', response: geminiResponse.substring(0, 50) };
    } catch (e) {
        results.gemini = { status: '❌ Failed', error: e.message };
    }
    
    res.json({
        message: 'API Test Results',
        results,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
