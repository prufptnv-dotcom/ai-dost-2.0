const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const workspaceManager = require('../services/workspaceManager');
const logger = require('../logger');
let pty;
try {
  pty = require('node-pty');
} catch (e) {
  logger.warn('node-pty not available, falling back to standard shell');
}

// ── Terminal Session Manager ─────────────────────────────────────────
// One persistent shell per projectId. Both the user (via socket) and the
// agent (via terminalBus) can write to the same shell.
const sessions = new Map();

const BLOCKED_CMDS = [
  'rm -rf /',
  'format c:',
  'del /f /s /q c:\\',
  'shutdown',
  'rmdir /s /q c:',
  'rd /s /q c:',
];

function isBlocked(cmd) {
  return BLOCKED_CMDS.some((b) => (cmd || '').toLowerCase().includes(b));
}

function getShell() {
  if (process.platform === 'win32') {
    return process.env.ComSpec || 'cmd.exe';
  }
  return '/bin/bash';
}

function createSession(projectId, projectPath) {
  // Align with the agent workspace so terminal & agent share the same dir
  const cwd = projectPath || workspaceManager.getWorkspacePath(projectId);
  try {
    fs.mkdirSync(cwd, { recursive: true });
  } catch (_) {}

  const shellCmd = getShell();
  let shell;
  if (pty) {
    shell = pty.spawn(shellCmd, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd,
      env: process.env
    });
  } else {
    shell = require('child_process').spawn(shellCmd, process.platform === 'win32' ? ['/Q'] : [], {
      cwd,
      env: process.env,
      windowsHide: true,
    });
  }

  const session = {
    projectId,
    cwd,
    shell,
    sockets: new Set(),
    buffer: '',
    exited: false,
  };

  if (pty) {
    shell.onData((d) => broadcast(session, { type: 'term:data', projectId, data: d }));
  } else {
    shell.stdout.on('data', (d) => broadcast(session, { type: 'term:data', projectId, data: d.toString() }));
    shell.stderr.on('data', (d) => broadcast(session, { type: 'term:data', projectId, data: d.toString() }));
  }
  
  // Standard child_process error handling
  if (!pty) {
    shell.on('error', (err) => {
      logger.error('[Terminal] shell error:', err.message);
      broadcast(session, { type: 'term:data', projectId, data: `\r\n[terminal error] ${err.message}\r\n` });
    });
  }
  shell.on('exit', (code) => {
    session.exited = true;
    sessions.delete(projectId);
    broadcast(session, { type: 'term:exit', projectId, code });
  });

  sessions.set(projectId, session);
  return session;
}

function broadcast(session, payload) {
  for (const socket of session.sockets) {
    try {
      socket.emit(payload.type, payload);
    } catch (_) {}
  }
}

function attachSocketToSession(socket, projectId) {
  let session = sessions.get(projectId);
  if (!session) {
    session = createSession(projectId, socket.data.termPath || null);
  }
  session.sockets.add(socket);
  socket.data.termProjectId = projectId;
  return session;
}

function detachSocketFromSession(socket) {
  const projectId = socket.data.termProjectId;
  if (!projectId) return;
  const session = sessions.get(projectId);
  if (session) {
    session.sockets.delete(socket);
    if (session.sockets.size === 0) {
      // Keep the shell alive briefly for agent broadcast, then kill
      setTimeout(() => {
        const s = sessions.get(projectId);
        if (s && s.sockets.size === 0) {
          try { s.shell.kill(); } catch (_) {}
          sessions.delete(projectId);
        }
      }, 30000);
    }
  }
}

