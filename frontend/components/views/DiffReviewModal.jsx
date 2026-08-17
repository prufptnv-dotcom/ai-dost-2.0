import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { X, GitCompareArrows, RotateCcw, Loader2, AlertTriangle, Check } from 'lucide-react';
import api from '../../services/api';

const DiffEditor = dynamic(() => import('@monaco-editor/react').then(m => m.DiffEditor), { ssr: false });

const STATUS_COLOR = {
  added: '#34d399',
  modified: '#fbbf24',
  deleted: '#f87171',
};
const STATUS_LABEL = { added: 'A', modified: 'M', deleted: 'D' };

// ─────────────────────────────────────────────────────────────────────────────
// DiffReviewModal — agent run ke changes ka before/after diff (VS Code style)
// File list + Monaco DiffEditor + per-file revert + revert all
// ─────────────────────────────────────────────────────────────────────────────
export default function DiffReviewModal({ runId, onClose, onReverted }) {
  const [diffs, setDiffs] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reverting, setReverting] = useState(null);
  const [doneMsg, setDoneMsg] = useState('');

  const load = async () => {
    setError('');
    try {
      const r = await api.get(`/agent/run-diffs?runId=${encodeURIComponent(runId)}`);
      const d = Array.isArray(r.data?.diffs) ? r.data.diffs : [];
      setDiffs(d);
      setSel(prev => (prev && d.some(x => x.path === prev) ? prev : (d[0]?.path || null)));
    } catch (e) {
      setError(e?.detail || e?.message || 'Diffs load nahi hue');
      setDiffs([]);
    }
  };

  useEffect(() => {
    if (runId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Escape closes the modal (VS Code style)
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [busy, onClose]);

  const revert = async (path) => {
    setBusy(true);
    setReverting(path);
    setDoneMsg('');
    setSel(prev => (prev === path ? null : prev));
    try {
      await api.post('/agent/revert-file', { runId, path });
      onReverted?.();
      await load();
      setDoneMsg(`"${path}" pre-run state pe restore ho gaya`);
    } catch (e) {
      setError(e?.detail || e?.message || 'Revert fail');
    } finally {
      setBusy(false);
      setReverting(null);
    }
  };

  const revertAll = async () => {
    setBusy(true);
    setDoneMsg('');
    try {
      const r = await api.post('/agent/revert-all', { runId });
      onReverted?.();
      await load();
      setDoneMsg(`Sab revert: ${r.data?.restored ?? 0} restore, ${r.data?.removed ?? 0} remove`);
    } catch (e) {
      setError(e?.detail || e?.message || 'Revert fail');
    } finally {
      setBusy(false);
    }
  };

  const selected = diffs?.find(d => d.path === sel) || null;
  const isDeleted = selected?.status === 'deleted';

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center pt-[7vh] bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[900px] max-w-[94vw] h-[82vh] rounded-xl overflow-hidden shadow-2xl animate-fadeIn flex flex-col"
        style={{ background: '#1c1f28', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <GitCompareArrows className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>Changes Review</span>
          {runId && <span className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>{runId}</span>}
          <span className="ml-auto flex items-center gap-2">
            {diffs && diffs.length > 0 && !busy && (
              <button
                onClick={revertAll}
                className="px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                title="Run ke saare changes undo karo"
              >
                <RotateCcw className="w-3 h-3 inline mr-1" />Revert All
              </button>
            )}
            <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--color-text-muted)' }} title="Close (Esc)">
              <X className="w-4 h-4" />
            </button>
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] shrink-0" style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}
        {doneMsg && (
          <div className="flex items-center gap-2 px-3 py-2 text-[11px] shrink-0" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
            <Check className="w-3.5 h-3.5 shrink-0" /> {doneMsg}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 flex">
          {/* File list */}
          <div className="w-56 shrink-0 overflow-y-auto py-1 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            {diffs === null && (
              <div className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin inline-block mb-1" /><br />Diffs load ho rahe hain...
              </div>
            )}
            {diffs !== null && diffs.length === 0 && (
              <div className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Is run me koi change nahi mila
              </div>
            )}
            {(diffs || []).map((d) => (
              <button
                key={d.path}
                onClick={() => setSel(d.path)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] cursor-pointer"
                style={{
                  background: sel === d.path ? 'rgba(75,139,252,0.18)' : 'transparent',
                  color: sel === d.path ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                <span
                  className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ background: `${STATUS_COLOR[d.status]}22`, color: STATUS_COLOR[d.status], border: `1px solid ${STATUS_COLOR[d.status]}55` }}
                >
                  {STATUS_LABEL[d.status]}
                </span>
                <span className="truncate">{d.path}</span>
                {reverting === d.path && <Loader2 className="w-3 h-3 animate-spin ml-auto shrink-0" />}
              </button>
            ))}
          </div>

          {/* Diff viewer */}
          <div className="flex-1 min-w-0 flex flex-col">
            {selected ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {selected.path}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: `${STATUS_COLOR[selected.status]}22`, color: STATUS_COLOR[selected.status] }}>
                    {selected.status}
                  </span>
                  {isDeleted && <span className="text-[10px] shrink-0" style={{ color: '#f87171' }}>— file delete ho gayi</span>}
                  <button
                    onClick={() => revert(selected.path)}
                    disabled={busy}
                    className="ml-auto px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
                    style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                    title="Is file ko pre-run state pe wapas karo"
                  >
                    <RotateCcw className="w-3 h-3 inline mr-1" />Revert File
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <DiffEditor
                    key={selected.path}
                    height="100%"
                    language="plaintext"
                    original={selected.old}
                    modified={selected.new}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      renderSideBySide: true,
                      automaticLayout: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: { top: 8 },
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {diffs === null ? 'Loading...' : 'Left side se file select karo'}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t shrink-0 flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
            Green = added • Yellow = modified • Red = deleted — revert karne pe file pre-run state pe wapas jaati hai
          </span>
          <button
            onClick={onClose}
            className="ml-auto px-3 py-1.5 rounded-md text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}