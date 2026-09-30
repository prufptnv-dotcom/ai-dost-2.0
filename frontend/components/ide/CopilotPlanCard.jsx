import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
    <div data-testid="copilot-plan-card" className="border-b border-border bg-canvas-base">
      {/* Header: label + progress + toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center gap-2.5 hover:bg-canvas-subtle transition-colors cursor-pointer text-left"
        aria-expanded={expanded}
        title={expanded ? 'Collapse plan' : 'Expand plan'}
      >
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-muted">
          Plan
        </span>

        {/* Mini progress bar */}
        <span className="flex-1 h-1 rounded-full bg-canvas-elevated overflow-hidden max-w-[140px]">
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
        <div className="px-2 pb-2 space-y-0.5 max-h-44 overflow-y-auto" data-testid="plan-rows">
          {tasks.map((t, idx) => (
            <TaskStepItem key={t.id || idx} step={t} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
