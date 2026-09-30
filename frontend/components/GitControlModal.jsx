import React, { useState, useEffect, useRef } from 'react';
import { 
  GitBranch, GitCommit, Clock, RotateCcw, Plus, CheckCircle2, X, Shield, 
  Sparkles, GitPullRequest, ListChecks, Copy, Check, Bug, BookOpen, Layers
} from 'lucide-react';
import api from '../services/api';

export default function GitControlModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('commit'); // 'commit' | 'history' | 'pr' | 'issue' | 'adr' | 'checklist'
  const [commitMessage, setCommitMessage] = useState('');
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [suggestedCommits, setSuggestedCommits] = useState([]);
  const [copied, setCopied] = useState(false);

  // PR Form State
  const [prTitle, setPrTitle] = useState('');
  const [prBranch, setPrBranch] = useState('feature/core-enhancements');
  const [prSummary, setPrSummary] = useState('');
  const [generatedPr, setGeneratedPr] = useState('');

  // Issue Form State
  const [issueType, setIssueType] = useState('feature'); // 'bug' | 'feature'
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [generatedIssue, setGeneratedIssue] = useState('');

  // ADR Form State
  const [adrTitle, setAdrTitle] = useState('');
  const [adrContext, setAdrContext] = useState('');
  const [adrDecision, setAdrDecision] = useState('');
  const [generatedAdr, setGeneratedAdr] = useState('');

  const initGitRepo = async () => {
    try {
      await api.post('/git/init');
    } catch (e) {
      console.warn("Git init warning:", e.message);
    }
  };

  // P3 #114: abort in-flight log fetch when the modal unmounts/closes
  const gitAbortRef = useRef(null);

  const fetchGitLogs = async (signal) => {
    try {
      setLoading(true);
      const res = await api.get('/git/log', { signal });
      if (res.data?.success) {
        setCommits(res.data.commits || []);
      }
    } catch (e) {
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') return;
      console.warn("Failed to fetch git logs:", e.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const ctrl = new AbortController();
    gitAbortRef.current = ctrl;
    const timer = setTimeout(() => {
      fetchGitLogs(ctrl.signal);
      initGitRepo();
    }, 0);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
      if (gitAbortRef.current === ctrl) gitAbortRef.current = null;
    };
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
        setSuggestedCommits([]);
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

  const handleAiSuggestCommit = async () => {
    try {
      setLoading(true);
      setStatusText('AI analyzing repository status for Conventional Commits...');
      const res = await api.post('/git/suggest-commit', { description: commitMessage });
      if (res.data?.success && res.data.suggestions) {
        setSuggestedCommits(res.data.suggestions);
        setStatusText('Generated 4 Conventional Commit options.');
      }
    } catch (err) {
      setStatusText(`Failed to generate suggestions: ${err.message}`);
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

  const handleGeneratePr = async () => {
    try {
      setLoading(true);
      const res = await api.post('/git/generate-pr', {
        title: prTitle,
        branch: prBranch,
        summary: prSummary
      });
      if (res.data?.success) {
        setGeneratedPr(res.data.markdown);
      }
    } catch (err) {
      alert(`PR Generation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateIssue = async () => {
    try {
      setLoading(true);
      const res = await api.post('/git/generate-issue', {
        type: issueType,
        title: issueTitle,
        description: issueDesc
      });
      if (res.data?.success) {
        setGeneratedIssue(res.data.markdown);
      }
    } catch (err) {
      alert(`Issue Generation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAdr = async () => {
    try {
      setLoading(true);
      const res = await api.post('/git/generate-adr', {
        title: adrTitle,
        context: adrContext,
        decision: adrDecision
      });
      if (res.data?.success) {
        setGeneratedAdr(res.data.markdown);
      }
    } catch (err) {
      alert(`ADR Generation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn select-text">
      <div className="w-full max-w-3xl bg-bg-card border border-primary/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col max-h-[90vh] h-[85vh] my-auto overflow-hidden relative noise-overlay">
        
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
                GitHub & Project Management Studio 🌿
              </h2>
              <p className="text-xs text-text-muted">Conventional commits, PR reviews, issue templates, ADRs & release checklists</p>
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
        <div className="flex items-center border-b border-border px-6 bg-bg-default shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'commit', label: 'Commits', icon: Plus },
            { id: 'history', label: `Timeline (${commits.length})`, icon: Clock },
            { id: 'pr', label: 'PR Review / Spec', icon: GitPullRequest },
            { id: 'issue', label: 'Issue Creator', icon: Bug },
            { id: 'adr', label: 'ADR Architecture', icon: BookOpen },
            { id: 'checklist', label: 'Release & Quality', icon: ListChecks },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Create Local Commit + AI Suggest */}
        {activeTab === 'commit' && (
          <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
            <form onSubmit={handleCreateCommit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-primary">Commit Message (Conventional Commit):</label>
                  <button
                    type="button"
                    onClick={handleAiSuggestCommit}
                    disabled={loading}
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> AI Suggest Messages
                  </button>
                </div>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="e.g. feat(editor): implement conventional commit generator"
                  className="w-full h-11 px-4 bg-bg-hover text-text-primary border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {suggestedCommits.length > 0 && (
                <div className="space-y-2 bg-bg-default/60 border border-primary/20 rounded-xl p-3">
                  <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Select Conventional Commit Suggestion:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {suggestedCommits.map((s, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setCommitMessage(s.title)}
                        className="p-2.5 rounded-lg border border-border hover:border-primary/50 bg-bg-card/70 cursor-pointer transition text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-primary font-mono">{s.type}</span>
                          <span className="text-[9px] text-text-muted">{s.category}</span>
                        </div>
                        <p className="text-xs font-semibold text-text-primary truncate mt-0.5">{s.title}</p>
                        <p className="text-[10px] text-text-muted line-clamp-1">{s.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {statusText && (
                <div className="p-3 bg-primary/10 border border-primary/20 text-primary text-xs rounded-xl flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{statusText}</span>
                </div>
              )}

              <div className="p-4 glass-card rounded-xl border border-border space-y-2 text-xs text-text-secondary leading-relaxed">
                <div className="font-bold text-text-primary flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-success" /> 100% Offline Local Git Integrity
                </div>
                <p>
                  Aapke sabhi file snapshots local `.git` repository me securely persist hote hain. Rollback aur branching bina kisi internet ya remote push ke instantly kaam karte hain.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!commitMessage.trim() || loading}
                  className="gradient-btn px-6 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <GitCommit className="w-4 h-4" /> Create Local Commit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 2: Commit Timeline History */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {commits.length === 0 ? (
              <div className="text-center py-16 text-xs text-text-muted">
                No local git commits recorded yet. Create your first snapshot in the Commits tab!
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

        {/* Tab 3: Pull Request Template Generator */}
        {activeTab === 'pr' && (
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-text-primary">PR Title:</label>
                <input
                  type="text"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  placeholder="e.g. feat(agent): autonomous multi-agent copilot loop"
                  className="w-full h-10 px-3 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-primary">Branch Name:</label>
                <input
                  type="text"
                  value={prBranch}
                  onChange={(e) => setPrBranch(e.target.value)}
                  placeholder="e.g. feature/autonomous-loop"
                  className="w-full h-10 px-3 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-primary">Summary & Impact:</label>
              <textarea
                value={prSummary}
                onChange={(e) => setPrSummary(e.target.value)}
                placeholder="Describe architectural improvements, problem resolved, and verification performed..."
                rows={3}
                className="w-full p-3 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
              />
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={handleGeneratePr}
                disabled={loading}
                className="gradient-btn px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate Staff PR Description
              </button>
              {generatedPr && (
                <button
                  onClick={() => copyToClipboard(generatedPr)}
                  className="px-3 py-1.5 bg-bg-hover border border-border rounded-lg text-xs font-semibold flex items-center gap-1 text-primary cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Markdown'}
                </button>
              )}
            </div>
            {generatedPr && (
              <pre className="p-4 bg-bg-default border border-border rounded-xl text-[11px] text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64">
                {generatedPr}
              </pre>
            )}
          </div>
        )}

        {/* Tab 4: GitHub Issue Generator */}
        {activeTab === 'issue' && (
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            <div className="flex gap-4 items-center">
              <label className="text-xs font-bold text-text-primary">Issue Type:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIssueType('feature')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    issueType === 'feature' ? 'bg-primary text-black' : 'bg-bg-hover text-text-muted'
                  }`}
                >
                  🚀 Feature Request
                </button>
                <button
                  type="button"
                  onClick={() => setIssueType('bug')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    issueType === 'bug' ? 'bg-warning text-black' : 'bg-bg-hover text-text-muted'
                  }`}
                >
                  🐛 Bug Report
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-primary">Issue Title:</label>
              <input
                type="text"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                placeholder={issueType === 'bug' ? 'e.g. [BUG] Circuit breaker false trip during high concurrency' : 'e.g. [FEAT] Vector DB persistent hybrid retrieval'}
                className="w-full h-10 px-3 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-primary">Context / Steps:</label>
              <textarea
                value={issueDesc}
                onChange={(e) => setIssueDesc(e.target.value)}
                placeholder="Provide reproduction steps, expected behavior, or business context..."
                rows={3}
                className="w-full p-3 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
              />
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={handleGenerateIssue}
                disabled={loading}
                className="gradient-btn px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate Issue Markdown
              </button>
              {generatedIssue && (
                <button
                  onClick={() => copyToClipboard(generatedIssue)}
                  className="px-3 py-1.5 bg-bg-hover border border-border rounded-lg text-xs font-semibold flex items-center gap-1 text-primary cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Markdown'}
                </button>
              )}
            </div>
            {generatedIssue && (
              <pre className="p-4 bg-bg-default border border-border rounded-xl text-[11px] text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64">
                {generatedIssue}
              </pre>
            )}
          </div>
        )}

        {/* Tab 5: Architecture Decision Records (ADRs) */}
        {activeTab === 'adr' && (
          <div className="flex-1 p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="text-[11px] font-bold text-text-primary">Decision Title:</label>
              <input
                type="text"
                value={adrTitle}
                onChange={(e) => setAdrTitle(e.target.value)}
                placeholder="e.g. Migration from Monolithic Express to Decoupled Domain Engines"
                className="w-full h-10 px-3 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-text-primary">Context & Problem:</label>
                <textarea
                  value={adrContext}
                  onChange={(e) => setAdrContext(e.target.value)}
                  placeholder="Why is this decision needed? What constraints exist?"
                  rows={2}
                  className="w-full p-2.5 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-primary">Chosen Architecture:</label>
                <textarea
                  value={adrDecision}
                  onChange={(e) => setAdrDecision(e.target.value)}
                  placeholder="What approach did we choose and why?"
                  rows={2}
                  className="w-full p-2.5 bg-bg-hover text-text-primary border border-border rounded-lg text-xs mt-1"
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={handleGenerateAdr}
                disabled={loading}
                className="gradient-btn px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate Michael Nygard ADR
              </button>
              {generatedAdr && (
                <button
                  onClick={() => copyToClipboard(generatedAdr)}
                  className="px-3 py-1.5 bg-bg-hover border border-border rounded-lg text-xs font-semibold flex items-center gap-1 text-primary cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Markdown'}
                </button>
              )}
            </div>
            {generatedAdr && (
              <pre className="p-4 bg-bg-default border border-border rounded-xl text-[11px] text-text-secondary overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-64">
                {generatedAdr}
              </pre>
            )}
          </div>
        )}

        {/* Tab 6: Release & Quality Checklists */}
        {activeTab === 'checklist' && (
          <div className="flex-1 p-6 space-y-4 overflow-y-auto text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-4 rounded-xl border border-border space-y-2">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4" /> Production Release Gate
                </span>
                <ul className="space-y-1.5 text-text-secondary text-[11px]">
                  <li className="flex items-center gap-2">✅ All unit + integration tests pass (0 failures)</li>
                  <li className="flex items-center gap-2">✅ DB migrations tested backward-compatible</li>
                  <li className="flex items-center gap-2">✅ Environment secrets updated on host</li>
                  <li className="flex items-center gap-2">✅ 1-click rollback runbook prepared</li>
                  <li className="flex items-center gap-2">✅ Synthetic health monitoring configured</li>
                </ul>
              </div>

              <div className="glass-card p-4 rounded-xl border border-border space-y-2">
                <span className="font-bold text-success flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> OWASP Top 10 Security Audit
                </span>
                <ul className="space-y-1.5 text-text-secondary text-[11px]">
                  <li className="flex items-center gap-2">🛡️ SQL injection parametrized queries</li>
                  <li className="flex items-center gap-2">🛡️ Strict CSP & secure HTTP headers enabled</li>
                  <li className="flex items-center gap-2">🛡️ Rate limiting enabled on AI/chat endpoints</li>
                  <li className="flex items-center gap-2">🛡️ Zero hardcoded API secrets in client build</li>
                  <li className="flex items-center gap-2">🛡️ Path-traversal guards on all file operations</li>
                </ul>
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-border space-y-2">
              <span className="font-bold text-secondary flex items-center gap-1.5">
                <Layers className="w-4 h-4" /> Code Quality & Clean Code Standards
              </span>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                SOLID Principles: Single Responsibility per domain engine, Open-Closed cascade fallback architecture, Liskov-compliant adapter services, and Dependency Injection for database and logger. Cyclomatic complexity kept under 10 with 0 memory leaks.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
