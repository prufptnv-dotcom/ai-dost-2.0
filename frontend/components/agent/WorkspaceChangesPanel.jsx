import React from 'react';
import { FilePlus2, FileEdit, FileX2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function WorkspaceChangesPanel({
  changes = [
    { type: 'create', path: 'src/components/Header.jsx', lines: '+45' },
    { type: 'modify', path: 'src/App.jsx', lines: '+12 -4' },
  ],
  onOpenFile,
  className = '',
}) {
  if (!changes || changes.length === 0) {
    return null;
  }

  const ICON_MAP = {
    create: { icon: FilePlus2, color: 'text-status-success', label: 'Added' },
    modify: { icon: FileEdit, color: 'text-status-info', label: 'Modified' },
    delete: { icon: FileX2, color: 'text-status-error', label: 'Deleted' },
  };

  return (
    <div className={`p-4 bg-canvas-surface border border-border rounded-lg flex flex-col gap-2.5 select-none ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-txt-muted">
          Workspace Changes ({changes.length} files)
        </span>
      </div>

      <div className="space-y-1.5">
        {changes.map((chg, idx) => {
          const conf = ICON_MAP[chg.type] || ICON_MAP.modify;
          const Icon = conf.icon;

          return (
            <div
              key={idx}
              className="flex items-center justify-between gap-2 p-2 rounded-md bg-canvas-subtle/50 hover:bg-canvas-subtle border border-border-subtle text-xs transition-fast"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${conf.color}`} />
                <span className="font-mono text-txt-primary truncate max-w-xs">
                  {chg.path}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {chg.lines && (
                  <span className="font-mono text-[10px] text-txt-muted">
                    {chg.lines}
                  </span>
                )}
                {onOpenFile && (
                  <button
                    type="button"
                    onClick={() => onOpenFile(chg.path)}
                    className="p-1 rounded hover:bg-canvas-elevated text-txt-muted hover:text-txt-primary cursor-pointer focus-ring"
                    title="Open file"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WorkspaceChangesPanel;
