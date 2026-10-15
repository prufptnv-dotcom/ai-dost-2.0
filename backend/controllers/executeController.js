const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec: runChildExec } = require('child_process');

exports.handleExecute = async (req, res) => {
    const { code, language } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'code is required' });
    }

    const lang = (language || 'javascript').toLowerCase();
    const startTime = Date.now();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aidost-chat-exec-'));
    
    let filePath;
    let execCmd;

    if (lang === 'python' || lang === 'py') {
        filePath = path.join(tempDir, 'script.py');
        fs.writeFileSync(filePath, code, 'utf-8');
        execCmd = `python "${filePath}"`;
    } else if (lang === 'javascript' || lang === 'js' || lang === 'node') {
        filePath = path.join(tempDir, 'script.js');
        fs.writeFileSync(filePath, code, 'utf-8');
        execCmd = `node "${filePath}"`;
    } else {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
        return res.json({
            success: false,
            error: `Execution for '${lang}' is not supported directly in chat. Use Copilot IDE for full-stack environments.`,
            duration: Date.now() - startTime
        });
    }

    runChildExec(execCmd, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        const duration = Date.now() - startTime;
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

        if (err && err.killed) {
            return res.json({
                success: false,
                error: 'Execution timed out (10s limit exceeded)',
                stdout: stdout || '',
                stderr: stderr || '',
                exitCode: 124,
                duration
            });
        }

        let cleanStderr = stderr || (err ? err.message : '');
        if (cleanStderr && (cleanStderr.includes('document is not defined') || cleanStderr.includes('window is not defined') || cleanStderr.includes('HTMLElement is not defined'))) {
            cleanStderr += '\n💡 Note: This snippet relies on browser DOM/Canvas APIs. Click "Open as Live Browser Animation" to run and view it interactively in real time.';
        }

        res.json({
            success: !err,
            stdout: stdout || '',
            stderr: cleanStderr,
            exitCode: err ? (err.code || 1) : 0,
            duration
        });
    });
};
