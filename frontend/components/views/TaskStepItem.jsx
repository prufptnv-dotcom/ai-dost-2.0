import React from 'react';
import {
  Check,
  Loader2,
  Circle,
  AlertTriangle,
} from 'lucide-react';

// Devin-style checklist row: square checkbox + title + mono target/log lines.
export default function TaskStepItem({ step, index }) {
  const isDone = step.status === 'completed';
  const isRunning = step.status === 'in_progress';
  const isPending = step.status === 'pending';
  const isError = step.status === 'error';

  return (
    <div
      data-testid="plan-row"
      data-status={step.status}
      className={`group flex items-start gap-2.5 px-2 py-1.5 rounded-md transition-colors ${
        isRunning
          ? 'bg-accent/[0.07]'
          : isError
          ? 'bg-red-500/[0.06]'
          : 'hover:bg-canvas-subtle'
      }`}
      aria-label={`Plan step ${index + 1}: ${step.title}`}
    >
      {/* Checkbox state marker */}
      <div className="mt-[1px] flex-shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center">
        {isDone && (
          <span className="w-4 h-4 -m-px rounded-[4px] bg-emerald-500/90 flex items-center justify-center">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
        {isRunning && (
          <span className="w-4 h-4 -m-px rounded-[4px] bg-accent flex items-center justify-center">
            <Loader2 className="w-3 h-3 text-white animate-spin" />
          </span>
        )}
        {isPending && <Circle className="w-2.5 h-2.5 text-neutral-600" />}
        {isError && (
          <span className="w-4 h-4 -m-px rounded-[4px] bg-red-500/90 flex items-center justify-center">
            <AlertTriangle className="w-3 h-3 text-white" strokeWidth={2.5} />
          </span>
        )}
      </div>

      {/* Title + supporting lines */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs leading-snug truncate ${
            isDone
              ? 'text-ink-muted line-through decoration-neutral-600'
              : isRunning
              ? 'text-paper-100 font-medium'
              : isError
              ? 'text-red-300'
              : 'text-paper-300'
          }`}
        >
          {step.title}
        </p>

        {/* Affected file / command */}
        {(step.target || step.file) && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-mono text-ink-muted min-w-0">
            <span className="truncate">{step.target || step.file}</span>
            {isDone && <span className="text-emerald-500/80 shrink-0">done</span>}
          </div>
        )}

        {/* Live log line while running */}
        {step.logSnippet && isRunning && (
          <div className="mt-0.5 text-[10px] font-mono text-accent/90 truncate">
            {step.logSnippet}
          </div>
        )}
      </div>

      {/* Action type tag */}
      {step.actionType && (
        <span className="mt-0.5 text-[9px] font-mono uppercase tracking-wide px-1 py-px rounded border border-border-subtle text-ink-muted shrink-0">
          {step.actionType}
        </span>
      )}
    </div>
  );
}
