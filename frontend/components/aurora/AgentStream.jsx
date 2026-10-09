import { useEffect, useRef } from 'react';
import AppIcon from '../ui/AppIcon';
import s from './Aurora.module.css';

/**
 * P11 A1 — the run spine.
 *
 * Every agent event (thought / read / write / build / fix / reply / user) is a
 * node on ONE vertical rail: machine facts stay monospace, the user's own words
 * are set in sans. The final node pulses while a run is live.
 */
const TONE_CLASS = {
  accent: s.toneAccent,
  ok: s.toneOk,
  warn: s.toneWarn,
  err: s.toneErr,
  info: s.toneInfo,
  user: s.toneUser,
  muted: s.toneMuted,
};

export default function AgentStream({ events = [], running = false, onRetry = null }) {
  const endRef = useRef(null);

  useEffect(() => {
    const el = endRef.current;
    // jsdom has no scrollIntoView — guard keeps tests green.
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'end' });
    }
  }, [events]);

  return (
    <div className={s.stream} data-testid="aurora-stream">
      <div className={s.spine}>
        {events.map((e, i) => {
          const live = running && i === events.length - 1;
          const tone = TONE_CLASS[e.tone] || s.toneMuted;
          return (
            <div key={e.id ?? i} className={s.row} data-testid="spine-row" data-kind={e.kind}>
              <span className={`${s.node} ${tone} ${live ? s.nodeLive : ''}`} aria-hidden="true" />
              <span className={s.rowKind}>{e.label}</span>
              <span className={`${s.rowDetail} ${e.kind === 'user' ? s.rowDetailUser : ''}`}>
                {e.detail}
              </span>
              <span className={s.rowMeta}>{e.meta || ''}</span>
              {e.kind === 'error' && typeof onRetry === 'function' && (
                <button
                  type="button"
                  className={s.retryBtn}
                  data-testid="retry-btn"
                  onClick={onRetry}
                >
                  <AppIcon name="refresh" size={10} />
                  Retry
                </button>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
