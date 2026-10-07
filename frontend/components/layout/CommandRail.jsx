import React, { useState, useEffect } from 'react';
import AppIcon from '../ui/AppIcon';
import { AiDostMark } from '../brand/AiDostMark';
import CapabilitiesHubModal from './CapabilitiesHubModal';

const SECONDARY_STUDIO_LABELS = {
  images: 'Image Studio',
  animations: '3D Motion Studio',
  writing: 'Writing Studio',
  resume: 'Resume Builder',
  analytics: 'Data Analytics',
  planner: 'Productivity Planner',
  decision: 'Decision Matrix',
  artifacts: 'Artifacts Gallery',
  bharat: 'Bharat Open APIs',
  language: 'Language Hub',
  travel: 'Travel Explorer',
  security: 'Security Hub',
  capabilities: '50-Domain Catalog',
  skills: 'Skills Marketplace',
  automations: 'Automations',
  mcp: 'MCP Integrations',
  voice: 'Voice Studio',
};

// P2 #80/#81: default session messages live under 'ai_dost_messages_chat'
// (ChatView.jsx:20-23) — plain `ai_dost_messages_${id}` misses them, so
// delete left the default transcript behind and share exported nothing.
const getMsgKey = (id) => (id === 'default' ? 'ai_dost_messages_chat' : `ai_dost_messages_${id}`);

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
  const [studiosOpen, setStudiosOpen] = useState(false);

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
      localStorage.setItem('copilot_current_session_id', s.id);
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
      localStorage.removeItem(getMsgKey(s.id));

      // Remove corresponding workspace files and sessions from copilot storage
      const copilotSessionsRaw = localStorage.getItem('copilot_sessions_v2');
      if (copilotSessionsRaw) {
        try {
          const parsedCopilot = JSON.parse(copilotSessionsRaw);
          if (Array.isArray(parsedCopilot)) {
            const filteredCopilot = parsedCopilot.filter(item => item.id !== s.id && item.id !== `workspace_${s.id}`);
            localStorage.setItem('copilot_sessions_v2', JSON.stringify(filteredCopilot));
          }
        } catch (_) {}
      }

      // Backend API cleanup for chat history, project files, and copilot sessions
      fetch(`/api/chat/history?session_id=${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {});
      fetch(`/api/memory/project/${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {});
      fetch(`/api/copilot/sessions/${encodeURIComponent(s.id)}`, { method: 'DELETE' }).catch(() => {});

      window.dispatchEvent(new CustomEvent('ai_dost_sessions_updated'));
      window.dispatchEvent(new CustomEvent('ai_dost_toast', { detail: { type: 'success', message: 'Chat and workspace deleted' } }));

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
      const msgsRaw = localStorage.getItem(getMsgKey(s.id));
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

  const isSecondaryStudio = Boolean(SECONDARY_STUDIO_LABELS[currentView]);
  const activeStudioLabel = SECONDARY_STUDIO_LABELS[currentView] || 'Studios & Tools';

  return (
    <>
      <aside className="chat-sidebar" aria-label="Sidebar navigation">
        <div className="chat-sidebar-top">
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              className="chat-brand"
              onClick={() => onSelectView?.('chat')}
              aria-label="AI-Dost home"
            >
              <AiDostMark size={24} />
              <span className="text-[14px] font-semibold text-paper-100 tracking-wide">AI-Dost</span>
            </button>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
                title="Hide sidebar (Ctrl+B)"
                aria-label="Collapse sidebar"
              >
                <AppIcon name="collapse" size={16} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 mt-4 mb-3 py-2.5 rounded-xl bg-accent text-white font-semibold text-[13px] hover:bg-accent-hover transition-all shadow-[0_0_16px_-4px_rgba(99,102,241,0.4)] hover:shadow-[0_0_20px_-4px_rgba(99,102,241,0.5)] active:scale-[0.98]"
            onClick={onNewChat}
            aria-label="New chat"
          >
            <AppIcon name="plus" size={14} />
            <span>New chat</span>
          </button>

          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-canvas-base border border-border-subtle text-ink-muted text-xs hover:text-paper-200 hover:border-border transition-colors cursor-pointer"
            onClick={onOpenCommandPalette}
            aria-label="Search chats"
          >
            <AppIcon name="search" size={13} />
            <span className="flex-1 text-left">Search & actions</span>
            <kbd className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-canvas-surface border border-border opacity-70">Ctrl K</kbd>
          </button>
        </div>

        {/* ─── Zen Primary Workspace Navigation (Linear / Cursor Tier) ─── */}
        <div className="px-2 pt-1 pb-2 space-y-0.5 border-b border-border/40">
          <button
            type="button"
            onClick={() => onSelectView?.('chat')}
            className={`chat-sidebar-session-item flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer w-full ${
              currentView === 'chat' ? 'active font-semibold' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
          >
            <AppIcon name="message" size={14} className={currentView === 'chat' ? 'text-accent' : 'opacity-70'} />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView?.('copilot')}
            className={`chat-sidebar-session-item flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer w-full ${
              currentView === 'copilot' ? 'active font-semibold' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
          >
            <AppIcon name="code" size={14} className={currentView === 'copilot' ? 'text-accent' : 'opacity-70'} />
            <span>Copilot IDE</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView?.('agent')}
            className={`chat-sidebar-session-item flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer w-full ${
              currentView === 'agent' ? 'active font-semibold' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
          >
            <AppIcon name="bot" size={14} className={currentView === 'agent' ? 'text-accent' : 'opacity-70'} />
            <span>Agent Workbench</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView?.('projects')}
            className={`chat-sidebar-session-item flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer w-full ${
              currentView === 'projects' ? 'active font-semibold' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
          >
            <AppIcon name="folderOpen" size={14} className={currentView === 'projects' ? 'text-accent' : 'opacity-70'} />
            <span>Projects</span>
          </button>

          <button
            type="button"
            onClick={() => setStudiosOpen(true)}
            className={`chat-sidebar-session-item flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer w-full ${
              isSecondaryStudio ? 'active font-semibold' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AppIcon name="sparkles" size={14} className={isSecondaryStudio ? 'text-accent' : 'text-accent/80'} />
              <span className="truncate">{isSecondaryStudio ? activeStudioLabel : 'Studios & Tools'}</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono shrink-0">
              {isSecondaryStudio ? 'Active' : '15'}
            </span>
          </button>
        </div>

        {/* ─── Recent Chats ─── */}
        <div className="chat-sidebar-middle">
          <div className="chat-sidebar-label">Recent Chats</div>
          {sessions.length > 0 ? (
            <div className="space-y-0.5">
              {sessions.slice(0, 25).map((s) => {
                const displayName = s.title || s.name || 'Conversation';
                const isActive = activeSessionId === s.id && currentView === 'chat';

                if (editingId === s.id) {
                  return (
                    <div key={s.id} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-canvas-surface border border-accent/30">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(e, s);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-transparent text-xs text-paper-100 focus:outline-none min-w-0"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(e, s)}
                        className="p-1 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                        title="Save name"
                      >
                        <AppIcon name="check" size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                        className="p-1 text-ink-muted hover:text-paper-100 cursor-pointer"
                        title="Cancel"
                      >
                        <AppIcon name="close" size={12} />
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
                      <AppIcon name="message" size={13} className="shrink-0 opacity-70" />
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
                        <AppIcon name="pencil" size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleShareSession(e, s)}
                        className="p-1 rounded text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
                        title="Share chat"
                        aria-label="Share chat"
                      >
                        <AppIcon name="share" size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(e, s)}
                        className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-canvas-elevated transition-colors cursor-pointer"
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <AppIcon name="trash" size={11} />
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

        {/* ─── Bottom Utilities ─── */}
        <div className="chat-sidebar-bottom">
          <button
            type="button"
            onClick={() => onSelectView?.('history')}
            aria-label="History"
            className="chat-sidebar-icon-button"
            title="Chat History"
          >
            <AppIcon name="history" size={16} />
          </button>
          <button
            type="button"
            onClick={() => onSelectView?.('settings')}
            aria-label="Settings"
            className="chat-sidebar-icon-button"
            title="Settings"
          >
            <AppIcon name="settings" size={16} />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Current theme: ${theme}. Click to change theme.`}
            className="chat-sidebar-icon-button ml-auto"
            title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
          >
            <span key={theme} className="inline-flex anim-pop transition-transform duration-200 hover:scale-110 hover:-rotate-6">
              {theme === 'dark' && <AppIcon name="moon" size={16} />}
              {theme === 'light' && <AppIcon name="sun" size={16} />}
              {theme === 'hacker' && <AppIcon name="terminal" size={16} />}
              {theme === 'ocean' && <AppIcon name="droplets" size={16} />}
            </span>
          </button>
        </div>
      </aside>

      {/* Capabilities Hub Modal */}
      <CapabilitiesHubModal
        isOpen={studiosOpen}
        onClose={() => setStudiosOpen(false)}
        onSelectView={onSelectView}
        currentView={currentView}
      />
    </>
  );
}

export default CommandRail;