const fs = require('fs');
const path = require('path');
const Tool = require('../runtime/Tool');

class WriteFileTool extends Tool {
  constructor() {
    super({
      name: 'write_file',
      description: 'Writes content to a file in the workspace.',
      inputSchema: { type: 'object', required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } },
      permissions: ['filesystem.write']
    });
  }

  async execute(context, input) {
    this.validateInput(input);
    const { path: relativePath, content } = input;
    
    // 1. Validate boundary via workspaceManager
    const resolvedPath = context.workspaceManager.resolvePath(context.projectId, relativePath, context.userId);
    
    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, content, 'utf-8');
      return { 
        success: true, 
        message: `Successfully wrote to ${relativePath}`,
        metadata: { path: relativePath, byteLength: Buffer.byteLength(content, 'utf8') }
      };
    } catch (e) {
      throw new Error(`Failed to write file: ${e.message}`);
    }
  }
}

module.exports = WriteFileTool;

