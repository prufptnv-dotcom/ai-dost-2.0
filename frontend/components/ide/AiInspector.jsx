import React, { useState } from 'react';
import {
  Sparkles, Bot, Code2, ShieldCheck, CheckCircle2,
  GitCompareArrows, Play, X, CornerDownLeft, Loader2, FileCode2
} from 'lucide-react';
import { Button } from '../ui/Button';

export function AiInspector({
  activePath = '',
  selectedCode = '',
  isOpen = true,
  onClose,
  onRunAiTask,
  agentChanges = [],
  isExecuting = false,
  className = '',
}) {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim() || isExecuting) return;
    if (onRunAiTask) onRunAiTask(prompt.trim());
    setPrompt('');
  };

  if (!isOpen) return null;

  return (
    <aside className={`w-80 flex flex-col bg-canvas-base border-l border-border select-none ${className}`}>
      {/* Inspector Header */}
      <div className="flex items-center justify-between px-3.5 h-10 bg-canvas-subtle border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-accent-primary" />
          <span className="text-xs font-semibold text-paper-100 font-display">
            AI Copilot Inspector
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-surface cursor-pointer"
            title="Close Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Inspector Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 font-sans text-xs">
        {/* Context Strip */}
        <div className="p-2.5 rounded-sm bg-canvas-surface border border-border space-y-1.5 font-mono text-[11px]">
          <div className="text-ink-muted uppercase text-[9px] tracking-wider font-semibold">Active Target</div>
          <div className="flex items-center gap-1.5 text-paper-100 font-medium truncate">
            <FileCode2 className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
            <span className="truncate">{activePath || 'No file selected'}</span>
          </div>
          {selectedCode && (
            <div className="text-[10px] text-ink-muted pt-1 border-t border-border-subtle">
              {selectedCode.split('\n').length} lines selected
            </div>
          )}
        </div>

        {/* Autonomous Code Changes */}
        {agentChanges.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-ink-muted uppercase text-[9px] tracking-wider font-mono font-semibold">
              Agent Modifications
            </div>
            <div className="space-y-1">
              {agentChanges.map((ch, idx) => (
                <div key={idx} className="p-2 rounded-xs bg-canvas-surface border border-border flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-paper-200 truncate">{ch.file}</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-signal-success">+{ch.added || 0}</span>
                    <span className="text-signal-error">-{ch.deleted || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Contextual Triggers */}
        <div className="space-y-1.5">
          <div className="text-ink-muted uppercase text-[9px] tracking-wider font-mono font-semibold">
            Context Actions
          </div>
          <div className="grid grid-cols-2 gap-1.5 font-sans">
            <button
              type="button"
              onClick={() => onRunAiTask && onRunAiTask(`Explain the implementation and logic in ${activePath}`)}
              className="px-2.5 py-1.5 rounded-xs bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast text-left cursor-pointer"
            >
              Explain File
            </button>
            <button
              type="button"
              onClick={() => onRunAiTask && onRunAiTask(`Generate comprehensive unit tests for ${activePath}`)}
              className="px-2.5 py-1.5 rounded-xs bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast text-left cursor-pointer"
            >
              Generate Tests
            </button>
            <button
              type="button"
              onClick={() => onRunAiTask && onRunAiTask(`Refactor ${activePath} for better performance and clarity`)}
              className="px-2.5 py-1.5 rounded-xs bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast text-left cursor-pointer"
            >
              Refactor
            </button>
            <button
              type="button"
              onClick={() => onRunAiTask && onRunAiTask(`Audit ${activePath} for security and runtime error risks`)}
              className="px-2.5 py-1.5 rounded-xs bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast text-left cursor-pointer"
            >
              Audit Security
            </button>
          </div>
        </div>
      </div>

      {/* Input Prompt Dock */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-canvas-subtle">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Instruct AI Copilot on active file..."
            rows={2}
            className="w-full px-2.5 py-2 rounded-xs bg-canvas-base border border-border text-paper-100 placeholder:text-ink-muted text-xs font-sans focus:outline-none focus:border-accent-primary resize-none pr-8"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isExecuting}
            className="absolute right-2 bottom-2.5 p-1 rounded-xs bg-accent-primary hover:bg-accent-primary-strong text-paper-100 transition-fast cursor-pointer disabled:opacity-40"
          >
            {isExecuting ? <Loader2 className="w-3 h-3 animate-spin" /> : <CornerDownLeft className="w-3 h-3" />}
          </button>
        </div>
      </form>
    </aside>
  );
}
