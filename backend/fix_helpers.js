const fs = require('fs');
const path = require('path');
let content = fs.readFileSync('server.js', 'utf8');

const target = `// Helper: save a project file to SQLite
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

const replacement = `// Helper: save a project file to SQLite (and physical workspace)
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

if (content.includes('// Helper: save a project file to SQLite\r\nfunction saveProjectFile')) {
    content = content.replace(target, replacement);
} else if (content.includes('// Helper: save a project file to SQLite\nfunction saveProjectFile')) {
    content = content.replace(target.replace(/\r/g, ''), replacement);
}

fs.writeFileSync('server.js', content);
console.log('Helpers fixed');
