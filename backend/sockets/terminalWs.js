const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const os = require('os');
const logger = require('../logger');
const { upgradeGuard } = require('../middleware/localApiGuard');
const { shellEnv } = require('../services/shellEnv');

let pty;
try {
  pty = require('node-pty');
} catch (e) {
  pty = null;
}

function setupTerminalWsServer(server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];
    if (pathname === '/api/terminal/ws') {
      // #26: claim the socket so the catch-all upgrade handler skips it
      socket.__upgradeHandled = true;
      // #23: raw WS bypasses Express — apply the exec-tier origin/IP gate
      // (full shell = same bar as execGuard) before upgrading.
      const gate = upgradeGuard(request, 'exec');
      if (!gate.allowed) {
        logger.warn(`[TerminalWS] Upgrade rejected (${gate.reason}) from ${socket.remoteAddress || 'unknown'}`);
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    const shellCmd = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/bash';
    const cwd = os.tmpdir();
    // #23: never hand the shell the full process.env (API keys/tokens leak)
    const env = shellEnv();
    let shell;

    if (pty) {
      shell = pty.spawn(shellCmd, [], { name: 'xterm-color', cols: 120, rows: 40, cwd, env });
      shell.onData((data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      });
    } else {
      shell = spawn(shellCmd, process.platform === 'win32' ? ['/Q'] : [], {
        cwd,
        env,
        windowsHide: true,
      });
      shell.stdout.on('data', (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data.toString());
      });
      shell.stderr.on('data', (data) => {
        if (ws.readyState === ws.OPEN) ws.send(data.toString());
      });
    }

    ws.on('message', (data) => {
      try {
        // node-pty exposes .write(); child_process fallback only has stdin
        if (typeof shell.write === 'function') {
          shell.write(data.toString());
        } else if (shell.stdin) {
          shell.stdin.write(data.toString());
        }
      } catch (e) {}
    });
    ws.on('close', () => {
      try { shell.kill(); } catch (e) {}
    });
    ws.on('error', () => {});
    shell.on('exit', () => {
      try { ws.close(); } catch (e) {}
    });
  });

  logger.info('🚀 Terminal WebSocket initialized on /api/terminal/ws');
}

module.exports = { setupTerminalWsServer };