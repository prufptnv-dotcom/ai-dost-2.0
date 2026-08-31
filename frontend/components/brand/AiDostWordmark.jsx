import React from 'react';
import { AiDostMark } from './AiDostMark';

export function AiDostWordmark({ size = 'default', showVersion = true, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <AiDostMark size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
      <div className="flex items-baseline gap-1.5">
        <span className="font-display font-semibold tracking-tight text-ink-primary text-sm sm:text-base">
          AI<span className="text-accent-primary">·</span>DOST
        </span>
        {showVersion && (
          <span className="font-mono text-[10px] text-ink-muted uppercase tracking-wider font-normal">
            v2.4
          </span>
        )}
      </div>
    </div>
  );
}

export default AiDostWordmark;
