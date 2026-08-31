import React from 'react';
import { CommandRail } from './CommandRail';
import { AiDostWordmark } from '../brand/AiDostWordmark';
import { Search, Terminal, Command } from 'lucide-react';

export function AppShell({
  currentView = 'chat',
  onSelectView,
  onNewChat,
  theme = 'dark',
  onToggleTheme,
  onOpenCommandPalette,
  activeProject,
  inspector,
  children,
  className = '',
}) {
  return (
    <div className={`h-screen w-screen flex overflow-hidden bg-canvas-base text-paper-100 font-sans ${className}`}>
      {/* 1. Command Rail (56-64px) */}
      <CommandRail
        currentView={currentView}
        onSelectView={onSelectView}
        onNewChat={onNewChat}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Minimal Editorial Top Strip */}
        <header className="h-11 px-4 sm:px-6 bg-canvas-subtle border-b border-border flex items-center justify-between gap-4 select-none z-10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <AiDostWordmark size="sm" showVersion={false} />
            <span className="text-ink-muted text-xs hidden sm:inline">/</span>
            <span className="text-xs font-mono text-paper-200 capitalize truncate hidden sm:inline">
              {currentView}
            </span>
            {activeProject && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-xs bg-canvas-surface border border-border text-paper-200 truncate max-w-[140px] sm:max-w-[200px]">
                {typeof activeProject === 'string' ? activeProject : (activeProject.project_name || activeProject.name || 'Active Project')}
              </span>
            )}
          </div>

          {/* Quick Command Surface Shortcut (Ctrl+K) */}
          <div className="flex items-center gap-2">
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xs bg-canvas-surface hover:bg-canvas-elevated border border-border text-xs text-ink-muted hover:text-paper-200 transition-fast cursor-pointer focus-ring"
                title="Open Command Palette (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-[11px] font-sans hidden md:inline">Command</span>
                <kbd className="font-mono text-[10px] px-1 py-0.2 bg-canvas-elevated rounded-xs text-ink-muted">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>
        </header>

        {/* 3. Workspace Canvas & Context Inspector */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Main Canvas Area */}
          <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-canvas-base">
            {children}
          </main>

          {/* Optional Context Inspector */}
          {inspector}
        </div>
      </div>
    </div>
  );
}

export default AppShell;
