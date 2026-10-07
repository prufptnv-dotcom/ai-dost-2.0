import React from 'react';
import AppIcon from '../ui/AppIcon';
import { formatElapsed } from './CopilotStatusBar';

export function IdeFooter({
  activePath,
  handleAutoFixProblems,
  running = false,
  problems = 0,
  stepLabel = '',
  approxTokens = 0,
  elapsedSec = 0,
  modelLabel = 'Auto (cascade)',
}) {
  return (
    <footer className="h-6 shrink-0 flex items-center justify-between px-3 bg-canvas-surface border-t border-border text-[10px] text-ink-muted font-mono select-none">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-1 text-ink-muted" title="Git branch">
          <AppIcon name="branch" size={11} /> main
        </span>
        <span className="truncate max-w-[220px]" title={activePath || 'No active file'}>
          {activePath || 'No active file'}
        </span>
        <button
          type="button"
          onClick={handleAutoFixProblems}
          disabled={running || problems === 0}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
            problems > 0
              ? 'text-amber-400 hover:bg-amber-500/15 cursor-pointer'
              : 'text-emerald-400 cursor-default'
          }`}
          title={problems > 0 ? `Fix ${problems} problems with AI` : 'Zero problems'}
        >
          {problems > 0 ? (
            <>
              <AppIcon name="alertCircle" size={10} />
              <span>{problems}</span>
            </>
          ) : (
            <>
              <AppIcon name="check" size={10} />
              <span>0</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {stepLabel && (
          <span className="text-paper-200 tabular-nums" data-testid="footer-step">
            {stepLabel}
          </span>
        )}
        {running && elapsedSec >= 1 && (
          <span className="text-paper-200 tabular-nums" data-testid="footer-elapsed">
            {formatElapsed(elapsedSec)}
          </span>
        )}
        <span className="text-ink-muted tabular-nums" data-testid="footer-tokens" title="Approximate tokens (chars ÷ 4)">
          ≈{approxTokens >= 1000 ? `${(approxTokens / 1000).toFixed(1)}k` : approxTokens}
        </span>
        <span className="text-ink-muted" title="Preferred model">
          {modelLabel}
        </span>
        <span className="text-ink-muted/70">UTF-8</span>
        <span className="flex items-center gap-1 text-emerald-500/80" title="Ready">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </span>
      </div>
    </footer>
  );
}

export default IdeFooter;
