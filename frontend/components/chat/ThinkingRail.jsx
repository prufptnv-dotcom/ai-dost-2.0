import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Check, Circle, Loader2 } from 'lucide-react';

const STEPS = [
  { key: 'understanding', label: 'Understand' },
  { key: 'context', label: 'Context' },
  { key: 'planning', label: 'Plan' },
  { key: 'generating', label: 'Generate' },
  { key: 'verifying', label: 'Verify' },
];

export default function ThinkingRail({
  state = 'understanding',
  detail = 'Interpreting your request',
  elapsed = 0,
}) {
  const currentIndex = STEPS.findIndex((step) => step.key === state);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl rounded-2xl border border-border bg-canvas-surface px-4 py-3.5 shadow-sm my-3"
      aria-live="polite"
      aria-label={`AI processing: ${detail}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Brain className="h-4 w-4" />
          <span className="absolute inset-0 rounded-xl border border-accent-border animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-paper-100">
              AI-Dost is working
            </span>
            <span className="font-mono text-[10px] text-ink-muted tabular-nums">
              {elapsed}s
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-ink-muted">
            {detail}
          </div>
        </div>
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" />
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {STEPS.map((step, index) => {
          const completed = index < currentIndex;
          const active = index === currentIndex;
          return (
            <React.Fragment key={step.key}>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    completed
                      ? 'border-status-success bg-status-success/15 text-status-success'
                      : active
                      ? 'border-accent bg-accent-subtle text-accent'
                      : 'border-border text-ink-muted'
                  }`}
                >
                  {completed ? (
                    <Check className="h-2.5 w-2.5" />
                  ) : active ? (
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full bg-accent"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  ) : (
                    <Circle className="h-2.5 w-2.5" />
                  )}
                </div>
                <span className="hidden truncate text-[9px] text-ink-muted lg:block">
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="h-px w-3 shrink-0 bg-border" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </motion.section>
  );
}
