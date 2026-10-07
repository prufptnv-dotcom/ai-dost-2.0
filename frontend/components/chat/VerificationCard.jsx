import React from 'react';
import AppIcon from '../ui/AppIcon';
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
            <AppIcon name="shield" size={16} className="text-emerald-400" />
          ) : isFail ? (
            <AppIcon name="alert" size={16} className="text-red-400" />
          ) : (
            <AppIcon name="alertCircle" size={16} className="text-amber-400" />
          )}
          <span className="font-semibold text-paper-100">
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
        <p className="text-xs text-paper-200 mb-2.5 leading-relaxed">
          {summary}
        </p>
      )}

      {checks && checks.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-border-subtle">
          {checks.map((c, i) => {
            const checkPass = c.status === 'PASS';
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-xs bg-canvas-base border border-border text-[11px] font-mono text-paper-200"
              >
                {checkPass ? (
                  <AppIcon name="checkCircle" size={12} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <AppIcon name="errorCircle" size={12} className="text-red-400 flex-shrink-0" />
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
