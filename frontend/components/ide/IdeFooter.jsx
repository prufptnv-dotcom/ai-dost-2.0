import React from 'react';
import { GitBranch, AlertCircle, Check, Zap } from 'lucide-react';
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
    <footer className="h-6 shrink-0 flex items-center justify-between px-4 bg-canvas-surface border-t border-border text-[10px] text-ink-muted font-mono select-none">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-paper-200">
          <GitBranch size={12} className="text-accent" /> main
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {activePath ? activePath : 'No active file'}
        </span>
        <button
          type="button"
          onClick={handleAutoFixProblems}
          disabled={running || problems === 0}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all ${
            problems > 0 
              ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 font-bold border border-amber-500/30 cursor-pointer shadow-xs' 
              : 'text-emerald-400 font-medium cursor-default'
          }`}
          title={problems > 0 ? 'Click to auto-fix and verify all problems with Copilot AI' : 'Zero problems detected'}
        >
          {problems > 0 ? (
            <>
              <AlertCircle size={11} className="text-amber-400" />
              <span>⚠ {problems} problems</span>
              <span className="ml-1 px-1.5 py-0.2 rounded bg-amber-500/25 text-[9px] uppercase tracking-wider text-amber-300 border border-amber-500/30">Auto-Fix ⚡</span>
            </>
          ) : (
            <>
              <Check size={11} className="text-emerald-400" />
              <span>✓ 0 errors</span>
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {stepLabel && (
          <span className="text-paper-200" data-testid="footer-step">
            step {stepLabel}
          </span>
        )}
        {running && elapsedSec >= 1 && (
          <span className="text-paper-200 tabular-nums" data-testid="footer-elapsed">
            {formatElapsed(elapsedSec)}
          </span>
        )}
        <span className="text-ink-muted tabular-nums" data-testid="footer-tokens" title="Approximate tokens (chars ÷ 4) — free tier">
          ≈{approxTokens >= 1000 ? `${(approxTokens / 1000).toFixed(1)}k` : approxTokens} tok · ₹0
        </span>
        <span className="text-ink-muted flex items-center gap-1" title="Preferred model — cascade fallback active">
          <Zap size={10} className="text-emerald-500" /> {modelLabel}
        </span>
        <span>UTF-8</span>
        <span className="text-paper-200">AI-Dost v3.0</span>
      </div>
    </footer>
  );
}

export default IdeFooter;
