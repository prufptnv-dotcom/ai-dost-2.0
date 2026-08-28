import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io } from 'socket.io-client';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const THEME = {
  background: '#090a0f',
  foreground: '#e2e8f0',
  cursor: '#38bdf8',
  selectionBackground: 'rgba(56, 189, 248, 0.25)',
  black: '#161821',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#38bdf8',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#f8fafc',
};

const TerminalPanel = forwardRef(({ projectId, projectPath, className = '', onCommand, innerRef }, ref) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const socketRef = useRef(null);
  const lineBufRef = useRef('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);

  const write = useCallback((text) => {
    const term = termRef.current;
    if (term && !term._isDisposed) {
      try { term.write(text); } catch (e) {}
    }
  }, []);

  const writeLine = useCallback((text, color) => {
    write(`\r\n\x1b[38;5;${color || 33}m${text}\x1b[0m\r\n`);
  }, [write]);

  const restExec = useCallback(async (command) => {
    write(`\r\n\x1b[38;5;33m$ ${command}\x1b[0m\r\n`);
    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, projectId, projectPath }),
      });
      const data = await res.json();
      if (data.stdout) write(data.stdout.replace(/\n$/, ''));
      if (data.stderr) write(`\r\n\x1b[38;5;196m${data.stderr.replace(/\n$/, '')}\x1b[0m`);
      write(`\r\n\x1b[38;5;240m[exit ${data.exit_code ?? 0}]\x1b[0m\r\n`);
    } catch (e) {
      write(`\r\n\x1b[38;5;196m[error] ${e?.message || 'exec failed'}\x1b[0m\r\n`);
    }
  }, [projectId, projectPath, write]);

  const runCommand = useCallback((command) => {
    if (!command || !command.trim()) return;
    if (onCommand) onCommand(command);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('term:exec', { projectId, projectPath, command }, (result) => {
        if (!result) return;
        if (result.stdout) write(result.stdout.replace(/\n$/, ''));
        if (result.stderr) write(`\r\n\x1b[38;5;196m${result.stderr.replace(/\n$/, '')}\x1b[0m`);
        write(`\r\n\x1b[38;5;240m[exit ${result.exit_code ?? 0}]\x1b[0m\r\n`);
      });
    } else {
      restExec(command);
    }
  }, [projectId, projectPath, restExec, write, onCommand]);

  useImperativeHandle(innerRef || ref, () => ({
    runCommand,
    clear: () => { try { termRef.current?.clear(); } catch (e) {} },
    focus: () => { try { termRef.current?.focus(); } catch (e) {} },
    write,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      fontSize: 12,
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      theme: THEME,
      cursorBlink: true,
      scrollback: 5000,
      convertEol: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(container);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;
    term.focus();

    const resizeObserver = new ResizeObserver(() => {
      try { fit.fit(); } catch (e) {}
    });
    resizeObserver.observe(container);

    term.onData((data) => {
      if (!data) return;
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('term:input', { projectId, data });
      } else {
        if (data === '\r') {
          const cmd = lineBufRef.current;
          lineBufRef.current = '';
          write('\r\n');
          restExec(cmd);
        } else if (data === '\x7f') {
          if (lineBufRef.current.length > 0) {
            lineBufRef.current = lineBufRef.current.slice(0, -1);
            write('\b \b');
          }
        } else if (data === '\u0003') {
          lineBufRef.current = '';
          write('^C\r\n');
        } else if (data >= ' ') {
          lineBufRef.current += data;
          write(data);
        }
      }
    });

    const socket = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      socket.emit('term:start', { projectId, projectPath });
    });
    socket.on('term:data', (payload) => {
      if (payload && payload.projectId === projectId && payload.data) {
        write(payload.data);
      }
    });
    socket.on('term:exit', (payload) => {
      if (payload && payload.projectId === projectId) {
        writeLine('Shell exited. Reload to restart.', 240);
      }
    });
    socket.on('disconnect', () => {
      setConnected(false);
    });
    socket.on('connect_error', () => {
      setConnected(false);
      setConnecting(false);
      writeLine('Socket offline — REST fallback mode (Enter se command chalao)', 208);
    });

    return () => {
      resizeObserver.disconnect();
      try { socket.disconnect(); } catch (e) {}
      try { term.dispose(); } catch (e) {}
      socketRef.current = null;
      termRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectPath]);

  return (
    <div className={`relative h-full w-full ${className || ''}`}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute top-1.5 right-2 flex items-center gap-1.5 pointer-events-none">
        {connecting ? (
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--color-accent)' }} />
        ) : connected ? (
          <Wifi className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
        ) : (
          <WifiOff className="w-3 h-3" style={{ color: 'var(--color-warning)' }} />
        )}
      </div>
    </div>
  );
});

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;
