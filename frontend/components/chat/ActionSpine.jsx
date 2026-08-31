import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function ActionSpine({
  actions = [],
  className = '',
}) {
  const [expandedIndices, setExpandedIndices] = useState(new Set());

  if (!actions || actions.length === 0) return null;

  const toggleExpand = (idx) => {
    const next = new Set(expandedIndices);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setExpandedIndices(next);
  };

  const getActionType = (tool) => {
    const t = (tool || '').toLowerCase();
    if (t.includes('read') || t.includes('search') || t.includes('find')) return 'READ';
    if (t.includes('write') || t.includes('edit') || t.includes('create')) return 'WRITE';
    if (t.includes('test') || t.includes('verify')) return 'TEST';
    if (t.includes('run') || t.includes('exec') || t.includes('terminal')) return 'EXEC';
    return 'ACTION';
  };

  return (
    <div className={`my-3 pl-3 border-l-2 border-border font-mono text-xs select-none ${className}`}>
      <div className="flex flex-col gap-2">
        {actions.map((act, idx) => {
          const actionType = getActionType(act.tool);
          const isExpanded = expandedIndices.has(idx);
          const isRunning = act.status === 'running';
          const isError = act.status === 'error';

          return (
            <div key={idx} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => toggleExpand(idx)}
                className="flex items-center gap-2 text-left text-paper-200 hover:text-paper-100 transition-fast cursor-pointer group py-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-ink-muted group-hover:text-paper-100" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-ink-muted group-hover:text-paper-100" />
                )}

                <span className="font-semibold text-accent-primary text-[11px] uppercase tracking-wider">
                  {actionType}
                </span>

                <span className="text-paper-100 truncate max-w-sm">
                  {act.target || act.args || act.tool}
                </span>

                {act.duration && (
                  <span className="text-[10px] text-ink-muted ml-auto font-sans">
                    {act.duration}
                  </span>
                )}

                {isRunning ? (
                  <Loader2 className="w-3 h-3 text-accent-primary animate-spin" />
                ) : isError ? (
                  <AlertCircle className="w-3 h-3 text-signal-error" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-signal-success" />
                )}
              </button>

              {/* Expandable Result / Stdout */}
              {isExpanded && (act.output || act.result || act.error) && (
                <div className="ml-5 p-2 rounded-xs bg-ink-900 border border-border text-[11px] text-paper-300 font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                  {act.output || act.result || act.error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActionSpine;
