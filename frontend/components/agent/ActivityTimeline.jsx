import React from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function ActivityTimeline({
  events = [
    { id: '1', time: '10:02', role: 'SUPERVISOR', text: 'Task initialized and plan created', status: 'success' },
    { id: '2', time: '10:03', role: 'RESEARCHER', text: 'Inspected src/auth and codebase structure', status: 'success' },
    { id: '3', time: '10:05', role: 'CODER', text: 'Implemented authentication middleware', status: 'success' },
    { id: '4', time: '10:08', role: 'VERIFIER', text: 'Ran independent unit test verification', status: 'success' },
  ],
  className = '',
}) {
  if (!events || events.length === 0) {
    return (
      <div className={`p-4 text-center text-xs text-txt-muted bg-canvas-surface border border-border rounded-lg ${className}`}>
        No activity logged yet.
      </div>
    );
  }

  return (
    <div className={`p-4 bg-canvas-surface border border-border rounded-lg flex flex-col gap-3 select-none ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-wider text-txt-muted">
          Activity Timeline ({events.length})
        </span>
      </div>

      <div className="relative pl-3 space-y-3.5 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[1px] before:bg-border">
        {events.map((evt) => {
          const isError = evt.status === 'error' || evt.status === 'failed';
          const isRunning = evt.status === 'running' || evt.status === 'working';

          return (
            <div key={evt.id} className="relative flex items-start gap-3 text-xs">
              {/* Timeline Dot */}
              <div
                className={`w-2.5 h-2.5 rounded-full mt-1 border border-canvas-surface flex-shrink-0 z-10 ${
                  isError
                    ? 'bg-status-error'
                    : isRunning
                    ? 'bg-accent animate-pulse'
                    : 'bg-status-success'
                }`}
              />

              <div className="flex-1 min-w-0 bg-canvas-subtle/50 hover:bg-canvas-subtle p-2 rounded-md border border-border-subtle transition-fast">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-[10px] text-txt-muted">
                      {evt.time || 'now'}
                    </span>
                    {evt.role && (
                      <span className="font-mono text-[10px] px-1 py-0.2 rounded-xs bg-canvas-elevated text-txt-secondary font-medium">
                        {evt.role}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-txt-muted capitalize">
                    {evt.status || 'done'}
                  </span>
                </div>
                <p className="text-xs text-txt-primary truncate">
                  {evt.text || evt.message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivityTimeline;
