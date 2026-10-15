import React from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, CircleDot, AlertCircle } from 'lucide-react';
import TaskStepItem from '../views/TaskStepItem';

// Devin-style plan card: always-visible checklist with progress + collapse.
export default function CopilotPlanCard({ tasks = [], expanded = true, onToggle }) {
  if (!tasks || tasks.length === 0) return null;

  const doneCount = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const allDone = doneCount === total;
  const hasError = tasks.some(t => t.status === 'error');
  const pct = Math.round((doneCount / total) * 100);

  return (
    <div data-testid="copilot-plan-card" className="mx-3 my-3 overflow-hidden rounded-xl border border-border bg-canvas-surface shadow-sm">
      {/* Header: label + progress + toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3.5 py-3 flex items-center gap-2.5 hover:bg-canvas-elevated transition-colors cursor-pointer text-left"
        aria-expanded={expanded}
        title={expanded ? 'Collapse plan' : 'Expand plan'}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-ink-muted">
          {allDone ? <CheckCircle2 size={12} className="text-emerald-400" /> : hasError ? <AlertCircle size={12} className="text-red-400" /> : <CircleDot size={12} className="text-accent" />}
          {allDone ? 'Completed plan' : hasError ? 'Plan needs attention' : 'Working plan'}
        </span>

        {/* Mini progress bar */}
        <span className="flex-1 h-1 rounded-full bg-canvas-elevated overflow-hidden         max-w-[180px]">
          <span
            className={`block h-full rounded-full transition-all duration-500 ${
              hasError ? 'bg-red-500' : allDone ? 'bg-emerald-500' : 'bg-accent'
            }`}
            style={{ width: `${pct}%` }}
          />
        </span>

        <span
          className={`text-[10px] font-mono tabular-nums ${
            hasError ? 'text-red-400' : allDone ? 'text-emerald-500' : 'text-ink-muted'
          }`}
          data-testid="plan-progress"
        >
          {doneCount}/{total}
        </span>

        {expanded ? (
          <ChevronUp size={13} className="text-ink-muted" />
        ) : (
          <ChevronDown size={13} className="text-ink-muted" />
        )}
      </button>

      {/* Checklist rows */}
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5 max-h-52 overflow-y-auto" data-testid="plan-rows">
          {tasks.map((t, idx) => (
            <TaskStepItem key={t.id || idx} step={t} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
