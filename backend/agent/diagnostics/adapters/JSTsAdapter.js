const path = require('path');

class JSTsAdapter {
  constructor(sandboxMgr) {
    this.sandboxMgr = sandboxMgr;
  }

  canHandle(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
  }

  async run(sandboxId, workspacePath, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const relPath = path.relative(workspacePath, filePath).replace(/\\/g, '/');
    const diagnostics = [];

    // 1. Basic JS syntax check
    if (['.js', '.jsx'].includes(ext)) {
      try {
        if (this.sandboxMgr && sandboxId) {
          const res = await this.sandboxMgr.exec(sandboxId, `node -c "${relPath}"`);
          if (!res.success) {
            diagnostics.push(this.parseNodeSyntaxError(res.stderr || res.stdout, relPath));
          }
        } else {
          const { exec } = require('child_process');
          const fullPath = path.resolve(workspacePath || '.', filePath);
          await new Promise((resolve) => {
            exec(`node -c "${fullPath}"`, (err, stdout, stderr) => {
              if (err) {
                diagnostics.push(this.parseNodeSyntaxError(stderr || stdout || err.message, relPath));
              }
              resolve();
            });
          });
        }
      } catch (e) {
        // execution failed completely
      }
    }

    // 2. TSC check for TS files (only if tsc is available)
    if (['.ts', '.tsx'].includes(ext)) {
      try {
        const checkTsc = await this.sandboxMgr.exec(sandboxId, `npx --no-install tsc -v`);
        if (checkTsc.success) {
           const res = await this.sandboxMgr.exec(sandboxId, `npx --no-install tsc --noEmit --allowJs "${relPath}"`);
           if (!res.success) {
             diagnostics.push(...this.parseTscErrors(res.stdout || res.stderr, relPath));
           }
        } else {
           // Fallback to node syntax check if tsc is missing
           const res = await this.sandboxMgr.exec(sandboxId, `node -c "${relPath}"`);
           if (!res.success) {
             diagnostics.push(this.parseNodeSyntaxError(res.stderr || res.stdout, relPath));
           }
        }
      } catch (e) {}
    }

    return diagnostics;
  }

  parseNodeSyntaxError(output, relPath) {
    // Basic extraction
    let line = 1;
    let message = output.trim();
    const match = output.match(/:(\d+)\n/);
    if (match) {
        line = parseInt(match[1], 10);
    }
    const syntaxErrMatch = output.match(/SyntaxError:\s*(.*)/);
    if (syntaxErrMatch) {
        message = syntaxErrMatch[1];
    }

    return {
      file: relPath,
      line: line,
      column: 1,
      severity: 'error',
      source: 'node-syntax',
      message: message.substring(0, 500) // cap length
    };
  }

  parseTscErrors(output, relPath) {
    const errors = [];
    const lines = output.split('\n');
    for (const line of lines) {
       // example: app.ts(5,10): error TS2322: Type 'number' is not assignable to type 'string'.
       const match = line.match(/(.*)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)/);
       if (match) {
          errors.push({
             file: match[1].trim(),
             line: parseInt(match[2], 10),
             column: parseInt(match[3], 10),
             severity: match[4] === 'warning' ? 'warning' : 'error',
             source: `tsc-${match[5]}`,
             message: match[6]
          });
       }
    }

    // Fallback if no structured matches were found but command failed
    if (errors.length === 0 && output.trim().length > 0) {
       errors.push({
           file: relPath,
           line: 1, column: 1,
           severity: 'error',
           source: 'tsc',
           message: output.trim().substring(0, 500)
       });
    }

    return errors;
  }
}

module.exports = JSTsAdapter;
