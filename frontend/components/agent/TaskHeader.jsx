import React from 'react';
import { Bot, Play, Square, Loader2, Clock, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge, StatusIndicator } from '../ui/Badge';
import { Button } from '../ui/Button';

export function TaskHeader({
  objective = 'No active task',
  status = 'idle', // 'idle' | 'planning' | 'working' | 'verifying' | 'waiting_for_user' | 'complete' | 'failed'
  activeRole = 'SUPERVISOR',
  elapsedSeconds = 0,
  onStop,
  onStart,
  running = false,
  className = '',
}) {
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const STATUS_MAP = {
    idle: { variant: 'default', label: 'Idle' },
    planning: { variant: 'info', label: 'Planning' },
    working: { variant: 'info', label: 'Working' },
    verifying: { variant: 'warning', label: 'Verifying' },
    repairing: { variant: 'warning', label: 'Repairing' },
    waiting_for_user: { variant: 'warning', label: 'Waiting for You' },
    complete: { variant: 'success', label: 'Completed' },
    failed: { variant: 'error', label: 'Failed' },
  };

  const currentStatus = STATUS_MAP[status] || STATUS_MAP.idle;

  return (
    <div className={`px-4 sm:px-6 py-3 bg-canvas-subtle border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${className}`}>
      {/* Objective & Status */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-md bg-canvas-surface border border-border flex items-center justify-center text-accent flex-shrink-0 mt-0.5 sm:mt-0">
          <Bot className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-semibold text-txt-primary font-display truncate">
              {objective}
            </h2>
            <Badge variant={currentStatus.variant} size="sm">
              {running && <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />}
              {currentStatus.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-txt-muted mt-0.5">
            <span>Role: <strong className="font-mono text-txt-secondary font-medium">{activeRole}</strong></span>
            {running && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
        {running ? (
          <Button
            variant="danger"
            size="sm"
            icon={Square}
            onClick={onStop}
          >
            Stop Agent
          </Button>
        ) : onStart ? (
          <Button
            variant="primary"
            size="sm"
            icon={Play}
            onClick={onStart}
          >
            Execute Plan
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default TaskHeader;
