const fs = require('fs');
const Tool = require('../runtime/Tool');

class ReadFileTool extends Tool {
  constructor() {
    super({
      name: 'read_file',
      description: 'Reads the contents of a file from the workspace.',
      inputSchema: { type: 'object', required: ['path'], properties: { path: { type: 'string' } } },
      permissions: ['filesystem.read']
    });
  }

  async execute(context, input) {
    this.validateInput(input);
    const { path: relativePath } = input;
    
    // 1. Validate boundary via workspaceManager
    const resolvedPath = context.workspaceManager.resolvePath(context.projectId, relativePath, context.userId);
    
    // 2. Perform safe fs operation
    if (!fs.existsSync(resolvedPath)) {
      return { 
        success: false, 
        exists: false,
        content: '', 
        message: `File not found: ${relativePath}. The file does not exist yet.`
      };
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      // P12.6: models were INVENTING expectedSourceHash values ("existing",
      // truncated display hashes) because read_file never returned one. Give
      // them the real hash + a truncation flag so the apply_diff contract has
      // a legitimate source (truncated reads must NOT be used for whole-file
      // SEARCH — the tail is missing).
      const sourceHash = require('crypto').createHash('sha256').update(content).digest('hex');
      return { 
        success: true, 
        content: content.substring(0, 8000), // Protect against massive files in-memory
        metadata: { path: relativePath, sourceHash, ...(content.length > 8000 ? { truncated: true, totalLength: content.length } : {}) }
      };
    } catch (e) {
      throw new Error(`Failed to read file: ${e.message}`);
    }
  }
}

module.exports = ReadFileTool;

