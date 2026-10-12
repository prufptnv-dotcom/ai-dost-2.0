const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '../backend/data/app.db');
const db = new DatabaseSync(dbPath);
const projectId = 'copilot-workspace';

const filesToSync = [
  'package.json',
  'index.html',
  'vite.config.js',
  'src/main.jsx',
  'src/index.css',
  'src/App.jsx',
  'src/components/ThreeHeroCanvas.jsx'
];

const workspaceDir = path.resolve(__dirname, '../copilot-workspace');

// Check unique constraint on workspace_files
const existing = db.prepare('SELECT id, path FROM workspace_files WHERE project_id = ?').all(projectId);
const existingMap = new Map(existing.map(row => [row.path, row.id]));

for (const rel of filesToSync) {
  const full = path.join(workspaceDir, rel);
  if (fs.existsSync(full)) {
    const content = fs.readFileSync(full, 'utf8');
    if (existingMap.has(rel)) {
      db.prepare("UPDATE workspace_files SET content = ?, last_modified = datetime('now') WHERE id = ?")
        .run(content, existingMap.get(rel));
      console.log('Updated in DB:', rel, 'size:', content.length);
    } else {
      db.prepare("INSERT INTO workspace_files (project_id, path, content, last_modified) VALUES (?, ?, ?, datetime('now'))")
        .run(projectId, rel, content);
      console.log('Inserted into DB:', rel, 'size:', content.length);
    }
  }
}

const check = db.prepare('SELECT path, length(content) as len FROM workspace_files WHERE project_id = ?').all(projectId);
console.log('Current DB files for copilot-workspace:', check);
