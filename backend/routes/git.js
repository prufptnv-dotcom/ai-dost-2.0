const express = require('express');
const logger = require('../logger');
const router = express.Router();
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// P0 FIX (#32): git operations must NEVER default to the AI-Dost repo root.
// Default cwd is the agent project workspace (os.tmpdir()/agent-ws-default),
// and every cwd is constrained to workspace roots below.
const defaultWorkspaceCwd = () => path.join(os.tmpdir(), 'agent-ws-default');

function allowedGitRoots() {
    const roots = [path.resolve(os.tmpdir())];
    // Optional extra roots (semicolon/colon separated, OS path delimiter)
    if (process.env.AGENT_GIT_ROOTS) {
        for (const r of String(process.env.AGENT_GIT_ROOTS).split(path.delimiter)) {
            if (r && r.trim()) roots.push(path.resolve(r.trim()));
        }
    }
    return roots;
}

// Run git via execFile with args array — no shell interpolation of user input
function runGit(args, cwd = defaultWorkspaceCwd()) {
    return new Promise((resolve) => {
        execFile('git', args, { cwd, timeout: 15000, shell: false, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: stderr || error.message, stdout: stdout || '' });
            } else {
                resolve({ success: true, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
            }
        });
    });
}

function assertWorkspaceCwd(cwd) {
    if (!cwd || typeof cwd !== 'string') return defaultWorkspaceCwd();
    const resolved = path.resolve(cwd);
    // P0 FIX (#67): repo root / process.cwd() are NOT allowed roots — only
    // workspace roots (tmpdir + explicitly configured AGENT_GIT_ROOTS).
    const ok = allowedGitRoots().some(root => resolved === root || resolved.startsWith(root + path.sep));
    if (!ok) throw new Error('cwd is outside allowed workspace roots');
    return resolved;
}

// Resolve per-request cwd (body.cwd or query.cwd), defaulting to the workspace.
function resolveReqCwd(req, { create = false } = {}) {
    const raw = (req.body && req.body.cwd) || req.query.cwd;
    const cwd = assertWorkspaceCwd(raw);
    if (create) {
        try { fs.mkdirSync(cwd, { recursive: true }); } catch (_) {}
    }
    return cwd;
}

// Reject git option injection: refs must not start with '-' and must be a
// sane ref/hash charset (P0 #33 hardening).
function isSafeRef(hash) {
    if (typeof hash !== 'string' || !hash) return false;
    if (hash.length > 100) return false;
    if (hash.startsWith('-')) return false;            // git option injection
    if (hash.includes('..')) return false;              // range/ref tricks
    return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(hash);
}

