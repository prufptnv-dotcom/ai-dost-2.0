import React from 'react';
import { Loader2 } from 'lucide-react';

// Emoji-heavy status strings → plain text (Devin-style serious tone)
export function stripEmoji(text = '') {
  return String(text)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatElapsed(totalSeconds = 0) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

const TONE_CLASS = {
  info: 'text-ink-muted',
  work: 'text-paper-200',
  success: 'text-emerald-500',
  error: 'text-red-400',
  neutral: 'text-ink-muted',
};

// Devin-style live status strip pinned above the composer:
// spinner + current action + elapsed timer.
export default function CopilotStatusBar({ running = false, status, elapsedSec = 0 }) {
  const label = stripEmoji(status?.label || '');
  const tone = status?.tone || 'info';

  if (!running && !label) return null;

  return (
    <div
      data-testid="copilot-status-bar"
      className="mx-3 mb-2 px-3 py-2 flex items-center gap-2 rounded-lg border border-border bg-canvas-surface min-h-[34px] shadow-sm"
      role="status"
      aria-live="polite"
    >
      {running ? (
        <Loader2 size={12} className="animate-spin text-accent shrink-0" />
      ) : (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            tone === 'success'
              ? 'bg-emerald-500'
              : tone === 'error'
              ? 'bg-red-500'
              : 'bg-neutral-600'
          }`}
        />
      )}

      <span className="text-[9px] font-mono uppercase tracking-widest text-ink-muted shrink-0">
        {running ? 'Agent' : 'Last action'}
      </span>
      <span className={`text-[11px] truncate ${TONE_CLASS[tone] || TONE_CLASS.info}`}>
        {label || (running ? 'Working…' : '')}
      </span>

      {running && (
        <span
          className="ml-auto text-[10px] font-mono tabular-nums text-ink-muted shrink-0"
          data-testid="copilot-elapsed"
        >
          {formatElapsed(elapsedSec)}
        </span>
      )}
    </div>
  );
}
