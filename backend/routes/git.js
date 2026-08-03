const express = require('express');
const logger = require('../logger');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKSPACE_DIR = path.join(__dirname, '../../');

function runGitCommand(cmd, cwd = WORKSPACE_DIR) {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: stderr || error.message, stdout: stdout || '' });
            } else {
                resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
            }
        });
    });
}

// 1. Initialize Local Git Repo
router.post('/init', async (req, res) => {
    try {
        const checkGit = await runGitCommand('git status');
        if (checkGit.success) {
            return res.json({ success: true, message: 'Git repository is already initialized locally.' });
        }
        const initResult = await runGitCommand('git init');
        res.json(initResult);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Create Local Git Commit Snapshot
router.post('/commit', async (req, res) => {
    try {
        const { message } = req.body;
        const commitMsg = (message || 'Local AI-Dost Snapshot')
            .replace(/"/g, '\\"')
            .replace(/[`$\\]/g, '');
        
        // Stage all files
        await runGitCommand('git add .');
        
        // Create local commit
        const result = await runGitCommand(`git commit -m "${commitMsg}"`);
        
        if (!result.success && result.error.includes('nothing to commit')) {
            return res.json({ success: true, message: 'No file changes to commit. Local workspace is clean.' });
        }

        res.json({
            success: result.success,
            message: result.success ? `Local Git commit created: "${commitMsg}"` : result.error,
            details: result.stdout
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 3. Get Local Commit History Log
router.get('/log', async (req, res) => {
    try {
        const result = await runGitCommand('git log --pretty=format:"%h|%an|%ar|%s" -n 20');
        if (!result.success) {
            return res.json({ success: true, commits: [] });
        }

        const commits = result.stdout.split('\n').filter(Boolean).map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
        });

        res.json({ success: true, commits });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Local Commit Checkout / Rollback
router.post('/checkout', async (req, res) => {
    try {
        const { hash } = req.body;
        if (!hash || typeof hash !== 'string') {
            return res.status(400).json({ success: false, error: 'Commit hash is required' });
        }
        const safeHash = hash.replace(/[^a-zA-Z0-9._-]/g, '');

        const result = await runGitCommand(`git checkout ${safeHash}`);
        res.json({
            success: result.success,
            message: result.success ? `Restored workspace to local commit [${safeHash}]` : result.error
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
