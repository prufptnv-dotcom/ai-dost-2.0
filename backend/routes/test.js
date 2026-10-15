const express = require('express');
const logger = require('../logger');
const router = express.Router();
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// P0 FIX (#19): host code execution is gated — disabled in production by
// default, kill-switch via ALLOW_HOST_CODE_EXEC=0/1.
function isHostCodeExecEnabled() {
    const flag = process.env.ALLOW_HOST_CODE_EXEC;
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    return process.env.NODE_ENV !== 'production';
}

// Code Execution Fallback Endpoint
router.post('/execute', (req, res) => {
    const { language, code, stdin: requestStdin } = req.body || {};

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ stdout: '', stderr: 'Code is required.', exit_code: 1 });
    }
    if (code.length > 200000) {
        return res.status(400).json({ stdout: '', stderr: 'Code payload too large.', exit_code: 1 });
    }
    if (!isHostCodeExecEnabled()) {
        return res.status(503).json({ stdout: '', stderr: 'Code execution disabled (ALLOW_HOST_CODE_EXEC).', exit_code: 1 });
    }

    const lang = (language || 'python').toLowerCase();
    const ext = lang === 'javascript' || lang === 'js' ? 'js' : 'py';

    // P0 FIX (#20): no more hardcoded 'User\nFriend1...' stdin. Callers supply
    // real stdin; otherwise stdin is closed immediately so input() gets EOF
    // instead of fabricated answers.
    let stdinData = null;
    if (typeof requestStdin === 'string' && requestStdin.length > 0) {
        stdinData = requestStdin.slice(0, 64 * 1024); // bounded
    }

    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, `sandbox_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`);

    try {
        fs.writeFileSync(filePath, code, 'utf-8');
    } catch (err) {
        return res.status(500).json({ stdout: '', stderr: err.message, exit_code: 1 });
    }

    const startedAt = Date.now();
    // execFile argv array — no shell parsing of filePath
    const bin = ext === 'js' ? 'node' : 'python';
    const child = execFile(bin, [filePath], { timeout: 15000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(filePath); } catch (e) {}

        if (error && error.killed) {
            return res.json({
                stdout: stdout || '',
                stderr: 'Execution Error: Timed out after 15 seconds.',
                exit_code: 124,
                duration: Date.now() - startedAt
            });
        }

        res.json({
            stdout: stdout || '',
            stderr: stderr || (error ? error.message : ''),
            exit_code: error ? error.code || 1 : 0,
            duration: Date.now() - startedAt
        });
    });

    if (child.stdin) {
        // Swallow EPIPE when the child exits before reading stdin
        child.stdin.on('error', () => {});
        if (stdinData !== null) {
            child.stdin.write(stdinData);
        }
        child.stdin.end(); // EOF — input() raises EOFError instead of fake data
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
