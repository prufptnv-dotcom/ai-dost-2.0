import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon, AlertCircle, FileText,
  Trash2, Copy, Check, Play, CornerDownLeft, X, Minimize2, Maximize2
} from 'lucide-react';

export function TerminalDock({
  logs = [],
  onRunCommand,
  onClear,
  isOpen = true,
  onClose,
  problems = [],
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'problems' | 'output'
  const [inputCmd, setInputCmd] = useState('');
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputCmd.trim()) return;
    if (onRunCommand) onRunCommand(inputCmd.trim());
    setInputCmd('');
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => (typeof l === 'string' ? l : l.text || '')).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={`flex flex-col bg-canvas-base border-t border-border font-mono text-xs select-none ${className}`}>
      {/* Terminal Dock Header */}
      <div className="flex items-center justify-between px-3 h-7 bg-canvas-subtle border-b border-border text-[11px] flex-shrink-0">
        <div className="flex items-center gap-1 h-full">
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`flex items-center gap-1.5 px-2.5 h-full transition-fast cursor-pointer border-r border-border ${
              activeTab === 'terminal'
                ? 'bg-canvas-base text-paper-100 font-medium'
                : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
            }`}
          >
            <TerminalIcon className="w-3 h-3 text-accent-primary" />
            <span>Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('problems')}
            className={`flex items-center gap-1.5 px-2.5 h-full transition-fast cursor-pointer border-r border-border ${
              activeTab === 'problems'
                ? 'bg-canvas-base text-paper-100 font-medium'
                : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
            }`}
          >
            <AlertCircle className="w-3 h-3 text-signal-warning" />
            <span>Problems</span>
            {problems.length > 0 && (
              <span className="px-1 rounded-xs bg-signal-warning/20 text-signal-warning text-[9px]">
                {problems.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('output')}
            className={`flex items-center gap-1.5 px-2.5 h-full transition-fast cursor-pointer border-r border-border ${
              activeTab === 'output'
                ? 'bg-canvas-base text-paper-100 font-medium'
                : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
            }`}
          >
            <FileText className="w-3 h-3 text-ink-muted" />
            <span>Output</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyLogs}
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
            title="Copy Logs"
          >
            {copied ? <Check className="w-3 h-3 text-signal-success" /> : <Copy className="w-3 h-3" />}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
              title="Clear Terminal"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
              title="Close Terminal"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal View Content */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed text-paper-200 space-y-1 select-text bg-canvas-base">
        {activeTab === 'terminal' && (
          <>
            {logs.length === 0 && (
              <div className="text-ink-muted">
                $ AI-Dost Sandbox Environment Ready.
              </div>
            )}
            {logs.map((log, i) => {
              const text = typeof log === 'string' ? log : log.text;
              const type = typeof log === 'object' ? log.type : 'stdout';
              return (
                <div
                  key={i}
                  className={`whitespace-pre-wrap font-mono ${
                    type === 'stderr' || type === 'error'
                      ? 'text-signal-error'
                      : type === 'command'
                      ? 'text-accent-primary font-semibold'
                      : 'text-paper-200'
                  }`}
                >
                  {text}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </>
        )}

        {activeTab === 'problems' && (
          <div className="space-y-1">
            {problems.length === 0 ? (
              <div className="text-signal-success text-xs">No errors or diagnostics found.</div>
            ) : (
              problems.map((p, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs py-1 border-b border-border-subtle">
                  <AlertCircle className="w-3.5 h-3.5 text-signal-error mt-0.5" />
                  <div>
                    <span className="text-paper-100 font-mono">{p.file}:{p.line}</span>
                    <p className="text-ink-muted">{p.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'output' && (
          <div className="text-ink-muted">
            Build output and tool background logs will appear here.
          </div>
        )}
      </div>

      {/* Command Input Prompt */}
      {activeTab === 'terminal' && onRunCommand && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-1.5 bg-canvas-subtle border-t border-border-subtle">
          <span className="text-accent-primary font-bold select-none">$</span>
          <input
            value={inputCmd}
            onChange={(e) => setInputCmd(e.target.value)}
            placeholder="Type a command (e.g. npm test, ls -la)..."
            className="flex-1 bg-transparent text-xs font-mono text-paper-100 placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="submit"
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer"
            title="Execute"
          >
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </form>
      )}
    </div>
  );
}
