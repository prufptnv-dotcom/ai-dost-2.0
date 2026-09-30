const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const workspaceManager = require('../services/workspaceManager');
const { shellEnv } = require('../services/shellEnv');
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
  'rm -rf / ',
  'format c:',
  'format c',
  'format c;',
  'del /f /s /q c:\\',
  'del /f /s /q c:\\\\',
  'shutdown',
  'rmdir /s /q c:',
  'rd /s /q c:',
  'mkfs',
  'dd if=',
  'dd of=/dev/',
  '> /dev/sd',
  ':(){:|:&};:',   // fork bomb
  'curl | sh',
  'curl | bash',
  'wget | sh',
  'wget | bash',
  'Invoke-Expression',
  'iex (',
  'remove-item -recurse -force c:',
  'Remove-Item -Recurse -Force C:\\',
  'Stop-Computer',
  'Restart-Computer',
];

// #22: layered, whitespace-proof command filter.
// Layer 1: BLOCKED_CMDS matched against a lowercase, single-space-normalized
//          copy of the command (multi-space variants can no longer slip past).
// Layer 2: BLOCKED_TIGHT matched against the command with ALL whitespace
//          removed (fork bombs / flag spellings hidden by spacing).
// Layer 3: BLOCKED_RE — flexible-spacing destructive shapes (any drive
//          letter, pipe-to-shell variants).
// Layer 4: rm-with-any-flag-spelling targeting abs/home/parent paths
//          (`rm -rf /tmp`, `rm -r -f C:\x`, `rm --no-preserve-root /` …).
const BLOCKED_TIGHT = [
  ':(){:|:&};:',          // fork bomb, arbitrary spacing
  'rm-rf/', 'rm-fr/',     // rm -rf <absolute path> (/tmp, /, D:\ …)
  'rm-rf..', 'rm-fr..',   // parent traversal target
  'rm-rf~', 'rm-fr~',     // home directory target
  'rmdir/s/q',            // any target (was c:-only)
  'rd/s/q',
  'del/f/s/q',            // any target (was c:-only)
  'remove-item-recurse',  // any drive/path (was C:\-only)
  'mkfs', 'ddif=', 'ddof=/dev/', '>/dev/sd',
];

const BLOCKED_RE = [
  /:\s*\(\s*\)\s*\{/,                                     // fork bomb opener
  /\|\s*(?:sudo\s+)?(?:ba|z|k)?sh\s*($|[^a-z0-9])/i,      // pipe → shell
  /\|\s*(?:sudo\s+)?python[0-9]*\s*($|[^a-z0-9])/i,       // pipe → python
  /\bformat\s+[a-z]:/i,                                   // format <any drive>:
];

function isBlocked(cmd) {
  const raw = String(cmd || '');
  if (!raw) return false;
  const norm = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (BLOCKED_CMDS.some((b) => norm.includes(b.toLowerCase().trim()))) return true;
  const tight = raw.toLowerCase().replace(/\s+/g, '');
  if (BLOCKED_TIGHT.some((b) => tight.includes(b))) return true;
  if (BLOCKED_RE.some((re) => re.test(norm))) return true;
  // Drop rm flag tokens (`-rf`, `-r -f`, `--no-preserve-root`, …) so any
  // flag ordering/spelling reduces to `rm <target>`; block abs/drive/home/
  // parent targets, keep relative cleanup (`rm -rf node_modules`) working.
  const noRmFlags = norm.replace(/\s+-{1,2}[a-z0-9]+(?:-[a-z0-9]+)*(?=\s|$)/gi, ' ');
  if (/\brm\s+(?:[a-z]:|[/~]|\.\.)/i.test(noRmFlags)) return true;
  return false;
}

// ── #21: client-supplied terminal cwd must stay inside an allowed root ──
// Allowed roots: agent workspace base, OS temp dir (legacy agent-ws/sandbox
// dirs live there), backend cwd. Anything else (C:\Windows, ~\.ssh, other
// drives, UNC) is rejected → caller falls back to the default workspace.
function safeTermPath(requested) {
  if (!requested || typeof requested !== 'string') return null;
  let resolved;
  try {
    resolved = path.resolve(requested.trim());
  } catch (_) {
    return null;
  }
  const roots = [os.tmpdir(), process.cwd()];
  try {
    roots.unshift(workspaceManager.getBaseWorkspaceDir());
  } catch (_) {}
  const ok = roots.some((root) => {
    let r;
    try {
      r = path.resolve(root);
    } catch (_) {
      return false;
    }
    const rel = path.relative(r, resolved);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
  if (!ok) {
    logger.warn(`[Terminal] Rejected projectPath outside allowed roots: ${requested}`);
    return null;
  }
  return resolved;
}

// Loopback or Docker-private only (mirrors middleware/localApiGuard execGuard)
function isAllowedSocketOrigin(address) {
  if (process.env.ALLOW_REMOTE_EXEC === '1') return true;
  const ip = String(address || '').replace(/^::ffff:/i, '');
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('127.')) return true;
  // Docker/Compose private bridges
  let m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip)) return true;
  if (/^f[cd]/i.test(ip)) return true;
  return false;
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
  // P2 #60: same hardening as terminalWs.js — never hand the shell the full
  // process.env (API keys/tokens leak into user- and agent-run commands).
  const env = shellEnv();
  let shell;
  if (pty) {
    shell = pty.spawn(shellCmd, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: cwd,
      env
    });
  } else {
    shell = require('child_process').spawn(shellCmd, process.platform === 'win32' ? ['/Q'] : [], {
      cwd,
      env,
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
    // #21: validate every client/agent-supplied cwd at the choke point
    const cwd = safeTermPath(projectPath) || (session ? session.cwd : undefined) || process.cwd();
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
    // Terminal sessions are full shell access — reject non-local handshakes
    const originAddr = socket.handshake.address || socket.conn?.remoteAddress;
    if (!isAllowedSocketOrigin(originAddr)) {
      socket.emit('term:data', { type: 'term:data', projectId: null, data: '[terminal] Remote access blocked — local only\r\n' });
      socket.disconnect(true);
      return;
    }

    socket.on('term:start', ({ projectId, projectPath } = {}) => {
      if (!projectId) return;
      socket.data.termPath = safeTermPath(projectPath);
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

module.exports = { setupTerminalSocket, runInSession, runInSessionAuto, sessions, isBlocked, safeTermPath };