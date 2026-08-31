import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Terminal,
} from 'lucide-react';

const getType = (tool = '') => {
  const value = tool.toLowerCase();
  if (/read|search|find/.test(value)) return 'READ';
  if (/write|edit|create/.test(value)) return 'WRITE';
  if (/test|verify/.test(value)) return 'TEST';
  if (/run|exec|terminal/.test(value)) return 'EXEC';
  return 'ACTION';
};

export default function ActionTimeline({ actions = [] }) {
  const [expanded, setExpanded] = useState(new Set());

  if (!actions.length) return null;

  const toggle = (index) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="my-3 ml-2 border-l border-accent-border pl-4"
    >
      <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-ink-muted">
        <Terminal className="h-3 w-3 text-accent" />
        Agent activity
      </div>
      <div className="space-y-2">
        {actions.map((action, index) => {
          const open = expanded.has(index);
          const running = action.status === 'running';
          const error = action.status === 'error';
          return (
            <div key={`${action.tool || 'action'}-${index}`}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className="group flex w-full items-center gap-2 text-left focus-ring cursor-pointer"
              >
                {open ? (
                  <ChevronDown className="h-3 w-3 text-ink-muted" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-ink-muted" />
                )}
                <span className="rounded-md bg-accent-subtle px-1.5 py-0.5 font-mono text-[9px] font-semibold text-accent">
                  {getType(action.tool)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-paper-200">
                  {action.target || action.args || action.tool}
                </span>
                {action.duration && (
                  <span className="font-mono text-[9px] text-ink-muted">
                    {action.duration}
                  </span>
                )}
                {running ? (
                  <Loader2 className="h-3 w-3 animate-spin text-accent" />
                ) : error ? (
                  <AlertCircle className="h-3 w-3 text-status-error" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-status-success" />
                )}
              </button>
              {open && (
                <motion.pre
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="ml-7 mt-1.5 max-h-44 overflow-auto rounded-lg border border-border-subtle bg-canvas-base p-2.5 font-mono text-[10px] leading-5 text-paper-300"
                >
                  {action.output || action.result || action.error || 'No output'}
                </motion.pre>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
