import React, { useState } from 'react';
import AppIcon from '../ui/AppIcon';
import { Badge } from '../ui/Badge';

const TOOL_ICONS = {
  read_file: 'fileCode',
  write_file: 'filePlus',
  run_command: 'terminal',
  search_code: 'search',
  verify: 'shield',
  web_search: 'globe',
  python: 'cpu',
  python_runner: 'cpu',
  create_document: 'file',
  default: 'terminal',
};

export function ToolExecutionCard({
  tool = 'tool_call',
  target,
  status = 'success', // 'running' | 'success' | 'error'
  output,
  duration,
  className = '',
}) {
  const [expanded, setExpanded] = useState(false);

  const iconName = TOOL_ICONS[tool] || TOOL_ICONS.default;

  const STATUS_VARIANTS = {
    running: 'info',
    success: 'success',
    error: 'error',
  };

  const isRunning = status === 'running';

  return (
    <div
      className={`my-2 rounded-xl border ${
        isRunning
          ? 'border-amber-500/40 bg-amber-950/15 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse'
          : status === 'error'
          ? 'border-red-500/30 bg-red-950/10'
          : 'border-border bg-canvas-surface'
      } overflow-hidden transition-all duration-200 backdrop-blur-sm select-none ${className}`}
      data-testid="tool-calling-animation"
    >
      {/* 4. Tool Calling Header Summary */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left bg-canvas-subtle/60 hover:bg-canvas-subtle transition-fast cursor-pointer select-none"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-xs bg-canvas-elevated border border-border flex items-center justify-center text-paper-200 flex-shrink-0">
            <AppIcon name={iconName} size={14} />
          </div>
          <span className="font-mono text-xs font-medium text-paper-100 truncate">
            {tool}
          </span>
          {target && (
            <span className="font-mono text-xs text-ink-muted truncate max-w-[200px] sm:max-w-xs">
              {target}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {duration && (
            <span className="text-[11px] font-mono text-ink-muted">
              {duration}
            </span>
          )}
          <Badge variant={STATUS_VARIANTS[status] || 'default'} size="sm">
            {status === 'running' && <AppIcon name="loader" size={10} className="animate-spin mr-1" />}
            {status}
          </Badge>
          {output && (
            <div className="text-ink-muted">
              {expanded ? <AppIcon name="chevronDown" size={14} /> : <AppIcon name="chevronRight" size={14} />}
            </div>
          )}
        </div>
      </button>

      {/* Expanded Output Block */}
      {expanded && output && (
        <div className="p-3 border-t border-border bg-canvas-base overflow-x-auto max-h-60 text-code-sm text-paper-200 font-mono leading-relaxed">
          <pre className="whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}

export default ToolExecutionCard;
