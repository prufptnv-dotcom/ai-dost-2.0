import React from 'react';
import { 
  CheckCircle2, 
  CircleDashed, 
  Loader2, 
  FileCode2, 
  Terminal, 
  Sparkles, 
  FileEdit, 
  Check, 
  AlertTriangle 
} from 'lucide-react';

export default function TaskStepItem({ step, index }) {
  const isDone = step.status === 'completed';
  const isRunning = step.status === 'in_progress';
  const isPending = step.status === 'pending';
  const isError = step.status === 'error';

  return (
    <div className={`group flex items-start gap-2.5 p-2.5 rounded-lg border transition-all ${
      isRunning 
        ? 'bg-sky-500/[0.06] border-sky-500/30 shadow-glow-sm' 
        : isDone
        ? 'bg-transparent border-transparent hover:bg-white/[0.02]' 
        : isError
        ? 'bg-red-500/[0.06] border-red-500/30'
        : 'bg-transparent border-transparent opacity-60'
    }`}>
      {/* Status Icon */}
      <div className="mt-0.5 flex-shrink-0">
        {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {isRunning && <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />}
        {isPending && <CircleDashed className="w-3.5 h-3.5 text-neutral-600" />}
        {isError && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
      </div>

      {/* Task Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-medium truncate ${
            isDone 
              ? 'text-neutral-300' 
              : isRunning 
              ? 'text-white font-semibold' 
              : isError
              ? 'text-red-300'
              : 'text-neutral-400'
          }`}>
            {step.title}
          </p>
          {step.actionType && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-neutral-400 border border-white/[0.06] uppercase">
              {step.actionType}
            </span>
          )}
        </div>

        {/* Affected File or Command Badge */}
        {(step.target || step.file) && (
          <div className="mt-1 flex items-center gap-1.5 text-[10.5px] font-mono text-neutral-400 bg-[#090a0f]/60 px-2 py-0.5 rounded border border-white/[0.04]">
            {(step.target || '').startsWith('npm') || (step.target || '').startsWith('npx') ? (
              <Terminal className="w-3 h-3 text-amber-400 flex-shrink-0" />
            ) : (
              <FileCode2 className="w-3 h-3 text-sky-400 flex-shrink-0" />
            )}
            <span className="truncate">{step.target || step.file}</span>
            {isRunning && (
              <span className="ml-auto flex items-center gap-1 text-[9px] text-sky-400 font-sans font-medium animate-pulse">
                <Sparkles className="w-2.5 h-2.5" /> Working
              </span>
            )}
            {isDone && (
              <span className="ml-auto text-[9px] text-emerald-400 font-sans">
                Done
              </span>
            )}
          </div>
        )}

        {/* Real-time Streaming Log Snippet */}
        {step.logSnippet && isRunning && (
          <div className="mt-1 text-[10px] font-mono text-neutral-300 bg-[#090a0f]/80 px-2 py-1 rounded border border-sky-500/20 truncate">
            <span className="text-sky-400 mr-1.5">▸</span>
            {step.logSnippet}
          </div>
        )}
      </div>
    </div>
  );
}
