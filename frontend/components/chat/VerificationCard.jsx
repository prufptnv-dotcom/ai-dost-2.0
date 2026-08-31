import React from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function VerificationCard({
  verdict = 'PASS', // 'PASS' | 'FAIL' | 'BLOCKED'
  checks = [], // [{ name: 'UNIT_TEST', status: 'PASS' }, ...]
  summary,
  className = '',
}) {
  const isPass = verdict === 'PASS';
  const isFail = verdict === 'FAIL';

  return (
    <div
      className={`my-3 p-3.5 rounded-lg border bg-canvas-surface ${
        isPass
          ? 'border-status-success/30 bg-status-success/5'
          : isFail
          ? 'border-status-error/30 bg-status-error/5'
          : 'border-status-warning/30 bg-status-warning/5'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isPass ? (
            <ShieldCheck className="w-4 h-4 text-status-success" />
          ) : isFail ? (
            <ShieldAlert className="w-4 h-4 text-status-error" />
          ) : (
            <AlertCircle className="w-4 h-4 text-status-warning" />
          )}
          <span className="text-ui-default font-semibold text-txt-primary">
            Independent Verification
          </span>
        </div>
        <Badge
          variant={isPass ? 'success' : isFail ? 'error' : 'warning'}
          size="md"
        >
          {verdict}
        </Badge>
      </div>

      {summary && (
        <p className="text-xs text-txt-secondary mb-2.5 leading-relaxed">
          {summary}
        </p>
      )}

      {/* Check details grid */}
      {checks && checks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-border-subtle">
          {checks.map((c, i) => {
            const checkPass = c.status === 'PASS';
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs bg-canvas-base border border-border text-[11px] font-mono text-txt-secondary"
              >
                {checkPass ? (
                  <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-status-error flex-shrink-0" />
                )}
                <span className="truncate">{c.name || c.check_type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VerificationCard;
