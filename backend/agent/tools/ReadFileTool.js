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
      throw new Error(`File not found: ${relativePath}`);
    }

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      return { 
        success: true, 
        content: content.substring(0, 8000), // Protect against massive files in-memory
        metadata: { path: relativePath }
      };
    } catch (e) {
      throw new Error(`Failed to read file: ${e.message}`);
    }
  }
}

module.exports = ReadFileTool;

