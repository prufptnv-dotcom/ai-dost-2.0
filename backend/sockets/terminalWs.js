const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const os = require('os');
const logger = require('../logger');

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
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    const shellCmd = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : '/bin/bash';
    const cwd = os.tmpdir();
    let shell;

    if (pty) {
      shell = pty.spawn(shellCmd, [], { name: 'xterm-color', cols: 120, rows: 40, cwd, env: process.env });
      shell.onData((data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      });
    } else {
      shell = spawn(shellCmd, process.platform === 'win32' ? ['/Q'] : [], {
        cwd,
        env: process.env,
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
        shell.write(data.toString());
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