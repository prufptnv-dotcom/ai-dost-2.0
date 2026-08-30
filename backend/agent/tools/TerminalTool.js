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
    
    // Explicit safety block matching legacy Phase 1 constraints
    const BLOCKED = ['rm -rf /', 'format c:', 'del /f /s /q c:\\', 'shutdown', 'rmdir /s /q c:'];
    if (BLOCKED.some(b => command.toLowerCase().includes(b))) {
      throw new Error('Command blocked for safety.');
    }

    const ws = context.workspaceManager.getWorkspacePath(context.projectId, context.userId);

    try {
      // Look up existing sandbox or create one
      // In a multi-step execution, sandboxId should ideally be stored in context.
      // But for backward compat with how orchestrator works, we rely on the project/task ID mapping.
      
      const sandboxKey = context.taskId || context.projectId || 'orchestrator-task';
      let sandboxId = context.sandboxId;

      if (!sandboxId) {
         const sb = await sandboxManager.createSandbox(sandboxKey, { workdir: ws });
         sandboxId = sb.id;
         // Store on context so subsequent tool calls can reuse it
         if (context) context.sandboxId = sandboxId; 
      }

      const r = await sandboxManager.exec(sandboxId, command, { timeout: 30000 });
      
      return {
        success: r.success,
        stdout: (r.stdout || '').substring(0, 3000),
        stderr: (r.stderr || '').substring(0, 3000),
        exit_code: r.exitCode,
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

