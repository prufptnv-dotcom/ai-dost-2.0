import React, { useMemo } from 'react';

export default function ThinkingDot({ label = 'Thinking…', elapsed = 0, activityStep }) {
  // Dynamic AI Activity Indicator progression if generic label is used
  const dynamicActivity = useMemo(() => {
    if (label && label !== 'Thinking…') return label;
    if (activityStep) return activityStep;
    if (elapsed < 2) return 'Analyzing prompt & context…';
    if (elapsed < 4) return 'Formulating reasoning pathway…';
    if (elapsed < 7) return 'Synthesizing knowledge & facts…';
    return 'Assembling comprehensive response…';
  }, [label, activityStep, elapsed]);

  const displayTime = elapsed > 0 ? `${elapsed}s elapsed` : 'Starting generation';

  return (
    <div
      className="thinking-indicator group relative my-2 flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-canvas-elevated/90 border border-accent/25 backdrop-blur-xl shadow-lg shadow-black/20 select-none transition-all duration-300 hover:border-accent/40"
      role="status"
      aria-live="polite"
      data-testid="ai-thinking-animation"
    >
      {/* 1. Futuristic Orbital Hologram / AI Thinking Animation */}
      <div className="relative flex items-center justify-center w-8 h-8 shrink-0" aria-hidden="true">
        {/* Outer Rotating Glowing Ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent border-r-amber-400 animate-spin"
          style={{ animationDuration: '2.5s' }}
        />
        {/* Middle Counter-Rotating Subtle Ring */}
        <div
          className="absolute inset-1 rounded-full border border-dashed border-cyan-400/50 animate-spin"
          style={{ animationDuration: '6s', animationDirection: 'reverse' }}
        />
        {/* Core Pulsing Glow Orb */}
        <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-accent via-indigo-400 to-indigo-600 animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.8)]" />
      </div>

      {/* Backward-compatible thinking signal for CSS compatibility */}
      <span className="thinking-signal hidden sm:inline-flex" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>

      {/* 2. AI Activity Indicator & Progress Copy */}
      <div className="thinking-copy flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <strong className="text-xs font-semibold text-paper-100 tracking-wide truncate">
            {dynamicActivity}
          </strong>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-medium bg-accent/15 text-accent border border-accent/30 animate-pulse">
            Active
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-ink-muted mt-0.5 font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{displayTime}</span>
          <span className="text-ink-muted/50">·</span>
          <span className="text-ink-muted/80">AI-Dost Engine</span>
        </div>
      </div>
    </div>
  );
}

