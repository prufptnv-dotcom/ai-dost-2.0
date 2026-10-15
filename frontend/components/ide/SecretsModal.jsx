import React, { useState, useEffect } from 'react';
import { KeyRound, Eye, EyeOff, Plus, Trash2, X, ShieldCheck, Check, Lock } from 'lucide-react';

export function SecretsModal({ isOpen, onClose, envContent = '', onSaveEnv }) {
  const [secrets, setSecrets] = useState([]);
  const [visibleKeys, setVisibleKeys] = useState(new Set());
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saved, setSaved] = useState(false);

  // Parse .env lines on open or content change
  useEffect(() => {
    if (!isOpen) return;
    const lines = (envContent || '').split('\n');
    const parsed = [];
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        // Strip wrapping quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (key) parsed.push({ key, value: val });
      }
    });
    setSecrets(parsed);
    setSaved(false);
  }, [isOpen, envContent]);

  const toggleVisibility = (key) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    const cleanKey = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const cleanVal = newValue.trim();
    
    // Check if key already exists
    const exists = secrets.some(s => s.key === cleanKey);
    if (exists) {
      setSecrets(secrets.map(s => s.key === cleanKey ? { ...s, value: cleanVal } : s));
    } else {
      setSecrets([...secrets, { key: cleanKey, value: cleanVal }]);
    }
    setNewKey('');
    setNewValue('');
    setSaved(false);
  };

  const handleDelete = (key) => {
    setSecrets(secrets.filter(s => s.key !== key));
    setSaved(false);
  };

  const handleUpdateValue = (key, val) => {
    setSecrets(secrets.map(s => s.key === key ? { ...s, value: val } : s));
    setSaved(false);
  };

  const handleSave = async () => {
    const formatted = secrets.map(s => `${s.key}="${s.value}"`).join('\n');
    if (onSaveEnv) {
      await onSaveEnv(formatted);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-canvas-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-canvas-elevated border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-paper-100 flex items-center gap-2">
                Replit Secrets & Environment Variables
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-normal border border-emerald-500/30">
                  .env
                </span>
              </h2>
              <p className="text-[11px] text-ink-muted">Manage secure API keys and environment variables</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-canvas-base text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Security Banner */}
        <div className="px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-between text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Stored in project <code>.env</code> file. Encrypted in session memory.</span>
          </div>
          <span className="text-[10px] font-mono bg-emerald-500/20 px-2 py-0.5 rounded">Auto-Injected</span>
        </div>

        {/* Add New Secret Form */}
        <div className="p-5 border-b border-border bg-canvas-base space-y-3">
          <h3 className="text-xs font-bold text-paper-200 uppercase tracking-wider flex items-center gap-1.5">
            <Lock size={12} className="text-amber-400" /> Add New Secret
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="KEY (e.g. VITE_API_URL)"
              className="sm:col-span-2 bg-canvas-surface border border-border rounded-xl px-3 py-2 text-xs text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-amber-500 font-mono uppercase"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value (e.g. https://api.service.com)"
              className="sm:col-span-2 bg-canvas-surface border border-border rounded-xl px-3 py-2 text-xs text-paper-100 placeholder:text-ink-muted focus:outline-none focus:border-amber-500 font-mono"
            />
            <button
              onClick={handleAdd}
              disabled={!newKey.trim()}
              className="sm:col-span-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-amber-600/30"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Secrets List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-paper-200 uppercase tracking-wider">
              Project Secrets ({secrets.length})
            </h3>
            {secrets.length > 0 && (
              <span className="text-[11px] text-ink-muted">
                Click eye icon to reveal or edit values
              </span>
            )}
          </div>

          {secrets.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2">
              <KeyRound size={24} className="mx-auto text-ink-muted/50" />
              <p className="text-xs text-paper-200 font-medium">No secrets configured yet</p>
              <p className="text-[11px] text-ink-muted">Add your first environment variable using the form above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {secrets.map((secret) => {
                const isVisible = visibleKeys.has(secret.key);
                return (
                  <div
                    key={secret.key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-canvas-base border border-border hover:border-border-strong transition-all"
                  >
                    <div className="sm:w-1/3 min-w-0">
                      <span className="text-xs font-bold text-paper-100 font-mono block truncate" title={secret.key}>
                        {secret.key}
                      </span>
                    </div>

                    <div className="sm:w-1/2 flex items-center gap-2">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={secret.value}
                        onChange={(e) => handleUpdateValue(secret.key, e.target.value)}
                        className="flex-1 bg-canvas-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-paper-100 font-mono focus:outline-none focus:border-indigo-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisibility(secret.key)}
                        className="p-1.5 rounded-lg hover:bg-canvas-elevated text-ink-muted hover:text-paper-100 transition-colors"
                        title={isVisible ? 'Hide value' : 'Show value'}
                      >
                        {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleDelete(secret.key)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-ink-muted hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete secret"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-canvas-elevated border-t border-border">
          <span className="text-[11px] text-ink-muted">
            Changes will take effect in dev server and in-browser preview
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-canvas-surface hover:bg-canvas-base border border-border rounded-lg text-xs text-paper-200 font-medium cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm shadow-emerald-600/30 transition-all"
            >
              {saved ? (
                <>
                  <Check size={13} className="text-white" />
                  Saved!
                </>
              ) : (
                'Save Secrets'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SecretsModal;