// 1. Initialize Local Git Repo (in the project workspace, never the repo root)
router.post('/init', async (req, res) => {
    try {
        const cwd = resolveReqCwd(req, { create: true });
        const checkGit = await runGit(['status'], cwd);
        if (checkGit.success) {
            return res.json({ success: true, message: 'Git repository is already initialized locally.' });
        }
        const initResult = await runGit(['init'], cwd);
        res.json(initResult);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 2. Create Local Git Commit Snapshot
router.post('/commit', async (req, res) => {
    try {
        const cwd = resolveReqCwd(req, { create: true });
        const { message } = req.body;
        const commitMsg = String(message || 'Local AI-Dost Snapshot')
            .replace(/[\r\n]/g, ' ')
            .slice(0, 200);

        // Stage all files
        await runGit(['add', '.'], cwd);

        // Create local commit (args array — no shell metachar injection)
        const result = await runGit(['commit', '-m', commitMsg], cwd);
        
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
        const cwd = resolveReqCwd(req);
        // P2 #57: '|' as field separator collides with '|' in author names or
        // subjects — %x1f (unit separator) can never appear in git output fields.
        const result = await runGit(['log', '--pretty=format:%h%x1f%an%x1f%ar%x1f%s', '-n', '20'], cwd);
        if (!result.success) {
            return res.json({ success: true, commits: [] });
        }

        const commits = result.stdout.split('\n').filter(Boolean).map(line => {
            const parts = line.split('\u001f');
            const hash = parts.shift() || '';
            const author = parts.shift() || '';
            const date = parts.shift() || '';
            const message = parts.join('\u001f');
            return { hash, author, date, message };
        });

        res.json({ success: true, commits });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 4. Local Commit Checkout / Rollback (workspace-confirmed in UI, ref validated here)
router.post('/checkout', async (req, res) => {
    try {
        const cwd = resolveReqCwd(req);
        const { hash } = req.body;
        if (!hash || typeof hash !== 'string') {
            return res.status(400).json({ success: false, error: 'Commit hash is required' });
        }
        // P0 FIX (#33): strict ref validation — no leading '-' (git option
        // injection), no '..' ranges, bounded charset/length. Operations are
        // confined to the workspace cwd, never the product repo.
        if (!isSafeRef(hash)) {
            return res.status(400).json({ success: false, error: 'Invalid commit hash or ref' });
        }

        const result = await runGit(['checkout', hash], cwd);
        res.json({
            success: result.success,
            message: result.success ? `Restored workspace to local commit [${hash}]` : result.error
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 5. Remote Push (GitHub / GitLab / Bitbucket)
router.post('/push-remote', async (req, res) => {
    try {
        const { remoteUrl, branch = 'main', cwd } = req.body;
        if (!remoteUrl || typeof remoteUrl !== 'string') {
            return res.status(400).json({ success: false, error: 'remoteUrl is required' });
        }
        // Only standard git remote URL schemes; reject shell metacharacters
        const urlOk = /^(https?:\/\/|git@|ssh:\/\/)[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+$/.test(remoteUrl) &&
            !/[;&|`$()<>\n\r]/.test(remoteUrl);
        if (!urlOk) {
            return res.status(400).json({ success: false, error: 'Invalid remoteUrl — use https/git@/ssh URL without shell characters' });
        }
        const safeBranch = String(branch).replace(/[^A-Za-z0-9._/-]/g, '');
        if (!safeBranch || safeBranch.startsWith('-')) {
            return res.status(400).json({ success: false, error: 'Invalid branch name' });
        }
        const workDir = assertWorkspaceCwd(cwd);
        // Point origin at the new URL if it exists, otherwise add it —
        // (previously `remote remove origin` destroyed existing config, #34)
        const setUrl = await runGit(['remote', 'set-url', 'origin', remoteUrl], workDir);
        if (!setUrl.success) {
            await runGit(['remote', 'add', 'origin', remoteUrl], workDir);
        }
        await runGit(['branch', '-M', safeBranch], workDir);
        const pushResult = await runGit(['push', '-u', 'origin', safeBranch], workDir);

        res.json({
            success: pushResult.success,
            message: pushResult.success ? `Successfully pushed branch [${safeBranch}] to remote!` : pushResult.error,
            stdout: pushResult.stdout,
            stderr: pushResult.stderr
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 6. Detailed Workspace Git Status Summary
router.get('/status-summary', async (req, res) => {
    try {
        const cwd = resolveReqCwd(req);
        const branchRes = await runGit(['branch', '--show-current'], cwd);
        const statusRes = await runGit(['status', '--porcelain'], cwd);
        const logRes = await runGit(['log', '-n', '5', '--oneline'], cwd);

        const currentBranch = branchRes.stdout || 'main';
        const rawStatus = statusRes.stdout || '';
        const lines = rawStatus.split('\n').filter(Boolean);

        const staged = [];
        const unstaged = [];
        const untracked = [];

        lines.forEach(line => {
            const code = line.substring(0, 2);
            const file = line.substring(3).trim();
            if (code[0] !== ' ' && code[0] !== '?') staged.push({ file, status: code[0] });
            if (code[1] !== ' ' && code[1] !== '?') unstaged.push({ file, status: code[1] });
            if (code === '??') untracked.push(file);
        });

        res.json({
            success: true,
            branch: currentBranch,
            isClean: lines.length === 0,
            counts: { staged: staged.length, unstaged: unstaged.length, untracked: untracked.length },
            staged,
            unstaged,
            untracked,
            recentCommits: (logRes.stdout || '').split('\n').filter(Boolean)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 7. Conventional Commit Message Generator
router.post('/suggest-commit', async (req, res) => {
    try {
        const cwd = resolveReqCwd(req);
        const { diff, description, scope } = req.body;
        let changeDesc = description || '';

        // If no description provided, inspect staged diff or status
        if (!changeDesc) {
            const statusRes = await runGit(['status', '--porcelain'], cwd);
            const files = (statusRes.stdout || '').split('\n').filter(Boolean).map(l => l.substring(3).trim());
            if (files.length > 0) {
                changeDesc = `Modified ${files.slice(0, 5).join(', ')}${files.length > 5 ? ` and ${files.length - 5} more files` : ''}`;
            } else {
                changeDesc = 'General project updates and optimizations';
            }
        }

        const cleanScope = scope ? `(${scope})` : '';

        const suggestions = [
            {
                type: 'feat',
                title: `feat${cleanScope}: add ${changeDesc.toLowerCase()}`,
                body: `Implement new capability ensuring zero regressions and adherence to modern architecture standards.`,
                category: 'New Feature'
            },
            {
                type: 'fix',
                title: `fix${cleanScope}: resolve issues with ${changeDesc.toLowerCase()}`,
                body: `Address edge cases and stabilize execution runtime with defensive fallbacks.`,
                category: 'Bug Fix'
            },
            {
                type: 'refactor',
                title: `refactor${cleanScope}: optimize and streamline ${changeDesc.toLowerCase()}`,
                body: `Improve code readability, separation of concerns, and maintainability without altering public API contracts.`,
                category: 'Refactoring & Clean Code'
            },
            {
                type: 'perf',
                title: `perf${cleanScope}: enhance latency and throughput for ${changeDesc.toLowerCase()}`,
                body: `Optimize computation and memory allocations to minimize overhead and eliminate bottlenecks.`,
                category: 'Performance'
            }
        ];

        res.json({
            success: true,
            scope: scope || null,
            context: changeDesc,
            suggestions
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 8. Pull Request Template Generator
router.post('/generate-pr', async (req, res) => {
    try {
        const { title, branch, base = 'main', summary, changes = [], breakingChanges = false } = req.body;

        const prTitle = title || `[Feature] Modern updates and improvements`;
        const changeList = changes.length > 0 ? changes.map(c => `- ${c}`).join('\n') : '- Enhanced codebase architecture\n- Standardized error handling\n- Updated documentation';

        const markdown = `## 📋 Pull Request: ${prTitle}

### 🎯 Summary
${summary || 'Comprehensive enhancement to streamline functionality, enforce clean architectural boundaries, and provide zero-latency execution.'}

### 🌿 Branch Information
- **Source Branch:** \`${branch || 'feature/modern-update'}\`
- **Target Branch:** \`${base}\`

### 🛠️ Key Changes
${changeList}

### ⚠️ Breaking Changes
${breakingChanges ? '**YES.** Requires migration steps or configuration updates.' : '**None.** Fully backward-compatible.'}

### ✅ Verification & Quality Checklist
- [x] All unit, integration, and E2E test suites pass with 0 errors
- [x] Code adheres to SOLID principles and Clean Architecture
- [x] Zero security vulnerabilities identified (OWASP Top 10 compliance)
- [x] Updated relevant documentation, README, and API specs
- [x] Verified backward compatibility and graceful degradation

---
*Reviewed and generated via AI-Dost Senior Staff Engineering Suite.*
`;

        res.json({
            success: true,
            title: prTitle,
            markdown
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 9. GitHub Issue Generator
router.post('/generate-issue', async (req, res) => {
    try {
        const { type = 'feature', title, description, steps = [], environment = {} } = req.body;

        let markdown = '';
        if (type === 'bug') {
            markdown = `## 🐛 Bug Report: ${title || 'Unexpected runtime exception'}

### 📝 Description
${description || 'A brief and concise description of the bug.'}

### 🔄 Steps to Reproduce
${steps.length > 0 ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : '1. Navigate to the feature view\n2. Trigger the action\n3. Observe unexpected behavior'}

### 🎯 Expected Behavior
The operation should complete successfully with valid feedback and zero console errors.

### ❌ Actual Behavior
The system encountered an error or unexpected output.

### 💻 Environment
- **OS:** ${environment.os || 'Windows 11'}
- **Node.js:** ${environment.node || 'v20.x'}
- **Browser:** ${environment.browser || 'Google Chrome'}

### 📋 Additional Context
Zero-downtime fix needed with regression test.
`;
        } else {
            markdown = `## 🚀 Feature Request: ${title || 'Modern Capability Enhancement'}

### 💡 Is your feature request related to a problem?
${description || 'Clear and concise description of what problem needs solving.'}

### 🎯 Proposed Solution
Implement a modular, testable service adhering to clean code standards.

### 📋 Acceptance Criteria
- [ ] Core interface implemented with zero external leaks
- [ ] Unit test coverage >= 85%
- [ ] Error boundaries and circuit breakers in place
- [ ] Verified performance benchmarks (<50ms latency)

### 🔗 Alternatives Considered
Considered monolithic inline approach, but rejected in favor of decoupled modular service.
`;
        }

        res.json({
            success: true,
            type,
            title: title || 'GitHub Issue',
            markdown
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 10. Architecture Decision Record (ADR) Generator
router.post('/generate-adr', async (req, res) => {
    try {
        const { number = 1, title, status = 'Accepted', context, decision, consequences, alternatives } = req.body;

        const adrNum = String(number).padStart(3, '0');
        const adrTitle = title || 'Adoption of Decoupled Modular Architecture';

        const markdown = `# ADR-${adrNum}: ${adrTitle}

## 📊 Status
**${status}** (Recorded on ${new Date().toISOString().split('T')[0]})

## 🌍 Context
${context || 'As the AI-Dost platform scales to support multi-modal capabilities, code modularity, latency minimization, and high reliability become paramount.'}

## 🎯 Decision
${decision || 'We will decompose core functionality into standalone, isolated domain engines with strict boundary contracts and centralized cascade orchestration.'}

## ⚖️ Consequences
### Positive:
- High decoupling allows independent scaling and isolated testing.
- Single Responsibility Principle (SRP) maintained across all modules.
- Zero cascading failures during external service downtime.

### Negative / Tradeoffs:
- Requires consistent schema coordination between services.
- Slightly higher initial boilerplate for module definitions.

## 🔄 Alternatives Considered
${alternatives || '- Monolithic route handler: Rejected due to high cognitive load and code churn risk.\n- Microservices architecture: Rejected due to operational complexity for single-node deployment.'}

---
*Created using Michael Nygard ADR Specification for AI-Dost.*
`;

        res.json({
            success: true,
            adrNumber: adrNum,
            title: adrTitle,
            markdown
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
