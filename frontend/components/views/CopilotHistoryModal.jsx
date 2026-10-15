'use client';

import React, { useState, useMemo } from 'react';
import {
  History, Clock, MessageSquare, FileCode, CheckCircle2,
  Trash2, Edit3, Check, X, ExternalLink, Plus, Search,
  ChevronRight, Sparkles, FolderArchive, ArrowRight, Copy
} from 'lucide-react';

export default function CopilotHistoryModal({
  isOpen,
  onClose,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onDuplicateSession,
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!q) return sorted;
    return sorted.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.promptSummary || '').toLowerCase().includes(q) ||
      (s.files || []).some(f => (f.path || '').toLowerCase().includes(q))
    );
  }, [sessions, search]);

  if (!isOpen) return null;

  const handleStartRename = (s, e) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title || 'Untitled Session');
  };

  const handleSaveRename = (id, e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession?.(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-canvas-surface/95 border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-canvas-base/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center border border-accent/25 shadow-xs">
              <History size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-paper-100 flex items-center gap-2">
                Copilot IDE History
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-canvas-elevated text-ink-muted border border-border">
                  {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                </span>
              </h2>
              <p className="text-[11px] text-ink-muted">
                Switch between past builds, restore code, preview and chat contexts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewSession?.();
                onClose?.();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-hover text-white transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
            >
              <Plus size={13} />
              <span>New Session</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-border bg-canvas-base/30">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search past sessions by title, prompt or file..."
              className="w-full pl-9 pr-3 py-1.5 bg-canvas-base border border-border rounded-xl text-xs text-paper-100 placeholder:text-ink-muted/60 focus:outline-none focus:border-accent font-sans transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-paper-100"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-canvas-elevated border border-border flex items-center justify-center mx-auto text-ink-muted">
                <FolderArchive size={20} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-paper-200">
                  {search ? 'No matching sessions found' : 'No saved sessions yet'}
                </p>
                <p className="text-[11px] text-ink-muted max-w-xs mx-auto">
                  {search ? 'Try adjusting your search query' : 'Start a project or chat with Copilot to automatically record sessions.'}
                </p>
              </div>
              {!search && (
                <button
                  onClick={() => {
                    onNewSession?.();
                    onClose?.();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent text-white cursor-pointer hover:bg-accent-hover transition-colors"
                >
                  <Plus size={13} />
                  <span>Start New Session</span>
                </button>
              )}
            </div>
          ) : (
            filteredSessions.map(session => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;
              const filesCount = (session.files || []).length;
              const messagesCount = (session.messages || []).length;

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    if (!isEditing) {
                      onSelectSession?.(session.id);
                      onClose?.();
                    }
                  }}
                  className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-accent/10 border-accent/40 shadow-sm'
                      : 'bg-canvas-base/80 hover:bg-canvas-elevated/70 border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left Details */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Active
                          </span>
                        )}

                        {isEditing ? (
                          <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              autoFocus
                              className="flex-1 px-2 py-0.5 bg-canvas-surface border border-accent rounded text-xs text-paper-100 focus:outline-none"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveRename(session.id, e);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                            />
                            <button
                              onClick={e => handleSaveRename(session.id, e)}
                              className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingId(null); }}
                              className="p-1 rounded text-ink-muted hover:bg-canvas-elevated"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <h3 className="text-xs font-semibold text-paper-100 truncate flex items-center gap-1.5">
                            {session.title || 'Untitled Session'}
                          </h3>
                        )}
                      </div>

                      {session.promptSummary && (
                        <p className="text-[11px] text-ink-muted truncate font-mono">
                          &quot;{session.promptSummary}&quot;
                        </p>
                      )}

                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-muted font-mono pt-0.5">
                        <span className="flex items-center gap-1 text-paper-200">
                          <Clock size={11} className="text-accent" />
                          {formatDate(session.updatedAt)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <FileCode size={11} />
                          {filesCount} {filesCount === 1 ? 'file' : 'files'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} />
                          {messagesCount} {messagesCount === 1 ? 'msg' : 'msgs'}
                        </span>
                        {session.activePath && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px] text-paper-300">
                              {session.activePath}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {!isEditing && (
                        <button
                          onClick={e => handleStartRename(session, e)}
                          className="p-1.5 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-colors opacity-0 group-hover:opacity-100"
                          title="Rename Session"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onDuplicateSession?.(session.id);
                        }}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-colors opacity-0 group-hover:opacity-100"
                        title="Duplicate Session"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Delete session "${session.title || 'Untitled'}"? This action cannot be undone.`)) {
                            onDeleteSession?.(session.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete Session"
                      >
                        <Trash2 size={12} />
                      </button>

                      <button
                        onClick={() => {
                          onSelectSession?.(session.id);
                          onClose?.();
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          isActive
                            ? 'bg-accent text-white shadow-xs'
                            : 'bg-canvas-surface group-hover:bg-accent group-hover:text-white text-paper-200 border border-border group-hover:border-accent'
                        }`}
                      >
                        <span>{isActive ? 'Loaded' : 'Open'}</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-border bg-canvas-base/50 flex items-center justify-between text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5 font-mono">
            <Sparkles size={12} className="text-accent" />
            Sessions auto-save on every prompt & code modification
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-canvas-elevated hover:bg-canvas-surface text-paper-200 text-xs font-medium cursor-pointer transition-colors border border-border"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
