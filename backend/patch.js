const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const origHelpersRegex = /\/\/ Helper: save a project file to SQLite[\s\S]+?return acc;\r?\n  \}, \{\}\);\r?\n\}/;
const newHelpers = `// Helper: save a project file to SQLite (and physical workspace)
function saveProjectFile(projectId, filePath, content) {
  try {
    const fullPath = workspaceManager.resolvePath(projectId, filePath);
    fs.mkdirSync(require('path').dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');

    const existing = db.prepare('SELECT id FROM workspace_files WHERE project_id = ? AND path = ?').get(projectId, filePath);
    if (existing) {
      db.prepare('UPDATE workspace_files SET content = ?, last_modified = datetime(\\'now\\') WHERE id = ?')
        .run(content, existing.id);
    } else {
      db.prepare('INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)')
        .run(projectId, filePath, content);
    }
    return true;
  } catch (e) {
    logger.error('[Server] saveProjectFile failed:', e.message || e);
    return false;
  }
}

// Helper: create a folder in the agent workspace + persist a .gitkeep marker so the UI tree sees it
function createProjectFolder(projectId, folderPath) {
  const safe = String(folderPath || '').replace(/^\\/+||\\/+$/g, '');
  if (!safe || safe.includes('..')) return false;
  try {
    const dir = workspaceManager.resolvePath(projectId, safe);
    fs.mkdirSync(dir, { recursive: true });
    saveProjectFile(projectId, \`\${safe}/.gitkeep\`, '');
    return true;
  } catch (e) {
    logger.error('[Server] mkdir failed:', e.message || e);
    return false;
  }
}

// Helper: get all files for a project
function getProjectFiles(projectId) {
  try {
    const wsRoot = workspaceManager.getWorkspacePath(projectId);
    if (!fs.existsSync(wsRoot)) return {};
    const result = {};
    
    function walk(dir, base) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = require('path').join(dir, entry.name);
        const rel = base ? \`\${base}/\${entry.name}\` : entry.name;
        if (entry.isDirectory()) {
          walk(full, rel);
        } else {
          result[rel] = fs.readFileSync(full, 'utf8');
        }
      }
    }
    walk(wsRoot, '');
    return result;
  } catch (e) {
    logger.warn(\`[Server] getProjectFiles physical read failed for \${projectId}, falling back to legacy DB.\`, e);
    const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
    return rows.reduce((acc, { path, content }) => {
      acc[path] = content || '';
      return acc;
    }, {});
  }
}`;

content = content.replace(origHelpersRegex, newHelpers);

const origEndpointsRegex = /\/\/ ── Project Memory endpoints \(SQLite-backed\) ──────────────────────────[\s\S]+?(?=\/\/ Chat history persistence endpoints)/;
const newEndpoints = `// ── Project Memory endpoints (SQLite-backed) ──────────────────────────
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
        fs.mkdirSync(require('path').dirname(fullNew), { recursive: true });
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
                const full = require('path').join(dir, entry.name);
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

`;
content = content.replace(origEndpointsRegex, newEndpoints);

const origChatRegex = /\/\/ Chat history persistence endpoints[\s\S]+?(?=\/\/ Root redirect to frontend)/;
const newChat = `// Chat history persistence endpoints (delegated to ConversationDAO / MessageDAO with legacy fallback)
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

app.get('/api/chat/history', getChatHistory);
app.get('/api/v1/chat/history', getChatHistory);
app.delete('/api/chat/history', deleteChatHistory);
app.delete('/api/v1/chat/history', deleteChatHistory);
app.post('/api/chat/save', saveChatHistory);
app.post('/api/v1/chat/save', saveChatHistory);

`;
content = content.replace(origChatRegex, newChat);

const reqs = `const projectAuth = require('./services/projectAuthorization');
const workspaceManager = require('./services/workspaceManager');
const ProjectDAO = require('./db/ProjectDAO');
const ConversationDAO = require('./db/ConversationDAO');
const MessageDAO = require('./db/MessageDAO');\n`;

if (!content.includes('const projectAuth')) {
    content = content.replace("const express = require('express');", "const express = require('express');\n" + reqs);
}

fs.writeFileSync('server.js', content);
console.log('Patch complete.');
