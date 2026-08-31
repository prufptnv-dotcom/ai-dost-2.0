import React from 'react';
import { Plus, Search, History, Settings, Moon, Sun } from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export function CommandRail({
  currentView = 'chat',
  onSelectView,
  onNewChat,
  onOpenCommandPalette,
  onToggleTheme,
  theme = 'dark',
}) {
  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-top">
        <button
          type="button"
          className="chat-brand"
          onClick={() => onSelectView?.('chat')}
          aria-label="AI-Dost home"
        >
          <AiDostMark size={22} />
          <span>AI-Dost</span>
        </button>

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
        {/* Existing chat/session list can be rendered here. */}
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