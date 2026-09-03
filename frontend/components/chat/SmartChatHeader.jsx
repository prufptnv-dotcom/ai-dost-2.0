import React from 'react';
import { Search, Plus, PanelLeft } from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export default function SmartChatHeader({
  sessionName = 'New conversation',
  projectName,
  onNewSession,
}) {
  const handleOpenSearch = () => {
    window.dispatchEvent(new CustomEvent('ai-dost-open-command-palette'));
  };

  return (
    <header className="h-12 shrink-0 px-4 md:px-6 border-b border-border-subtle bg-canvas-base flex items-center justify-between gap-3 select-none" role="banner">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('ai-dost-open-mobile-nav'))}
          className="sm:hidden p-1 -ml-1 rounded-lg text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <AiDostMark size={18} />
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('ai_dost_toggle_sidebar'))}
          className="hidden sm:inline-flex p-1 -ml-1 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated cursor-pointer transition-colors"
          title="Toggle sidebar (Ctrl+B)"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={16} />
        </button>
        <span className="text-sm font-medium text-paper-200 shrink-0">AI-Dost</span>
        {(projectName || (sessionName && sessionName !== 'New conversation')) && (
          <>
            <span className="text-ink-muted text-sm shrink-0">/</span>
            <span className="text-sm font-medium text-paper-100 truncate max-w-[180px] sm:max-w-[220px]">
              {projectName || sessionName}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-ink-muted">
        {onNewSession && (
          <button
            type="button"
            onClick={onNewSession}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-paper-200 hover:bg-canvas-elevated hover:text-paper-100 transition-colors cursor-pointer"
            title="New conversation"
            aria-label="New conversation"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">New</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-canvas-elevated hover:text-paper-100 transition-colors cursor-pointer"
          title="Search chats (Ctrl+K)"
          aria-label="Search chats"
        >
          <Search size={15} />
        </button>
      </div>
    </header>
  );
}
