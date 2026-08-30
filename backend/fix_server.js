const fs = require('fs');
const path = require('path');

let content = fs.readFileSync('server.js', 'utf8');

// 1. Refactor saveProjectFile, createProjectFolder, getProjectFiles
const target1 = `// Helper: save a project file to SQLite
function saveProjectFile(projectId, filePath, content) {
  const existing = db.prepare('SELECT id FROM workspace_files WHERE project_id = ? AND path = ?').get(projectId, filePath);
  if (existing) {
    db.prepare('UPDATE workspace_files SET content = ?, last_modified = datetime(\\'now\\') WHERE id = ?')
      .run(content, existing.id);
  } else {
    db.prepare('INSERT INTO workspace_files (project_id, path, content) VALUES (?, ?, ?)')
      .run(projectId, filePath, content);
  }
  return true;
}

// Helper: create a folder in the agent workspace + persist a .gitkeep marker so the UI tree sees it
function createProjectFolder(projectId, folderPath) {
  const safe = String(folderPath || '').replace(/^\\/+||\\/+$/g, '');
  if (!safe || safe.includes('..')) return false;
  try {
    const dir = path.join(os.tmpdir(), \`agent-ws-\${projectId}\`, safe);
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
  const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(projectId);
  return rows.reduce((acc, { path, content }) => {
    acc[path] = content || '';
    return acc;
  }, {});
}`;

const replacement1 = `// Helper: save a project file to SQLite (and physical workspace)
function saveProjectFile(projectId, filePath, content) {
  try {
    const fullPath = workspaceManager.resolvePath(projectId, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
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
        const full = path.join(dir, entry.name);
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

// 2. Refactor rename, folder delete, file create, update, delete, search
const target2 = `    // Disk: file ya folder dono ko rename
    const wsRoot = workspaceManager.getWorkspacePath(id);
    try {
      const oldFull = workspaceManager.resolvePath(id, oldPath);
      const newFull = path.resolve(wsRoot, newPath);
      if (fs.existsSync(oldFull)) {
        fs.mkdirSync(path.dirname(newFull), { recursive: true });
        fs.renameSync(oldFull, newFull);
      }
    } catch (e) { logger.warn('[Server] disk rename failed:', e.message || e); }

    // DB: file exact-match, folder = prefix move
    const rows = db.prepare('SELECT path FROM workspace_files WHERE project_id = ?').all(id);
    const upd = db.prepare('UPDATE workspace_files SET path = ? WHERE project_id = ? AND path = ?');
    for (const r of rows) {
      if (r.path === oldPath) upd.run(newPath, id, r.path);
      else if (r.path.startsWith(oldPath + '/')) upd.run(newPath + r.path.slice(oldPath.length), id, r.path);
    }
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

    // Disk: folder + contents remove
    try {
      const full = workspaceManager.resolvePath(id, folderPath);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    } catch (e) { logger.warn('[Server] disk rm failed:', e.message || e); }
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND (path = ? OR path LIKE ?)').run(id, folderPath, folderPath + '/%');
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

    const filePath = (req.query && (req.query.path || req.query.file_path)) || (req.body && (req.body.path || req.body.file_path));
    if (!filePath) return res.status(400).json({ error: 'path is required' });
    db.prepare('DELETE FROM workspace_files WHERE project_id = ? AND path = ?').run(id, filePath);
    res.json({ success: true, message: 'File deleted successfully' });
});

// Find in Files — line-based search across a project's workspace (Ctrl+Shift+F)
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
        const rows = db.prepare('SELECT path, content FROM workspace_files WHERE project_id = ?').all(id);
        const needle = caseSensitive ? q : q.toLowerCase();
        const results = [];
        let total = 0;
        for (const row of rows) {
            if (/node_modules|\\/\\.git\\//.test(row.path)) continue;
            const lines = String(row.content || '').split('\\n');
            for (let i = 0; i < lines.length; i++) {
                const hay = caseSensitive ? lines[i] : lines[i].toLowerCase();
                if (hay.includes(needle)) {
                    results.push({ path: row.path, line: i + 1, text: String(lines[i]).slice(0, 300) });
                    total++;
                    if (total >= 500) break;
                }
            }
            if (total >= 500) break;
        }
        res.json({ query: q, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});`;

const replacement2 = `    // Disk: file ya folder dono ko rename
    try {
      const fullOld = workspaceManager.resolvePath(id, oldPath);
      const fullNew = workspaceManager.resolvePath(id, newPath);
      if (fs.existsSync(fullOld)) {
        fs.mkdirSync(path.dirname(fullNew), { recursive: true });
        fs.renameSync(fullOld, fullNew);
      }
    } catch (e) { logger.warn('[Server] disk rename failed:', e.message || e); }

    // DB: file exact-match, folder = prefix move
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

    // Disk: folder + contents remove
    try {
      const full = workspaceManager.resolvePath(id, folderPath);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true });
    } catch (e) { logger.warn('[Server] disk rm failed:', e.message || e); }
    
    // DB remove
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
                const rel = base ? \`\${base}/\${entry.name}\` : entry.name;
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
});`;

if (content.includes('// Helper: save a project file to SQLite\r\nfunction saveProjectFile')) {
    content = content.replace(target1, replacement1);
} else if (content.includes('// Helper: save a project file to SQLite\nfunction saveProjectFile')) {
    // try removing cr
    content = content.replace(target1.replace(/\r/g, ''), replacement1);
}

if (content.includes('// Find in Files — line-based search across a project\'s workspace (Ctrl+Shift+F)')) {
    content = content.replace(target2, replacement2);
} else {
    content = content.replace(target2.replace(/\r/g, ''), replacement2);
}

fs.writeFileSync('server.js', content);
console.log('Fixed server.js');

