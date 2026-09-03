import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  History, MessageSquare, Trash2, Clock, Loader2,
  ChevronDown, ChevronRight, Search, RefreshCw, X, ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { SkeletonCard } from '../ui/Skeleton';

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  if (isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HistoryView({ onToast, onOpenSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const showToast = useMemo(() => onToast || ((m, t) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: t || 'success', message: m } }));
    }
  }), [onToast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/chat/history', { params: { session_id: 'default', limit: 100 } });
      const rows = Array.isArray(res.data) ? res.data : (res.data?.history || []);
      const grouped = {};
      for (const row of rows) {
        const sess = row.session_id || 'default';
        if (!grouped[sess]) grouped[sess] = { session: sess, messages: [], updatedAt: 0 };
        grouped[sess].messages.push(row);
        const t = new Date(row.timestamp || row.created_at || 0).getTime();
        if (t > grouped[sess].updatedAt) grouped[sess].updatedAt = t;
      }
      const list = Object.values(grouped).sort((a, b) => b.updatedAt - a.updatedAt);
      setSessions(list);
      if (list.length > 0) setExpanded(list[0].session);
    } catch (e) {
      setSessions([]);
      showToast('Could not load history from backend', 'warning');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmClearHistory = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await api.delete('/chat/history', { params: { session_id: 'default' } });
      setSessions([]);
      setExpanded(null);
      setShowClearConfirm(false);
      showToast('History cleared', 'success');
    } catch (e) {
      showToast('Delete failed', 'error');
    } finally {
      setClearing(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.session.toLowerCase().includes(q) || s.messages.some((m) => (m.content || m.message || '').toLowerCase().includes(q));
  });

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 bg-canvas-base select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-paper-100 font-display">
              Conversation & Task History
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              Chronological log of multi-turn conversations and autonomous supervisor runs saved locally in SQLite.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              onClick={load}
              disabled={loading}
            >
              Refresh
            </Button>
            {sessions.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => setShowClearConfirm(true)}
              >
                Clear History
              </Button>
            )}
          </div>
        </div>

        {/* Filter Input */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xs bg-canvas-surface border border-border">
          <Search className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations by keyword or query..."
            className="w-full bg-transparent text-xs font-sans text-paper-100 placeholder:text-ink-muted focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-ink-muted hover:text-paper-100"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* History List */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No conversation history found"
            description="Start a chat or execute an agent task to begin archiving records."
          />
        ) : (
          <div className="space-y-3">
            {filteredSessions.map((s) => {
              const isExpanded = expanded === s.session;
              const firstMsg = s.messages[0]?.content || s.messages[0]?.message || 'Conversation Session';

              return (
                <div
                  key={s.session}
                  className="rounded-sm border border-border bg-canvas-surface overflow-hidden shadow-xs transition-fast"
                >
                  {/* Session Header Row */}
                  <div
                    onClick={() => setExpanded(isExpanded ? null : s.session)}
                    className="flex items-center justify-between px-4 py-3 bg-canvas-subtle hover:bg-canvas-elevated transition-fast cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <span className="text-ink-muted">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </span>
                      <MessageSquare className="w-4 h-4 text-accent-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-paper-100 truncate">
                          {firstMsg.slice(0, 80)}
                        </div>
                        <div className="text-[10px] font-mono text-ink-muted">
                          Session: {s.session} • {s.messages.length} messages
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-ink-muted flex-shrink-0">
                      {timeAgo(s.updatedAt)}
                    </div>
                  </div>

                  {/* Messages Timeline */}
                  {isExpanded && (
                    <div className="p-4 space-y-2.5 bg-canvas-base border-t border-border-subtle font-sans text-xs">
                      {s.messages.map((m, idx) => {
                        const isUser = m.role === 'user';
                        const text = m.content || m.message || '';
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xs border leading-relaxed ${
                              isUser
                                ? 'bg-canvas-surface border-border text-paper-100'
                                : 'bg-canvas-subtle border-border-subtle text-paper-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted mb-1">
                              <span className="uppercase font-semibold text-accent-primary">
                                {isUser ? 'User' : 'AI-Dost'}
                              </span>
                              <span>{timeAgo(m.timestamp || m.created_at)}</span>
                            </div>
                            <div className="whitespace-pre-wrap">{text}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Clear History Confirmation Modal */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All History"
        subtitle="This action will remove all saved chat sessions."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted leading-relaxed">
            Are you sure you want to delete all recorded conversation history? Your chat sessions stored in local SQLite will be permanently cleared.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowClearConfirm(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={confirmClearHistory}
              disabled={clearing}
            >
              {clearing ? 'Clearing...' : 'Clear All History'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}