// ── Agent integration: run a command in a project's live session ─────
// Returns a Promise resolving to { success, stdout, stderr, exit_code }.
// Output is also streamed to the user's terminal in real-time.
// `onOutput(chunk)` (optional) receives each output chunk as it arrives
// so the agent can forward it to the UI (SSE) in real-time.
function runInSession(projectId, projectPath, command, timeoutMs, onOutput) {
  return new Promise((resolve) => {
    if (!command || !command.trim()) {
      return resolve({ success: false, stdout: '', stderr: 'Empty command', exit_code: 1 });
    }
    if (isBlocked(command)) {
      return resolve({ success: false, stdout: '', stderr: 'Command blocked for safety.', exit_code: 1 });
    }
    const session = sessions.get(projectId);
    if (session && !session.exited) {
      // Stream into the live shell so the user sees agent output
      broadcast(session, { type: 'term:data', projectId, data: `\r\n\x1b[38;5;33m$ ${command}\x1b[0m\r\n` });
    }
    const cwd = projectPath || (session ? session.cwd : undefined) || process.cwd();
    const child = exec(command, { cwd, timeout: timeoutMs || 60000, windowsHide: true }, (err, stdout, stderr) => {
      const exitCode = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      if (session && !session.exited) {
        session.activeChildProcess = null;
        broadcast(session, {
          type: 'term:data',
          projectId,
          data: `${stdout}${stderr}${exitCode !== 0 ? `\r\n\x1b[38;5;196m[exit ${exitCode}]\x1b[0m\r\n` : ''}`,
        });
      }
      resolve({
        success: exitCode === 0,
        stdout: (stdout || '').substring(0, 3000),
        stderr: (stderr || '').substring(0, 3000),
        exit_code: exitCode,
      });
    });

    if (session) {
      session.activeChildProcess = child;
      
      // Stream output as it happens so the UI terminal updates during long-running tasks
      child.stdout.on('data', (d) => {
        if (onOutput) onOutput(d.toString());
        broadcast(session, { type: 'term:data', projectId, data: d.toString() });
      });
      child.stderr.on('data', (d) => {
        if (onOutput) onOutput(d.toString());
        broadcast(session, { type: 'term:data', projectId, data: d.toString() });
      });
    }
  });
}

function runInSessionAuto(projectId, projectPath, command, timeoutMs) {
  const session = sessions.get(projectId);
  if (session && !session.exited) {
    broadcast(session, { type: 'term:data', projectId, data: `\r\n\x1b[38;5;33m$ ${command}\x1b[0m\r\n` });
  }
  return runInSession(projectId, projectPath, command, timeoutMs);
}

// ── Socket.io wiring ─────────────────────────────────────────────────
function setupTerminalSocket(io) {
  io.on('connection', (socket) => {
    socket.on('term:start', ({ projectId, projectPath } = {}) => {
      if (!projectId) return;
      socket.data.termPath = projectPath || null;
      const session = attachSocketToSession(socket, projectId);
      // Intro banner
      broadcast(session, {
        type: 'term:data',
        projectId,
        data: `\r\n\x1b[38;5;33mAI-Dost terminal ready — cwd: ${session.cwd}\x1b[0m\r\n`,
      });
    });

    socket.on('term:input', ({ projectId, data } = {}) => {
      if (!projectId) return;
      const session = sessions.get(projectId);
      if (session && !session.exited && data) {
        try {
          if (session.activeChildProcess && !session.activeChildProcess.killed) {
            // Write directly to the command the agent is running
            session.activeChildProcess.stdin.write(data);
          } else if (session.shell.write) {
            session.shell.write(data); // node-pty
          } else {
            session.shell.stdin.write(data); // child_process fallback
          }
        } catch (_) {}
      }
    });

    socket.on('term:exec', ({ projectId, command, projectPath } = {}, cb) => {
      if (!projectId) return;
      runInSession(projectId, projectPath, command).then((result) => {
        if (typeof cb === 'function') cb(result);
      });
    });

    socket.on('term:kill', ({ projectId } = {}) => {
      if (!projectId) return;
      const session = sessions.get(projectId);
      if (session) {
        try { session.shell.kill(); } catch (_) {}
        sessions.delete(projectId);
      }
    });

    socket.on('disconnect', () => {
      detachSocketFromSession(socket);
    });
  });
}

module.exports = { setupTerminalSocket, runInSession, runInSessionAuto, sessions };