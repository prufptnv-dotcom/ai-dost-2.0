import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

export function ApprovalBanner({
  reason = 'The agent requires your review before proceeding with sensitive workspace operations.',
  blockedAction,
  onApprove,
  onReject,
  onRetry,
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`p-4 rounded-lg border border-status-warning/40 bg-status-warning/10 text-txt-primary flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-8 h-8 rounded-md bg-status-warning/20 border border-status-warning/40 flex items-center justify-center text-status-warning flex-shrink-0 mt-0.5 sm:mt-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h4 className="text-ui-default font-semibold text-txt-primary font-display flex items-center gap-2">
            <span>Action Blocked — Waiting for Your Approval</span>
          </h4>
          <p className="text-xs text-txt-secondary mt-0.5 leading-relaxed">
            {reason}
          </p>
          {blockedAction && (
            <div className="mt-2 text-[11px] font-mono px-2 py-1 rounded-xs bg-canvas-base border border-border text-txt-muted truncate max-w-lg">
              Pending: {blockedAction}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
        {onReject && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
          >
            Reject
          </Button>
        )}
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={onRetry}
          >
            Retry Repair
          </Button>
        )}
        {onApprove && (
          <Button
            variant="primary"
            size="sm"
            icon={CheckCircle}
            onClick={onApprove}
          >
            Approve & Proceed
          </Button>
        )}
      </div>
    </div>
  );
}

export default ApprovalBanner;
