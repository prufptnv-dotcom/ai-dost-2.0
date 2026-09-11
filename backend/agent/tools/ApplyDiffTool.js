const fs = require('fs');
const path = require('path');
const Tool = require('../runtime/Tool');
const DiffEngine = require('../diffEngine');
const deterministicCodeGuard = require('../../services/DeterministicCodeGuard');

class ApplyDiffTool extends Tool {
  constructor() {
    super({
      name: 'apply_diff',
      description: 'Applies a surgical SEARCH/REPLACE diff patch to an existing file.',
      inputSchema: {
        type: 'object',
        required: ['path', 'search', 'replace'],
        properties: {
          path: { type: 'string' },
          search: { type: 'string' },
          replace: { type: 'string' },
          expectedSourceHash: { type: 'string' }
        }
      },
      permissions: ['filesystem.write']
    });
  }

  async execute(context, input) {
    this.validateInput(input);
    const { path: relativePath, search, replace, expectedSourceHash } = input;

    if (!relativePath || typeof relativePath !== 'string') {
      return { success: false, error: 'Path is required for apply_diff.' };
    }
    if (!search || typeof search !== 'string') {
      return { success: false, error: 'Non-empty search block is required for apply_diff.' };
    }
    if (typeof replace !== 'string') {
      return { success: false, error: 'Replace block must be a string.' };
    }

    const resolvedPath = context.workspaceManager.resolvePath(context.projectId, relativePath, context.userId);
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: `File not found: ${relativePath}. Use read_file first.` };
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const diffResult = DiffEngine.apply(content, search, replace, { expectedSourceHash });

    if (!diffResult.success) {
      return { success: false, code: diffResult.code, error: diffResult.error };
    }

    const newContent = diffResult.newContent;
    const guard = deterministicCodeGuard.guard(relativePath, newContent);
    if (!guard.accepted) {
      return { success: false, error: `Code rejected before persistence: ${guard.reason}`, diagnostics: guard.diagnostics };
    }

    const backupContent = content;
    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, newContent, 'utf-8');
      return {
        success: true,
        message: `Successfully applied diff to ${relativePath} (${diffResult.strategy})`,
        strategy: diffResult.strategy,
        confidence: diffResult.confidence,
        changedFile: relativePath
      };
    } catch (e) {
      try {
        fs.writeFileSync(resolvedPath, backupContent, 'utf-8');
      } catch (_) {}
      throw new Error(`Failed to apply diff: ${e.message}`);
    }
  }
}

module.exports = ApplyDiffTool;
