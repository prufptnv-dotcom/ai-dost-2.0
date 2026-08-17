const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const logger = require('../logger');
const fs = require('fs');

// Ensure directory exists if needed
function setupLspServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/lsp') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    logger.info('🔌 Client connected to LSP Proxy');

    // Spawn the typescript-language-server
    // In windows, it's typically typescript-language-server.cmd
    const cmd = process.platform === 'win32' ? 'typescript-language-server.cmd' : 'typescript-language-server';
    const lspProcess = spawn(cmd, ['--stdio']);

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
