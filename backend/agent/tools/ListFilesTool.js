const fs = require('fs');
const path = require('path');
const Tool = require('../runtime/Tool');

class ListFilesTool extends Tool {
  constructor() {
    super({
      name: 'list_directory',
      description: 'Lists files in the workspace.',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      permissions: ['filesystem.read']
    });
  }

  async execute(context, input) {
    this.validateInput(input);
    const targetDir = input?.path || '.';
    
    // 1. Validate boundary via workspaceManager
    const resolvedPath = context.workspaceManager.resolvePath(context.projectId, targetDir, context.userId);
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${targetDir}`);
    }

    try {
      const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
      const files = [];
      const EXCLUDES = ['node_modules', '.git', '.checkpoints'];
      
      for (const entry of entries) {
        if (EXCLUDES.includes(entry.name)) continue;
        
        if (entry.isDirectory()) {
          files.push(`${entry.name}/`);
          // Lightweight shallow traversal (matches original behavior)
          try {
            const subEntries = fs.readdirSync(path.join(resolvedPath, entry.name), { withFileTypes: true });
            for (const sub of subEntries.slice(0, 10)) { // limit to prevent unbounded traversal
              if (!EXCLUDES.includes(sub.name)) {
                files.push(`${entry.name}/${sub.name}${sub.isDirectory() ? '/' : ''}`);
              }
            }
          } catch (_) {}
        } else {
          files.push(entry.name);
        }
      }
      return { 
        success: true, 
        files,
        metadata: { path: targetDir || '/', count: files.length }
      };
    } catch (e) {
      throw new Error(`Failed to list directory: ${e.message}`);
    }
  }
}

module.exports = ListFilesTool;


