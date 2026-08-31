import React from 'react';
import {
  MessageSquare, Bot, Code2, FolderKanban, FileText,
  Plus, Sun, Moon, Settings, User
} from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export function CommandRail({
  currentView = 'chat',
  onSelectView,
  onNewChat,
  theme = 'dark',
  onToggleTheme,
  className = '',
}) {
  const NAV_ITEMS = [
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'agent', label: 'Agent', icon: Bot },
    { id: 'copilot', label: 'IDE', icon: Code2 },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'artifacts', label: 'Artifacts', icon: FileText },
  ];

  return (
    <nav
      aria-label="Command Rail"
      className={`w-14 sm:w-16 h-full flex flex-col items-center justify-between py-3.5 bg-canvas-subtle border-r border-border select-none z-30 ${className}`}
    >
      {/* Top Section: Brand & Quick Action */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Brand Mark */}
        <button
          type="button"
          onClick={() => onSelectView && onSelectView('chat')}
          className="w-9 h-9 rounded-sm flex items-center justify-center text-paper-100 hover:bg-canvas-elevated transition-fast cursor-pointer focus-ring"
          title="AI-Dost Home"
        >
          <AiDostMark size={22} />
        </button>

        {/* New Action Trigger */}
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="w-8 h-8 rounded-sm flex items-center justify-center bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-fast cursor-pointer focus-ring"
            title="New Conversation / Task"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        <div className="w-6 h-[1px] bg-border my-1" />

        {/* Main Navigation Icons */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = currentView === id;
            return (
              <button
                key={id}
                data-nav={id}
                type="button"
                onClick={() => onSelectView && onSelectView(id)}
                className={`relative w-9 h-9 rounded-sm flex items-center justify-center transition-fast cursor-pointer group focus-ring ${
                  isActive
                    ? 'bg-canvas-elevated text-paper-100'
                    : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
                }`}
                title={label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Terracotta Active Rail Marker */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] bg-accent-primary rounded-r-xs" />
                )}
                <Icon className="w-4 h-4" />

                {/* Accessible Hover Tooltip */}
                <span className="absolute left-full ml-2.5 px-2 py-1 bg-ink-800 text-paper-100 border border-border text-[11px] font-sans rounded-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-fast pointer-events-none z-50 shadow-sm hidden sm:inline-block">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Theme & Profile */}
      <div className="flex flex-col items-center gap-2 w-full">
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-sm flex items-center justify-center text-ink-muted hover:text-paper-200 hover:bg-canvas-surface transition-fast cursor-pointer focus-ring"
            title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => onSelectView && onSelectView('settings')}
          className={`w-8 h-8 rounded-sm flex items-center justify-center transition-fast cursor-pointer focus-ring ${
            currentView === 'settings'
              ? 'bg-canvas-elevated text-paper-100'
              : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
          }`}
          title="Settings & System"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
}

export default CommandRail;
