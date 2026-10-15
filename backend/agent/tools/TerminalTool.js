const Tool = require('../runtime/Tool');
const sandboxManager = require('../../sandbox/SandboxManager');

class TerminalTool extends Tool {
  constructor() {
    super({
      name: 'run_terminal',
      description: 'Executes a bash or shell command within the secure sandbox environment.',
      inputSchema: { type: 'object', required: ['command'], properties: { command: { type: 'string' } } },
      permissions: ['terminal.execute']
    });
  }

  async execute(context, input) {
    this.validateInput(input);
    const { command } = input;
    
    // P3 #35: shared SandboxManager policy instead of the old 5-string list
    // (rm -rf /, format c:, …) which trivial escapes bypassed.
    const policy = sandboxManager.validateCommandPolicy(command);
    if (!policy.allowed) {
      throw new Error(`Command blocked for safety: ${policy.reason || 'blocked by policy'}`);
    }

    const ws = context.workspaceManager.getWorkspacePath(context.projectId, context.userId);

    try {
      // Look up existing sandbox or create one
      // In a multi-step execution, sandboxId should ideally be stored in context.
      // But for backward compat with how orchestrator works, we rely on the project/task ID mapping.
      
      const sandboxKey = context.taskId || context.projectId || 'orchestrator-task';
      let sandboxId = context.sandboxId;

      if (!sandboxId) {
         // Reuse an existing sandbox for this project instead of creating a
         // fresh one per specialist context — a long run creates a new context
         // per task, and hitting MAX_CONTAINERS (10) made every subsequent
         // run_terminal throw "Sandbox limit reached" (seen in E2E run #9).
         // Only sandboxes bound to the project workspace (hostWorkdir — set
         // because TerminalTool always passes `workdir`) are reusable: a
         // workdir-less sandbox would run the command in an empty temp dir.
         const existing = sandboxManager
           .getSandboxesForProject(context.projectId)
           .filter(s => s && s.hostWorkdir)
           .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0];
         if (existing) {
           sandboxId = existing.id;
         } else {
           const sb = await sandboxManager.createSandbox(sandboxKey, { workdir: ws });
           sandboxId = sb.id;
         }
         // Store on context so subsequent tool calls can reuse it
         if (context) context.sandboxId = sandboxId; 
      }

      const r = await sandboxManager.exec(sandboxId, command, { timeout: 30000 });

      // Honest failure evidence: the step-failure path renders
      // `output.error || output.code || 'operation failed'` — without an
      // `error` field here, EVERY failed command surfaced as the useless
      // generic "operation failed" and the model (and the log) could not see
      // the real reason (e.g. the local-fallback exec denial "Docker is
      // unavailable and host execution was not explicitly enabled", or the
      // actual stderr of the command). Run #9 burned 3 self-heal attempts
      // retrying blind against an invisible cause.
      const errorText = r.success
        ? undefined
        : ((r.stderr || '').trim() || (r.stdout || '').trim() || `exit code ${r.exitCode}`);

      return {
        success: r.success,
        stdout: (r.stdout || '').substring(0, 3000),
        stderr: (r.stderr || '').substring(0, 3000),
        exit_code: r.exitCode,
        ...(errorText ? { error: errorText.substring(0, 600) } : {}),
        metadata: {
           command,
           sandboxId,
           timeout: 30000
        }
      };
    } catch (e) {
      throw new Error(`Failed to execute terminal command: ${e.message}`);
    }
  }
}

module.exports = TerminalTool;

