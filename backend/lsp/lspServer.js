const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const logger = require('../logger');
const fs = require('fs');
const { upgradeGuard } = require('../middleware/localApiGuard');
const { shellEnv } = require('../services/shellEnv');

// #24: cap concurrent language-server processes (one spawn per WS client)
const MAX_LSP_SESSIONS = Number(process.env.LSP_MAX_SESSIONS) > 0 ? Number(process.env.LSP_MAX_SESSIONS) : 4;

// Ensure directory exists if needed
function setupLspServer(server) {
  const wss = new WebSocketServer({ noServer: true });
  let activeSessions = 0;

  server.on('upgrade', (request, socket, head) => {
    const pathname = (request.url || '').split('?')[0];
    if (pathname === '/lsp') {
      // #26: claim the socket so the catch-all upgrade handler skips it
      socket.__upgradeHandled = true;
      // #24: raw WS bypasses Express — require local Origin + private peer
      const gate = upgradeGuard(request, 'api');
      if (!gate.allowed) {
        logger.warn(`[LSP] Upgrade rejected (${gate.reason}) from ${socket.remoteAddress || 'unknown'}`);
        socket.destroy();
        return;
      }
      if (activeSessions >= MAX_LSP_SESSIONS) {
        logger.warn(`[LSP] Concurrency cap reached (${MAX_LSP_SESSIONS}) — rejecting new session`);
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        // Count the session for the whole (ws+socket) lifetime; release once.
        activeSessions += 1;
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          activeSessions = Math.max(0, activeSessions - 1);
        };
        ws.on('close', release);
        socket.on('close', release);
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    logger.info('🔌 Client connected to LSP Proxy');

    // Spawn the typescript-language-server
    // In windows, it's typically typescript-language-server.cmd
    const cmd = process.platform === 'win32' ? 'typescript-language-server.cmd' : 'typescript-language-server';
    // #23/#24: helper process gets the sanitized env, not full process.env
    const lspProcess = spawn(cmd, ['--stdio'], { env: shellEnv() });

    lspProcess.on('error', (err) => {
      logger.error('❌ Failed to start typescript-language-server:', err);
      ws.close();
    });

    // Forward messages from Client (WebSocket) -> LSP (stdin)
    ws.on('message', (message) => {
      lspProcess.stdin.write(message);
    });

    // Forward messages from LSP (stdout) -> Client (WebSocket)
    lspProcess.stdout.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    lspProcess.stderr.on('data', (data) => {
      logger.error(`LSP STDERR: ${data}`);
    });

    ws.on('close', () => {
      logger.info('🛑 LSP Proxy client disconnected');
      lspProcess.kill();
    });
  });

  logger.info('🚀 LSP WebSocket Proxy initialized on /lsp');
}

module.exports = { setupLspServer };
