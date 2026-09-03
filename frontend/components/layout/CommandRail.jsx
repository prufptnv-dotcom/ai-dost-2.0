import React, { useState, useEffect } from 'react';
import {
  Plus, Search, History, Settings, Moon, Sun, MessageSquare,
  Pencil, Trash2, Share2, Check, X, PanelLeftClose
} from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export function CommandRail({
  currentView = 'chat',
  onSelectView,
  onNewChat,
  onOpenCommandPalette,
  onToggleTheme,
  theme = 'dark',
  onToggleCollapse,
}) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    const loadSessions = () => {
      try {
        const stored = localStorage.getItem('ai_dost_chat_sessions');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setSessions(parsed);
        }
        const active = localStorage.getItem('ai_dost_session_id');
        if (active) setActiveSessionId(active);
      } catch (_) {}
    };

    loadSessions();
    window.addEventListener('storage', loadSessions);
    window.addEventListener('ai_dost_sessions_updated', loadSessions);
    return () => {
      window.removeEventListener('storage', loadSessions);
      window.removeEventListener('ai_dost_sessions_updated', loadSessions);
    };
  }, []);

  const handleSelectSession = (s) => {
    if (editingId === s.id) return;
    try {
      localStorage.setItem('ai_dost_session_id', s.id);
      setActiveSessionId(s.id);
      window.dispatchEvent(new CustomEvent('ai_dost_switch_session', { detail: s.id }));
    } catch (_) {}
    onSelectView?.('chat');
  };

  const handleStartRename = (e, s) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title || s.name || '');
  };

  const handleSaveRename = (e, s) => {
    e.stopPropagation();
    const newName = editTitle.trim() || s.title || s.name || 'Conversation';
    const updated = sessions.map((item) =>
      item.id === s.id ? { ...item, title: newName, name: newName } : item
    );
    setSessions(updated);
    setEditingId(null);
    try {
      localStorage.setItem('ai_dost_chat_sessions', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated'));
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Chat renamed successfully' } }));
    } catch (_) {}
  };

  const handleDeleteSession = (e, s) => {
    e.stopPropagation();
    const updated = sessions.filter((item) => item.id !== s.id);
    setSessions(updated);
    try {
      localStorage.setItem('ai_dost_chat_sessions', JSON.stringify(updated));
      localStorage.removeItem(`ai_dost_messages_${s.id}`);
      window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated'));
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Chat deleted' } }));

      if (activeSessionId === s.id) {
        if (updated.length > 0) {
          handleSelectSession(updated[0]);
        } else {
          onNewChat?.();
        }
      }
    } catch (_) {}
  };

  const handleShareSession = (e, s) => {
    e.stopPropagation();
    try {
      const msgsRaw = localStorage.getItem(`ai_dost_messages_${s.id}`);
      const msgs = msgsRaw ? JSON.parse(msgsRaw) : [];
      const title = s.title || s.name || 'AI-Dost Chat';
      const shareText = `--- ${title} (AI-Dost) ---\n\n` +
        msgs.filter(m => m.role && m.content).map(m => `${m.role === 'user' ? 'User' : 'AI-Dost'}: ${m.content}`).join('\n\n');

      navigator.clipboard.writeText(shareText || window.location.href);
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Chat content copied to clipboard for sharing!' } }));
    } catch (_) {
      navigator.clipboard.writeText(window.location.href);
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Chat link copied!' } }));
    }
  };

  return (
    <aside className="chat-sidebar" aria-label="Sidebar navigation">
      <div className="chat-sidebar-top">
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            className="chat-brand"
            onClick={() => onSelectView?.('chat')}
            aria-label="AI-Dost home"
          >
            <AiDostMark size={22} />
            <span>AI-Dost</span>
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
              title="Hide sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="chat-new-button"
          onClick={onNewChat}
          aria-label="New chat"
        >
          <Plus size={16} />
          <span>New chat</span>
        </button>

        <button
          type="button"
          className="chat-search-button"
          onClick={onOpenCommandPalette}
          aria-label="Search chats"
        >
          <Search size={15} />
          <span>Search chats</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>

      <div className="chat-sidebar-middle">
        <div className="chat-sidebar-label">Recent</div>
        {sessions.length > 0 ? (
          <div className="space-y-0.5">
            {sessions.slice(0, 25).map((s) => {
              const displayName = s.title || s.name || 'Conversation';
              const isActive = activeSessionId === s.id && currentView === 'chat';

              if (editingId === s.id) {
                return (
                  <div key={s.id} className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-canvas-surface border border-accent-primary">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(e, s);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 bg-transparent text-xs text-txt-primary focus:outline-none min-w-0"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSaveRename(e, s)}
                      className="p-1 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                      title="Save name"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                      className="p-1 text-ink-muted hover:text-paper-100 cursor-pointer"
                      title="Cancel"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  className={`chat-sidebar-session-item group relative flex items-center justify-between ${
                    isActive ? 'active' : ''
                  }`}
                  title={displayName}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare size={13} className="shrink-0 opacity-70" />
                    <span className="truncate text-xs">{displayName}</span>
                  </div>

                  {/* Actions on hover */}
                  <div className="hidden group-hover:flex items-center gap-1 pl-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(e, s)}
                      className="p-1 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                      title="Rename chat"
                      aria-label="Rename chat"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleShareSession(e, s)}
                      className="p-1 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                      title="Share chat"
                      aria-label="Share chat"
                    >
                      <Share2 size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, s)}
                      className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-canvas-elevated transition-colors cursor-pointer"
                      title="Delete chat"
                      aria-label="Delete chat"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-2 py-3 text-[11px] text-ink-muted select-none">
            No recent chats
          </div>
        )}
      </div>

      <div className="chat-sidebar-bottom">
        <button
          type="button"
          onClick={() => onSelectView?.('history')}
          aria-label="History"
          className="chat-sidebar-icon-button"
          title="Chat History"
        >
          <History size={16} />
        </button>
        <button
          type="button"
          onClick={() => onSelectView?.('settings')}
          aria-label="Settings"
          className="chat-sidebar-icon-button"
          title="Settings"
        >
          <Settings size={16} />
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="chat-sidebar-icon-button ml-auto"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </aside>
  );
}

export default CommandRail;