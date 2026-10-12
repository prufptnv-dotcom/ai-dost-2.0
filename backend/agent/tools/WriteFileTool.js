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

    // P12.6 (E2E run #12): write_file with a DIRECTORY target (e.g. "src/" or
    // "src") used to hit the existsSync() branch below and answer "Use
    // apply_diff on src/" — impossible advice, and the model burned 7 retries
    // on the same dead end. A directory is not a file; say so and route the
    // model to writing a file INSIDE it (parent dirs are auto-created below).
    const isDirTarget = /[\\/]\s*$/.test(String(relativePath)) ||
      (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory());
    if (isDirTarget) {
      const dirLabel = String(relativePath).replace(/[\\/]+$/, '');
      // P12.7 (E2E run #13): directory writes carry EMPTY content
      // ({"path":"src/","content":""}) — unambiguous "create this directory"
      // intent. Answer it via <dir>/.gitkeep so the step SUCCEEDS instead of
      // looping: run #13 died when "server/" content:"" failed once while the
      // worker's repair budget was already spent (the model DID apply the
      // ".gitkeep" hint for src/ but re-sent the bare dir for server/).
      // Nothing is lost — the content being "written" is empty.
      if (!String(content ?? '').trim()) {
        try {
          fs.mkdirSync(resolvedPath, { recursive: true });
          const keepPath = path.join(resolvedPath, '.gitkeep');
          if (!fs.existsSync(keepPath)) fs.writeFileSync(keepPath, '', 'utf-8');
          return {
            success: true,
            message: `Created directory "${dirLabel}/" (write_file writes file content — empty content means "create this directory", done via ${dirLabel}/.gitkeep)`,
            metadata: { path: `${dirLabel}/.gitkeep`, directory: true }
          };
        } catch (e) {
          return { success: false, code: 'PATH_IS_DIRECTORY', error: `Failed to create directory "${relativePath}": ${e.message}` };
        }
      }
      return {
        success: false,
        code: 'PATH_IS_DIRECTORY',
        error: `"${relativePath}" is a directory, not a file. write_file writes FILE content — give a path inside it, e.g. "${dirLabel}/App.jsx" (parent directories are created automatically). To create an empty directory, send empty content with the trailing slash (path: "${dirLabel}/").`
      };
    }

    // Existing-file write enforcement (GAP-01)
    // P2 #59: input.allowOverwrite was LLM-supplied — the model could pass
    // allowOverwrite:true and bypass the protection. No LLM-controlled flag
    // may enable overwrite; full replacement of existing files always goes
    // through apply_diff.
    if (fs.existsSync(resolvedPath)) {
      // P12.8 (E2E run #14): the model READ the file and still sent an
      // apply_diff SEARCH from its imagination (its own earlier write content,
      // search == replace no-op!) — "read_file it first" alone is not enough
      // for a 7b model. Embed the REAL bytes in the rejection (same P12.5
      // pattern that fixed the SEARCH-not-found ×7 loop) so the repair planner
      // copies SEARCH verbatim instead of guessing.
      let currentExcerpt = '';
      try {
        const current = fs.readFileSync(resolvedPath, 'utf-8');
        const MAXC = 8000;
        currentExcerpt = current.length > MAXC
          ? `${current.slice(0, 6000)}\n… [truncated — file is ${current.length} chars — use a SMALLER unique SEARCH block] …\n${current.slice(-400)}`
          : current;
      } catch (_) {}
      return {
        success: false,
        code: 'WRITE_FORBIDDEN_ON_EXISTING',
        error: `Full-file replacement is forbidden for existing project files. Use apply_diff with a validated SEARCH/REPLACE patch on ${relativePath}. read_file it first: SEARCH must be text that is ACTUALLY in the file (for a whole-file rewrite, SEARCH = the file's entire current content), REPLACE = your new text.` +
          (currentExcerpt ? `\n--- CURRENT FILE CONTENT ---\n${currentExcerpt}\n--- END FILE CONTENT ---` : '')
      };
    }

    // P12.3: accept single-unescape of escaped model blobs (guard-normalized);
    // always persist `guard.content` (the source that actually passed).
    const guard = deterministicCodeGuard.guardWithNormalization(relativePath, content);
    if (!guard.accepted) {
      return { success: false, error: `Code rejected before persistence: ${deterministicCodeGuard.rejectionDetail(guard)}`, diagnostics: guard.diagnostics };
    }
    
    try {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, guard.content, 'utf-8');
      return { 
        success: true, 
        message: `Successfully wrote to ${relativePath}${guard.normalized ? ' (normalized escaped model output)' : ''}`,
        metadata: { path: relativePath, byteLength: Buffer.byteLength(guard.content, 'utf8'), ...(guard.normalized ? { normalized: true } : {}) }
      };
    } catch (e) {
      throw new Error(`Failed to write file: ${e.message}`);
    }
  }
}

module.exports = WriteFileTool;

