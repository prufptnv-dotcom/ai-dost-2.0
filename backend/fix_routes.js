const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const replacement = `// ── Project Memory endpoints (SQLite-backed) ──────────────────────────
app.get(['/api/v1/memory/projects', '/api/projects'], (req, res) => {
    const userId = projectAuth.resolveUser(req);
    const projectDao = new ProjectDAO(db);
    const rows = projectDao.list(userId === 'local-user' ? null : userId);
    res.json(rows.map(r => ({
        project_id: r.id,
        project_name: r.name,
        description: r.description || '',
        created_at: r.created_at,
        status: r.status || 'Active'
    })));
});

app.post(['/api/v1/memory/project', '/api/memory/project', '/api/project'], (req, res) => {
    const userId = projectAuth.resolveUser(req);
    const { project_name, description } = req.body || {};
    const id = (req.body && req.body.project_id) || 'proj_' + Date.now();

    const projectDao = new ProjectDAO(db);
    const existing = projectDao.getById(id);
    if (existing) {
        if (!projectAuth.verifyOwnership(existing, userId)) {
            return res.status(403).json({ success: false, error: \`Access denied: You do not have permission to access project '\${id}'\` });
        }
        return res.json({
            project_id: existing.id,
            project_name: existing.name,
            description: existing.description || '',
            created_at: existing.created_at,
            status: existing.status || 'Active'
        });
    }

    const { project } = workspaceManager.ensureWorkspaceSync(id, userId, {
        description: description || 'Interactive AI Copilot Workspace'
    });
    if (project_name) {
        projectDao.update(id, { name: project_name, description: description || 'Interactive AI Copilot Workspace' }, userId);
    }

    const updated = projectDao.getById(id);
    res.json({
        project_id: updated.id,
        project_name: updated.name,
        description: updated.description || '',
        created_at: updated.created_at,
        status: updated.status || 'Active'
    });
});

app.delete(['/api/v1/memory/project/:id', '/api/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    if (id.startsWith('proj_demo_')) return res.status(400).json({ error: 'Demo projects cannot be deleted' });

    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const projectDao = new ProjectDAO(db);
    projectDao.delete(id, auth.user.id);
    res.json({ success: true, message: 'Project deleted' });
});

app.get(['/api/v1/memory/project/:id', '/api/memory/project/:id', '/api/project/:id'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req, { autoCreateIfMissing: true });
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const row = auth.project;
    const files = getProjectFiles(id);
    const fileArr = Object.keys(files).map(p => ({ path: p, content: files[p] }));
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
    const auth = projectAuth.authorize(id, req, { autoCreateIfMissing: true });
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const folderPath = (req.body && (req.body.path || req.body.folder_path || req.body.name)) || null;
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    const ok = createProjectFolder(id, folderPath);
    if (!ok) return res.status(400).json({ error: 'folder create nahi hua (invalid path?)' });
    res.json({ success: true, message: 'Folder created' });
});

app.post(['/api/v1/memory/project/:id/rename', '/api/memory/project/:id/rename', '/api/project/:id/rename'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const oldPath = String(req.body && (req.body.oldPath || req.body.old_path || req.body.path) || '').replace(/^\\/+||\\/+$/g, '');
    const newPath = String(req.body && (req.body.newPath || req.body.new_path) || '').replace(/^\\/+||\\/+$/g, '');
    if (!oldPath || !newPath || oldPath === newPath) return res.status(400).json({ error: 'oldPath + newPath required' });
    if (oldPath.includes('..') || newPath.includes('..')) return res.status(400).json({ error: 'invalid path' });
    
    try {
      const fullOld = workspaceManager.resolvePath(id, oldPath);
      const fullNew = workspaceManager.resolvePath(id, newPath);
      if (fs.existsSync(fullOld)) {
        fs.mkdirSync(path.dirname(fullNew), { recursive: true });
        fs.renameSync(fullOld, fullNew);
      }
    } catch (e) { logger.warn('[Server] disk rename failed:', e.message || e); }

    try {
      const rows = db.prepare('SELECT path FROM workspace_files WHERE project_id = ?').all(id);
      const upd = db.prepare('UPDATE workspace_files SET path = ? WHERE project_id = ? AND path = ?');
      for (const r of rows) {
        if (r.path === oldPath) upd.run(newPath, id, r.path);
        else if (r.path.startsWith(oldPath + '/')) upd.run(newPath + r.path.slice(oldPath.length), id, r.path);
      }
    } catch (e) { logger.warn('[Server] DB rename failed', e); }
    res.json({ success: true, message: 'Renamed' });
});

app.delete(['/api/v1/memory/project/:id/folder', '/api/memory/project/:id/folder', '/api/project/:id/folder'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const folderPath = String((req.query && (req.query.path || req.query.folder_path)) || (req.body && (req.body.path || req.body.folder_path)) || '').replace(/^\\/+||\\/+$/g, '');
    if (!folderPath) return res.status(400).json({ error: 'path is required' });
    if (folderPath.includes('..')) return res.status(400).json({ error: 'invalid path' });

    try {
      const full = workspaceManager.resolvePath(id, folderPath);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    } catch (e) { logger.warn('[Server] disk rm failed:', e.message || e); }
    
    try {
      db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND (path = ? OR path LIKE ?)').run(id, folderPath, folderPath + '/%');
    } catch(e){}
    res.json({ success: true, message: 'Folder deleted' });
});

app.post(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req, { autoCreateIfMissing: true });
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File saved successfully' });
});

app.put(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const filePath = (req.body && (req.body.path || req.body.file_path)) || null;
    const content = (req.body && req.body.content) || '';
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    saveProjectFile(id, filePath, content);
    res.json({ success: true, message: 'File updated successfully' });
});

app.delete(['/api/v1/memory/project/:id/file', '/api/memory/project/:id/file', '/api/project/:id/file'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const filePath = String((req.query && (req.query.path || req.query.file_path)) || (req.body && (req.body.path || req.body.file_path)) || '');
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    
    try {
      const fullPath = workspaceManager.resolvePath(id, filePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch(e) {}
    
    try {
      db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND path = ?').run(id, filePath);
    } catch(e) {}
    res.json({ success: true, message: 'File deleted successfully' });
});

// Find in Files — line-based search across a project's physical workspace (Ctrl+Shift+F)
app.get(['/api/v1/memory/project/:id/search', '/api/project/:id/search'], (req, res) => {
    const { id } = req.params;
    const auth = projectAuth.authorize(id, req);
    if (!auth.authorized) {
        return res.status(auth.status).json({ success: false, error: auth.error });
    }

    const q = String(req.query.q || '').trim();
    const caseSensitive = req.query.case === '1' || req.query.case === 'true';
    if (!q) return res.json({ query: '', results: [] });
    try {
        const wsRoot = workspaceManager.getWorkspacePath(id);
        const needle = caseSensitive ? q : q.toLowerCase();
        const results = [];
        let total = 0;
        
        function searchDir(dir, base) {
            if (!fs.existsSync(dir)) return;
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name === 'node_modules' || entry.name === '.git') continue;
                const full = path.join(dir, entry.name);
                const rel = base ? base + '/' + entry.name : entry.name;
                if (entry.isDirectory()) {
                    searchDir(full, rel);
                } else {
                    try {
                        const content = fs.readFileSync(full, 'utf8');
                        const lines = content.split('\\n');
                        for (let i = 0; i < lines.length; i++) {
                            const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
                            if (hay.includes(needle)) {
                                results.push({ path: rel, line: i + 1, text: String(lines[i]).slice(0, 300) });
                                total++;
                                if (total >= 500) return;
                            }
                        }
                    } catch(e) {}
                }
                if (total >= 500) return;
            }
        }
        
        searchDir(wsRoot, '');
        res.json({ query: q, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Chat history persistence endpoints (delegated to ConversationDAO / MessageDAO with legacy fallback)
function getChatHistory(req, res) {
    const sessionId = req.query.session_id || 'default';
    const userId = projectAuth.resolveUser(req);
    const conversationDao = new ConversationDAO(db);
    const messageDao = new MessageDAO(db);

    const conv = conversationDao.getById(sessionId);
    if (conv && conv.user_id && conv.user_id !== userId && userId !== 'local-user') {
        return res.status(403).json({ success: false, error: \`Access denied: You do not own conversation '\${sessionId}'\` });
    }

    if (conv) {
        const msgs = messageDao.listByConversation(sessionId);
        if (msgs && msgs.length > 0) {
            return res.json({
                success: true,
                session_id: sessionId,
                messages: msgs.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.created_at
                }))
            });
        }
    }

    // Legacy fallback
    const rows = db.prepare('SELECT id, role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC').all(sessionId);
    res.json({ success: true, session_id: sessionId, messages: rows });
}

function deleteChatHistory(req, res) {
    const sessionId = req.query.session_id || 'default';
    const userId = projectAuth.resolveUser(req);
    const conversationDao = new ConversationDAO(db);

    const conv = conversationDao.getById(sessionId);
    if (conv && conv.user_id && conv.user_id !== userId && userId !== 'local-user') {
        return res.status(403).json({ success: false, error: \`Access denied: You do not own conversation '\${sessionId}'\` });
    }

    if (conv) {
        conversationDao.delete(sessionId);
    }
    db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sessionId);
    res.json({ success: true, message: 'History cleared' });
}

function saveChatHistory(req, res) {
    const { session_id, messages, project_id } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
    const sid = session_id || 'default';
    const projId = project_id || 'default';
    const userId = projectAuth.resolveUser(req);

    const conversationDao = new ConversationDAO(db);
    const messageDao = new MessageDAO(db);

    // Verify ownership if conversation exists
    let conv = conversationDao.getById(sid);
    if (conv && conv.user_id && conv.user_id !== userId && userId !== 'local-user') {
        return res.status(403).json({ success: false, error: \`Access denied: You do not own conversation '\${sid}'\` });
    }

    // Upsert conversation record
    if (!conv) {
        workspaceManager.ensureWorkspaceSync(projId, userId);
        conv = conversationDao.create({
            id: sid,
            projectId: projId,
            userId,
            title: messages[0]?.content ? String(messages[0].content).slice(0, 40) : 'Chat Session',
            surface: 'chat'
        });
    }

    // Clean previous messages in universal DB and legacy chat_history
    messageDao.deleteByConversation(sid);
    const del = db.prepare('DELETE FROM chat_history WHERE session_id = ?').run(sid);

    const ins = db.prepare('INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)');
    const tx = db.transaction((msgs) => {
        for (let i = 0; i < msgs.length; i++) {
            const m = msgs[i];
            if (m && m.role && typeof m.content === 'string') {
                ins.run(sid, m.role, m.content);
                messageDao.create({
                    conversationId: sid,
                    role: m.role,
                    content: m.content
                });
            }
        }
    });
    tx(messages);
    res.json({ success: true, saved: messages.length, cleared: del.changes });
}

app.get(['/api/v1/chat/history', '/api/chat/history'], getChatHistory);
app.delete(['/api/v1/chat/history', '/api/chat/history'], deleteChatHistory);
app.post(['/api/v1/chat/save', '/api/chat/save'], saveChatHistory);

// ── Legacy Resume API (scheduled for Phase 1.4 DAO migration) ───────────
app.post('/api/v1/resume/save', (req, res) => {
    const { prompt, jsonData } = req.body;
    if (!jsonData) return res.status(400).json({ error: 'jsonData is required' });
    try {
        const stmt = db.prepare('INSERT INTO resumes (prompt, json_data) VALUES (?, ?)');
        const info = stmt.run(prompt || '', JSON.stringify(jsonData));
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/v1/resume/history', (req, res) => {
    try {
        const rows = db.prepare('SELECT id, prompt, created_at FROM resumes ORDER BY id DESC LIMIT 50').all();
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/v1/resume/:id', (req, res) => {
    try {
        const row = db.prepare('SELECT * FROM resumes WHERE id = ?').get(req.params.id);
        if (!row) return res.status(404).json({ error: 'Resume not found' });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fallback error handler
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: err.message || 'Malformed request body', code: 'BAD_BODY' });
    }

    const { toAppError } = require('./utils/errors');
    const normalized = toAppError(err);
    logger.error(\`[\${req.method} \${req.originalUrl}] \${normalized.code}: \${normalized.message}\`);
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

// Sandbox WS
const { attachSandboxWs } = require('./sandbox/wsServer');
attachSandboxWs(server);

// Terminal WS
const { setupTerminalSocket } = require('./sockets/terminalWs');
setupTerminalSocket(server);

server.listen(PORT, '0.0.0.0', () => {
    logger.info(\`[Server] Backend API running on http://0.0.0.0:\${PORT}\`);
    logger.info(\`[Server] Sandbox endpoints enabled (Docker required)\`);
});
`;

let startIndex = content.indexOf('// ── Project Memory endpoints');
if (startIndex !== -1) {
  content = content.slice(0, startIndex) + replacement;
  fs.writeFileSync('server.js', content);
  console.log('Fixed');
} else {
  console.error('Marker not found');
}

