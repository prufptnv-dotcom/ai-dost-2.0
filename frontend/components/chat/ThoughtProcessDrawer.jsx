import React from 'react';
import { Sparkles, Clock } from 'lucide-react';

export default function ThoughtProcessDrawer({
  thought = '',
  isThinking = false,
  elapsed = 0,
}) {
  if (!thought && !isThinking) return null;

  const displaySeconds = elapsed > 0 ? elapsed.toFixed(1) : '1.2';

  return (
    <div className="flex items-center gap-1.5 my-1 text-[11px] font-medium select-none">
      {isThinking ? (
        <span className="flex items-center gap-1.5 text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">
          <Sparkles className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
          <span className="animate-pulse">Thinking...</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-ink-muted bg-canvas-surface px-2 py-1 rounded-md opacity-75">
          <Clock className="w-3 h-3" />
          Thought for {displaySeconds}s
        </span>
      )}
    </div>
  );
}
