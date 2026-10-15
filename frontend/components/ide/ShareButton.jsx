import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../ui/AppIcon';

/**
 * P7 — public share link (cloudflared quick tunnel → key-gated scoped proxy).
 *
 * Click → popover auto-opens a share (POST /api/share/:id) and shows the URL
 * with copy / open / stop. A failed tunnel shows the honest hint (LAN fallback)
 * — we never display a fake URL. An already-active share is restored on mount.
 */
export default function ShareButton({ projectId, showToast }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);

  // restore an already-active share (backend keeps it in memory)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/share/${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d && d.url) setShare(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const startShare = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/share/${encodeURIComponent(projectId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = await r.json();
      setShare(data);
      if (data && data.success && data.url) {
        showToast?.({ type: 'success', message: 'Public share link ready 🔗' });
      } else {
        showToast?.({ type: 'error', message: (data && data.hint) || 'Tunnel unavailable' });
      }
    } catch (e) {
      setShare({ success: false, url: null, hint: `Share failed: ${e && e.message ? e.message : e}` });
      showToast?.({ type: 'error', message: 'Share failed' });
    } finally {
      setLoading(false);
    }
  };

  const stopShare = async () => {
    try {
      await fetch(`/api/share/${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    } catch (_) {
      /* best effort — server record may already be gone */
    }
    setShare(null);
    setCopied(false);
    showToast?.({ type: 'info', message: 'Share link stopped' });
  };

  const copy = async () => {
    if (!share || !share.url) return;
    try {
      // fire-and-forget: setCopied stays synchronous so it runs inside the
      // click's act() scope (async await here caused act() warnings in tests)
      navigator.clipboard.writeText(share.url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {
      /* clipboard blocked — the input is selectable anyway */
    }
  };

  const active = Boolean(share && share.url);

  const onToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !share && !loading) startShare();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        data-testid="share-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
        className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
          active
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-canvas-subtle hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 border-border'
        }`}
        title={active ? 'Public share link active — click to manage' : 'Share preview on a public link'}
      >
        <AppIcon name="share" size={12} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Public share"
          data-testid="share-popover"
          className="absolute right-0 top-full mt-1.5 z-40 w-72 p-3 rounded-lg bg-canvas-surface border border-border shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Public share</span>
            <button
              type="button"
              data-testid="share-close"
              onClick={() => setOpen(false)}
              className="text-ink-muted hover:text-paper-100"
              title="Close"
            >
              <AppIcon name="close" size={11} />
            </button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-ink-muted py-1" data-testid="share-loading">
              <AppIcon name="loader" size={11} /> Opening secure tunnel…
            </div>
          )}

          {!loading && active && (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <input
                  readOnly
                  value={share.url}
                  data-testid="share-url"
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded bg-canvas-base border border-border text-[10px] font-mono text-paper-100 outline-none"
                />
                <button
                  type="button"
                  data-testid="share-copy"
                  onClick={copy}
                  title="Copy link"
                  className="px-2 py-1.5 rounded bg-canvas-subtle border border-border text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
                >
                  <AppIcon name={copied ? 'check' : 'copy'} size={11} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <a
                  href={share.url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="share-open"
                  className="text-[10px] text-accent hover:underline flex items-center gap-1"
                >
                  <AppIcon name="external" size={9} /> Open
                </a>
                <button
                  type="button"
                  data-testid="share-stop"
                  onClick={stopShare}
                  className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Stop sharing
                </button>
              </div>
              <p className="text-[9px] text-ink-muted leading-relaxed" data-testid="share-note">
                Anyone with this link can view the preview only — files, settings and agent APIs stay
                private.
                {share.provider === 'serveo' && share.hint ? ` ${share.hint}` : ''}
              </p>
            </div>
          )}

          {!loading && !active && (
            <div className="space-y-2">
              {share && share.hint && (
                <p className="text-[10px] text-amber-400 leading-relaxed" data-testid="share-hint">
                  {share.hint}
                </p>
              )}
              <button
                type="button"
                data-testid="share-start"
                onClick={startShare}
                className="w-full px-2 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-colors cursor-pointer"
              >
                Create share link
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
