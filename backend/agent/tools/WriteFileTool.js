const fs = require('fs');
const path = require('path');
const Tool = require('../runtime/Tool');
const deterministicCodeGuard = require('../../services/DeterministicCodeGuard');

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

    // Existing-file write enforcement (GAP-01)
    if (fs.existsSync(resolvedPath) && !input.allowOverwrite) {
      return {
        success: false,
        code: 'WRITE_FORBIDDEN_ON_EXISTING',
        error: `Full-file replacement is forbidden for existing project files. Use apply_diff with a validated SEARCH/REPLACE patch on ${relativePath}.`
      };
    }

    const guard = deterministicCodeGuard.guard(relativePath, content);
    if (!guard.accepted) {
      return { success: false, error: `Code rejected before persistence: ${guard.reason}`, diagnostics: guard.diagnostics };
    }
    
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

