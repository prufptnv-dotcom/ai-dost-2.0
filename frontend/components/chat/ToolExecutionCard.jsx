import React, { useState } from 'react';
import { Terminal, FileCode2, FilePlus, Search, ShieldCheck, ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react';
import { Badge } from '../ui/Badge';

const TOOL_ICONS = {
  read_file: FileCode2,
  write_file: FilePlus,
  run_command: Terminal,
  search_code: Search,
  verify: ShieldCheck,
  default: Terminal,
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

  const Icon = TOOL_ICONS[tool] || TOOL_ICONS.default;

  const STATUS_VARIANTS = {
    running: 'info',
    success: 'success',
    error: 'error',
  };

  return (
    <div className={`my-2 rounded-md border border-border bg-canvas-surface overflow-hidden transition-fast ${className}`}>
      {/* Tool Header Summary */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-canvas-subtle/60 hover:bg-canvas-subtle transition-fast cursor-pointer select-none"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-xs bg-canvas-elevated border border-border flex items-center justify-center text-txt-secondary flex-shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className="font-mono text-xs font-medium text-txt-primary truncate">
            {tool}
          </span>
          {target && (
            <span className="font-mono text-xs text-txt-muted truncate max-w-[200px] sm:max-w-xs">
              {target}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {duration && (
            <span className="text-[11px] font-mono text-txt-muted">
              {duration}
            </span>
          )}
          <Badge variant={STATUS_VARIANTS[status] || 'default'} size="sm">
            {status === 'running' && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
            {status}
          </Badge>
          {output && (
            <div className="text-txt-muted">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>
      </button>

      {/* Expanded Output Block */}
      {expanded && output && (
        <div className="p-3 border-t border-border bg-canvas-base overflow-x-auto max-h-60 text-code-sm text-txt-secondary font-mono leading-relaxed">
          <pre className="whitespace-pre-wrap">{output}</pre>
        </div>
      )}
    </div>
  );
}

export default ToolExecutionCard;
