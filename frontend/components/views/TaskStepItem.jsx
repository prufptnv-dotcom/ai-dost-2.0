import React from 'react';
import { CheckCircle2, CircleDashed, Loader2, FileCode2, Terminal } from 'lucide-react';

export default function TaskStepItem({ step, index }) {
  const isDone = step.status === 'completed';
  const isRunning = step.status === 'in_progress';
  const isPending = step.status === 'pending';

  return (
    <div className={`group flex items-start gap-3 p-3 rounded-lg border transition-all ${
      isRunning 
        ? 'bg-sky-500/[0.04] border-sky-500/30' 
        : isDone
        ? 'bg-transparent border-transparent hover:bg-white/[0.02]' 
        : 'bg-transparent border-transparent opacity-60'
    }`}>
      {/* Status Icon */}
      <div className="mt-0.5 flex-shrink-0">
        {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {isRunning && <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />}
        {isPending && <CircleDashed className="w-4 h-4 text-neutral-600" />}
      </div>

      {/* Task Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-medium truncate ${isDone ? 'text-neutral-300' : isRunning ? 'text-white' : 'text-neutral-400'}`}>
            {step.title}
          </p>
          {step.actionType && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-neutral-400 border border-white/[0.06]">
              {step.actionType}
            </span>
          )}
        </div>

        {/* Affected File or Command */}
        {step.target && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 bg-[#090a0f]/50 px-2 py-1 rounded border border-white/[0.04]">
            {step.target.startsWith('npm') || step.target.startsWith('npx') ? (
              <Terminal className="w-3 h-3 text-amber-400 flex-shrink-0" />
            ) : (
              <FileCode2 className="w-3 h-3 text-sky-400 flex-shrink-0" />
            )}
            <span className="truncate">{step.target}</span>
          </div>
        )}
      </div>
    </div>
  );
}
