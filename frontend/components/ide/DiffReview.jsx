import React from 'react';
import { GitCompareArrows, Check, X, ArrowLeft, ArrowRight, FileCode2 } from 'lucide-react';
import { Button } from '../ui/Button';

export function DiffReview({
  file = '',
  originalCode = '',
  modifiedCode = '',
  isOpen = true,
  onAccept,
  onReject,
  onClose,
  className = '',
}) {
  if (!isOpen) return null;

  const originalLines = (originalCode || '').split('\n');
  const modifiedLines = (modifiedCode || '').split('\n');

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 ${className}`}>
      <div className="w-full max-w-4xl max-h-[85vh] rounded-sm bg-canvas-base border border-border shadow-modal flex flex-col overflow-hidden">
        {/* Diff Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-canvas-subtle border-b border-border select-none">
          <div className="flex items-center gap-2 font-mono text-xs text-paper-100">
            <GitCompareArrows className="w-4 h-4 text-accent-primary" />
            <span className="font-semibold">Diff Review:</span>
            <span className="text-paper-200">{file || 'untitled'}</span>
          </div>

          <div className="flex items-center gap-2">
            {onReject && (
              <Button variant="secondary" size="sm" onClick={onReject}>
                Discard
              </Button>
            )}
            {onAccept && (
              <Button variant="primary" size="sm" onClick={onAccept}>
                Accept Changes
              </Button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-xs text-ink-muted hover:text-paper-100 cursor-pointer ml-1"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Diff Body (Side by Side / Split) */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-border overflow-hidden font-mono text-xs">
          {/* Left: Original */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-1.5 bg-canvas-surface border-b border-border text-[10px] uppercase tracking-wider text-ink-muted select-none">
              Original ({originalLines.length} lines)
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-paper-300 leading-relaxed bg-canvas-base space-y-0.5">
              {originalLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-6 text-right text-ink-muted/50 select-none">{i + 1}</span>
                  <span className="whitespace-pre-wrap">{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Modified */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="px-3 py-1.5 bg-canvas-surface border-b border-border text-[10px] uppercase tracking-wider text-accent-primary select-none flex items-center justify-between">
              <span>Proposed by AI-Dost ({modifiedLines.length} lines)</span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-paper-100 leading-relaxed bg-canvas-base space-y-0.5">
              {modifiedLines.map((line, i) => (
                <div key={i} className="flex items-start gap-2 bg-signal-success/5">
                  <span className="w-6 text-right text-signal-success/70 select-none">{i + 1}</span>
                  <span className="whitespace-pre-wrap">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
