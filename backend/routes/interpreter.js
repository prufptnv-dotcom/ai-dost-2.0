const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const logger = require('../logger');

/**
 * interpreter.js
 *
 * Code Interpreter Endpoint.
 * Executes Python or Javascript code on the fly and returns the result.
 * Supports the AI's "Advanced Data Analysis" and "Canvas Run" features.
 *
 * P0 hardening (#18):
 *  - language validated BEFORE any temp file is written (no file leak on 400)
 *  - execFile (argv array) instead of shell-string exec (no shell injection)
 *  - unique random filename per run; temp file unlinked on every path
 *  - kill-switch: ALLOW_HOST_CODE_EXEC=0 disables host execution entirely
 *    (default: enabled in dev, disabled when NODE_ENV=production)
 */

const SUPPORTED_LANGUAGES = new Set([
    'python', 'py', 'python3',
    'javascript', 'js', 'node',
    'sh', 'bash', 'shell', 'zsh', 'powershell', 'ps1'
]);

function isHostCodeExecEnabled() {
    const flag = process.env.ALLOW_HOST_CODE_EXEC;
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    return process.env.NODE_ENV !== 'production';
}

router.post('/execute', async (req, res) => {
    const { code, language } = req.body;

    if (!code || !language) {
        return res.status(400).json({ success: false, error: "Code and language are required." });
    }

    // P0 FIX: validate BEFORE creating any file (previously an unsupported
    // language wrote a temp file and returned 400 without ever unlinking it).
    const lang = String(language).toLowerCase().trim();
    if (!SUPPORTED_LANGUAGES.has(lang)) {
        return res.status(400).json({ success: false, error: "Unsupported language." });
    }
    if (typeof code !== 'string' || code.length > 200000) {
        return res.status(400).json({ success: false, error: "Invalid or oversized code payload." });
    }
    if (!isHostCodeExecEnabled()) {
        return res.status(503).json({ success: false, error: "Code execution disabled (ALLOW_HOST_CODE_EXEC)." });
    }

    logger.info(`[Interpreter] Executing ${lang} code block (${code.length} bytes)...`);

    const isPy = ['python', 'py', 'python3'].includes(lang);
    const isSh = ['sh', 'bash', 'shell', 'zsh', 'powershell', 'ps1'].includes(lang);
    const extension = isPy ? 'py' : isSh ? (process.platform === 'win32' ? 'ps1' : 'sh') : 'js';
    const fileName = `interpreter_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${extension}`;
    const filePath = path.join(os.tmpdir(), fileName);

    try {
        await fs.writeFile(filePath, code, 'utf-8');

        // execFile with argv array — filePath is internal (no shell parsing)
        const bin = isPy ? 'python' : isSh ? (process.platform === 'win32' ? 'powershell' : 'bash') : 'node';
        const args = isSh && process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass', '-File', filePath] : [filePath];
        execFile(bin, args, { timeout: 10000 }, async (error, stdout, stderr) => {
            // Clean up the temp file on every completion path
            try { await fs.unlink(filePath); } catch (e) { /* ignore */ }

            if (error) {
                logger.warn(`[Interpreter] Execution error: ${error.message}`);
                return res.json({ success: false, output: stdout, error: stderr || error.message });
            }

            logger.info(`[Interpreter] Execution successful.`);
            res.json({
                success: true,
                output: stdout,
                error: stderr
            });
        });

    } catch (e) {
        logger.error(`[Interpreter] API Error: ${e.message}`);
        try { await fs.unlink(filePath); } catch (_) { /* ignore */ }
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: e.message });
        }
    }
});

module.exports = router;
