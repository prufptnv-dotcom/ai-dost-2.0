import { useState, useEffect, useRef } from 'react';
import { FilePlus2, FolderPlus, Pencil, Search, CornerDownLeft, Command as CommandIcon, File, FolderTree, FileSearch, CaseSensitive, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// PromptModal — window.prompt replacement (VS Code-style input dialog)
// ─────────────────────────────────────────────────────────────────────────────
export function PromptModal({ modal, onClose, onSubmit }) {
  const [value, setValue] = useState(modal?.initial || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (modal) {
      setValue(modal.initial || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modal]);

  if (!modal) return null;

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-96 rounded-xl p-4 shadow-2xl animate-fadeIn"
        style={{ background: '#1c1f28', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          {modal.icon}
          <span className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>{modal.title}</span>
        </div>
        {modal.hint && (
          <div className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>{modal.hint}</div>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={modal.placeholder}
          className="w-full h-9 px-3 rounded-lg text-xs focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(75,139,252,0.4)', color: 'var(--color-text-primary)' }}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="px-3 py-1.5 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-40 transition-opacity"
            style={{ background: 'var(--gradient-primary)', color: '#fff' }}
          >
            {modal.okLabel || 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuickOpen — Ctrl+P fuzzy file picker
// ─────────────────────────────────────────────────────────────────────────────
export function QuickOpen({ files, onPick, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const ql = q.trim().toLowerCase();
  const results = files
    .filter(f => !ql || f.path.toLowerCase().includes(ql))
    .slice(0, 30);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  if (!ql && idx >= results.length) setIdx(0);

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[13vh] bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-[520px] rounded-xl overflow-hidden shadow-2xl animate-fadeIn"
        style={{ background: '#1c1f28', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <Search className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && results[idx]) { onPick(results[idx]); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="File dhundho (fuzzy)..."
            className="flex-1 text-xs focus:outline-none bg-transparent"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>
            ↑↓ Enter Esc
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Koi file match nahi hui
            </div>
          )}
          {results.map((f, i) => (
            <button
              key={f.path}
              onMouseEnter={() => setIdx(i)}
              onClick={() => onPick(f)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] cursor-pointer"
              style={{
                background: i === idx ? 'rgba(75,139,252,0.18)' : 'transparent',
                color: i === idx ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              <File className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />
              <span className="truncate">{f.path}</span>
              {i === idx && <CornerDownLeft className="w-3 h-3 ml-auto shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CommandPalette — Ctrl+Shift+P searchable commands
// ─────────────────────────────────────────────────────────────────────────────
export function CommandPalette({ commands, onRun, onClose }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const ql = q.trim().toLowerCase();
  const results = commands.filter(c => !ql || c.label.toLowerCase().includes(ql));

  useEffect(() => { setIdx(0); }, [q]);

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[13vh] bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-[520px] rounded-xl overflow-hidden shadow-2xl animate-fadeIn"
        style={{ background: '#1c1f28', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <CommandIcon className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter' && results[idx]) { onRun(results[idx]); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Command dhundho..."
            className="flex-1 text-xs focus:outline-none bg-transparent"
            style={{ color: 'var(--color-text-primary)' }}
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-3 py-4 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Koi command match nahi hui
            </div>
          )}
          {results.map((c, i) => (
            <button
              key={c.label}
              onMouseEnter={() => setIdx(i)}
              onClick={() => onRun(c)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] cursor-pointer"
              style={{
                background: i === idx ? 'rgba(75,139,252,0.18)' : 'transparent',
                color: i === idx ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {c.icon || <FilePlus2 className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />}
              <span className="truncate">{c.label}</span>
              {c.key && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>
                  {c.key}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Shared icons for prompt modal types
export const MODAL_ICONS = {
  newFile: <FilePlus2 className="w-3.5 h-3.5 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />,
  newFolder: <FolderPlus className="w-3.5 h-3.5 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />,
  fileIn: <FilePlus2 className="w-3.5 h-3.5 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />,
  folderIn: <FolderPlus className="w-3.5 h-3.5 stroke-[1.5]" style={{ color: 'var(--color-primary)' }} />,
  rename: <Pencil className="w-3.5 h-3.5 stroke-[1.5]" style={{ color: 'var(--color-accent)' }} />,
};

// ─────────────────────────────────────────────────────────────────────────────
// SearchOverlay — Ctrl+Shift+F find-in-files (VS Code style)
// Results: [{ path, line, text }]; click → open file at line
// ─────────────────────────────────────────────────────────────────────────────
export function SearchOverlay({ q, onQueryChange, caseSensitive, onCaseChange, results, searching, onPick, onClose }) {
  const inputRef = useRef(null);
  const ql = q.trim().toLowerCase();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const highlight = (text) => {
    if (!ql || caseSensitive) {
      if (!caseSensitive || !q.trim()) return text;
      const i = text.indexOf(q.trim());
      if (i === -1) return text;
      return (
        <>
          {text.slice(0, i)}
          <span style={{ background: 'rgba(251,191,36,0.3)', color: 'var(--color-accent)' }}>{text.slice(i, i + q.trim().length)}</span>
          {text.slice(i + q.trim().length)}
        </>
      );
    }
    const i = text.toLowerCase().indexOf(ql);
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <span style={{ background: 'rgba(251,191,36,0.3)', color: 'var(--color-accent)' }}>{text.slice(i, i + q.length)}</span>
        {text.slice(i + q.length)}
      </>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[640px] max-w-[92vw] rounded-xl overflow-hidden shadow-2xl animate-fadeIn"
        style={{ background: '#1c1f28', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <FileSearch className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder="Files me dhundho... (Ctrl+Shift+F)"
            className="flex-1 text-xs focus:outline-none bg-transparent"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {searching && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: 'var(--color-info)' }} />}
          <button
            onClick={() => onCaseChange(!caseSensitive)}
            title="Case sensitive (Aa)"
            className="px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-all"
            style={{
              background: caseSensitive ? 'rgba(75,139,252,0.25)' : 'rgba(255,255,255,0.06)',
              border: caseSensitive ? '1px solid rgba(75,139,252,0.5)' : '1px solid transparent',
              color: caseSensitive ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            <CaseSensitive className="w-3.5 h-3.5 inline stroke-[1.5]" /> Aa
          </button>
          <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>
            Esc
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto py-1">
          {!q.trim() && (
            <div className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Search query type karo — workspace ke saare files me dhundhega
            </div>
          )}
          {q.trim() && !searching && results.length === 0 && (
            <div className="px-3 py-6 text-center text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Koi match nahi mila — {'"'}{q.trim()}{'"'}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.path}:${r.line}`}
              onClick={() => onPick(r)}
              className="w-full flex items-start gap-2.5 px-3 py-1.5 text-left text-[11px] cursor-pointer hover:opacity-90 transition-opacity"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <File className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
              <span className="flex-1 min-w-0">
                <span className="block truncate font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {r.path}
                  <span className="ml-2 text-[9px] font-normal" style={{ color: 'var(--color-text-muted)' }}>line {r.line}</span>
                </span>
                <span className="block truncate font-mono" style={{ color: 'var(--color-text-muted)' }}>
                  {highlight(r.text)}
                </span>
              </span>
              <CornerDownLeft className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--color-text-muted)' }} />
            </button>
          ))}
        </div>
        <div className="px-3 py-1.5 border-t text-[9px]" style={{ borderColor: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>
          {results.length} results • result click karo = file us line pe khulegi
        </div>
      </div>
    </div>
  );
}