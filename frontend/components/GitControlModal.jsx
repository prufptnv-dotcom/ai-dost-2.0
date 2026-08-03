import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Clock, RotateCcw, Plus, CheckCircle2, X, Shield, Sparkles } from 'lucide-react';
import api from '../services/api';

export default function GitControlModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('commit'); // 'commit' | 'history'
  const [commitMessage, setCommitMessage] = useState('');
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');

  const initGitRepo = async () => {
    try {
      await api.post('/git/init');
    } catch (e) {
      console.warn("Git init warning:", e.message);
    }
  };

  const fetchGitLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/git/log');
      if (res.data?.success) {
        setCommits(res.data.commits || []);
      }
    } catch (e) {
      console.warn("Failed to fetch git logs:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    // Defer to avoid synchronous setState-in-effect lint error
    const timer = setTimeout(() => {
      fetchGitLogs();
      initGitRepo();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleCreateCommit = async (e) => {
    e?.preventDefault();
    if (!commitMessage.trim()) return;

    try {
      setLoading(true);
      setStatusText('Staging files and creating local commit...');
      const res = await api.post('/git/commit', { message: commitMessage.trim() });
      if (res.data?.success) {
        setStatusText(res.data.message || 'Local Git snapshot created successfully!');
        setCommitMessage('');
        fetchGitLogs();
        setActiveTab('history');
      } else {
        setStatusText(res.data?.error || 'Failed to create local commit');
      }
    } catch (err) {
      setStatusText(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutCommit = async (hash) => {
    if (!confirm(`Are you sure you want to restore workspace to local commit [${hash}]?`)) return;

    try {
      setLoading(true);
      setStatusText(`Restoring workspace to local commit [${hash}]...`);
      const res = await api.post('/git/checkout', { hash });
      if (res.data?.success) {
        setStatusText(`Restored to commit [${hash}]! Workspace updated.`);
        fetchGitLogs();
      } else {
        setStatusText(res.data?.error || 'Checkout failed');
      }
    } catch (err) {
      setStatusText(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn select-text">
      <div className="w-full max-w-2xl bg-bg-card border border-primary/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col max-h-[85vh] h-auto my-auto overflow-hidden relative noise-overlay">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--color-bg-glass)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-[0_0_12px_var(--color-primary-glow)]">
              <div className="w-full h-full bg-bg-default rounded-[10px] flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Local Git Version Control 🌿
              </h2>
              <p className="text-xs text-text-muted">100% offline local git commits & rollback timeline</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-hover transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-border px-6 bg-bg-default shrink-0">
          <button
            onClick={() => setActiveTab('commit')}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'commit' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Plus className="w-4 h-4" /> Create Snapshot
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === 'history' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Clock className="w-4 h-4" /> Commit Timeline ({commits.length})
          </button>
        </div>

        {/* Tab 1: Create Local Commit */}
        {activeTab === 'commit' && (
          <form onSubmit={handleCreateCommit} className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-primary">Commit Snapshot Message:</label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Example: Added Pomodoro Timer component & fixed layout bugs"
                className="w-full h-11 px-4 bg-bg-hover text-text-primary border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {statusText && (
              <div className="p-3 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{statusText}</span>
              </div>
            )}

            <div className="p-4 glass-card rounded-xl border border-border space-y-2 text-xs text-text-secondary leading-relaxed">
              <div className="font-bold text-text-primary flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-success" /> 100% Local Machine Storage
              </div>
              <p>
                Aapke sabhi file changes local `.git` repository me safe save hote hain. Iske liye remote GitHub push ki zaroorat nahi hai.
              </p>
            </div>

            <div className="mt-auto flex justify-end">
              <button
                type="submit"
                disabled={!commitMessage.trim() || loading}
                className="gradient-btn px-6 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <GitCommit className="w-4 h-4" /> Create Local Commit
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Commit Timeline History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {commits.length === 0 ? (
              <div className="text-center py-16 text-xs text-text-muted">
                No local git commits recorded yet. Create your first snapshot above!
              </div>
            ) : (
              commits.map((c, i) => (
                <div key={i} className="glass-card p-4 rounded-xl border border-border hover:border-primary/40 transition flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/20 text-primary font-mono text-[10px] rounded font-bold">{c.hash}</span>
                      <span className="text-xs font-bold text-text-primary truncate">{c.message}</span>
                    </div>
                    <div className="text-[10px] text-text-muted flex items-center gap-3">
                      <span>👤 {c.author}</span>
                      <span>⏰ {c.date}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleCheckoutCommit(c.hash)}
                    className="px-3 py-1.5 bg-bg-hover hover:bg-warning/20 border border-border hover:border-warning/40 text-text-secondary hover:text-warning text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Rollback workspace to this commit"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
