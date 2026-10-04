import React, { useState, useEffect, useMemo } from 'react';
import AppIcon from '../ui/AppIcon';

export default function ThoughtProcessDrawer({
  thought = '',
  isThinking = false,
  elapsed = 0,
}) {
  const [expanded, setExpanded] = useState(isThinking);
  const [copied, setCopied] = useState(false);

  // Auto-expand while active reasoning is in progress
  useEffect(() => {
    if (isThinking) {
      setExpanded(true);
    }
  }, [isThinking]);

  const displaySeconds = elapsed > 0 ? elapsed.toFixed(1) : '1.2';
  const wordCount = useMemo(() => {
    if (!thought) return 0;
    return thought.trim().split(/\s+/).filter(Boolean).length;
  }, [thought]);

  const copyReasoning = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(thought);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  if (!thought && !isThinking) return null;

  return (
    <div
      className="my-2.5 rounded-xl border border-purple-500/20 bg-purple-950/15 overflow-hidden backdrop-blur-md transition-all duration-200 select-none shadow-sm"
      data-testid="chain-of-thought-drawer"
    >
      {/* 6. Chain of Thought Header Bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left bg-purple-900/10 hover:bg-purple-900/20 transition-colors cursor-pointer select-none"
        aria-expanded={expanded}
        aria-label="Toggle chain of thought visualization"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
            {isThinking ? (
              <AppIcon name="loader" size={11} className="text-purple-300" />
            ) : (
              <AppIcon name="sparkles" size={11} className="text-purple-300" />
            )}
          </div>
          <span className="text-xs font-semibold text-purple-200 tracking-wide">
            Chain of Thought
          </span>
          <span className="text-[10px] text-purple-300/70 font-mono hidden sm:inline">
            (Internal Reasoning)
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isThinking ? (
            <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-purple-300 bg-purple-500/20 border border-purple-400/40 px-2 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              Reasoning live… {displaySeconds}s
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] font-mono text-purple-300/80 bg-purple-500/10 px-2 py-0.5 rounded-full">
              <AppIcon name="clock" size={10} />
              Thought for {displaySeconds}s {wordCount > 0 ? `· ${wordCount} words` : ''}
            </span>
          )}

          <div className="text-purple-300/70 transition-transform duration-200">
            <AppIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={12} />
          </div>
        </div>
      </button>

      {/* Expanded Reasoning Visualization Body */}
      {expanded && (
        <div className="p-3.5 border-t border-purple-500/15 bg-black/30">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-500/10 text-[10px] font-mono text-purple-300/60 uppercase tracking-wider">
            <span>Step-by-step reasoning trace</span>
            {thought && (
              <button
                type="button"
                onClick={copyReasoning}
                className="flex items-center gap-1 text-[10px] text-purple-300 hover:text-white transition-colors cursor-pointer"
                title="Copy reasoning trace"
              >
                <AppIcon name={copied ? 'check' : 'copy'} size={10} />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto pr-1 text-[12px] font-mono text-purple-200/90 leading-relaxed whitespace-pre-wrap select-text selection:bg-purple-500/30">
            {thought ? (
              thought
            ) : (
              <span className="italic text-purple-400/60">
                Formulating multi-step hypotheses and reasoning paths…
              </span>
            )}
            {isThinking && (
              <span className="inline-block w-2 h-3.5 ml-1 bg-purple-400 rounded-xs animate-pulse align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

