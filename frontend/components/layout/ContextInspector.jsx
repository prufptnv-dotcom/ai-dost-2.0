import React from 'react';
import { X, Layers, FileCode2, ShieldCheck, Clock, Check } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function ContextInspector({
  title = 'Context Inspector',
  isOpen = true,
  onClose,
  children,
  metadata = [],
  className = '',
}) {
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Context Inspector"
      className={`w-72 sm:w-80 h-full flex flex-col bg-canvas-subtle border-l border-border select-none z-20 overflow-hidden ${className}`}
    >
      {/* Inspector Header */}
      <div className="h-11 px-3.5 border-b border-border flex items-center justify-between gap-2 flex-shrink-0 bg-canvas-surface/40">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
          <h3 className="text-xs font-semibold text-paper-100 uppercase tracking-wider font-mono truncate">
            {title}
          </h3>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-xs flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-fast cursor-pointer focus-ring"
            title="Close Inspector"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Optional Metadata Row */}
      {metadata && metadata.length > 0 && (
        <div className="px-3.5 py-2 border-b border-border-subtle bg-canvas-base/50 flex flex-col gap-1.5 text-[11px]">
          {metadata.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2">
              <span className="text-ink-muted">{item.label}</span>
              <span className="font-mono text-paper-200 truncate">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inspector Body Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {children}
      </div>
    </aside>
  );
}

export default ContextInspector;
