import React, { useState } from 'react';
import { CommandRail } from './CommandRail';
import { AiDostWordmark } from '../brand/AiDostWordmark';
import { AiDostMark } from '../brand/AiDostMark';
import { Search, Bell, ChevronDown, Menu, X } from 'lucide-react';

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const projectName =
    typeof activeProject === 'string'
      ? activeProject
      : activeProject?.project_name || activeProject?.name || 'Personal Workspace';
  const viewLabel =
    {
      chat: 'Chat',
      agent: 'Agent Workbench',
      copilot: 'Copilot IDE',
      projects: 'Projects',
      artifacts: 'Artifacts',
      resume: 'Resume Builder',
      voice: 'Voice Studio',
      images: 'Image Studio',
      history: 'History',
      settings: 'Settings',
      mcp: 'MCP Integrations',
    }[currentView] || currentView;

  const handleSelectView = (view) => {
    onSelectView?.(view);
    setMobileNavOpen(false);
  };

  const handleNewChat = () => {
    onNewChat?.();
    setMobileNavOpen(false);
  };

  return (
    <div
      className={
        'aidost-app h-screen w-screen flex overflow-hidden bg-canvas-base text-paper-100 font-sans ' +
        className
      }
    >
      {/* Desktop sidebar — always visible >=641px, hidden on mobile */}
      <div className="hidden sm:block">
        <CommandRail
          currentView={currentView}
          onSelectView={handleSelectView}
          onNewChat={handleNewChat}
          onOpenCommandPalette={onOpenCommandPalette}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </div>

      {/* Mobile overlay sidebar */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs sm:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed left-0 top-0 z-50 h-full sm:hidden">
            <CommandRail
              currentView={currentView}
              onSelectView={handleSelectView}
              onNewChat={handleNewChat}
              onOpenCommandPalette={onOpenCommandPalette}
              theme={theme}
              onToggleTheme={onToggleTheme}
            />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Mobile top bar — only on small screens */}
        <div className="flex sm:hidden items-center h-11 px-3 border-b border-border bg-canvas-base/90 shrink-0 z-40">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-paper-300 hover:text-white hover:bg-canvas-surface transition-fast cursor-pointer"
            aria-label="Open navigation"
          >
            <AiDostMark size={20} />
          </button>
          <span className="ml-2 text-xs font-semibold text-white truncate">{viewLabel}</span>
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-paper-300 hover:text-white hover:bg-canvas-surface transition-fast cursor-pointer"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Non-chat view header — desktop only */}
        {currentView !== 'chat' && (
        <header className="h-14 shrink-0 px-4 lg:px-6 bg-canvas-base/90 backdrop-blur-md border-b border-border hidden sm:flex items-center justify-between gap-4 z-40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden shrink-0">
              <AiDostWordmark size="sm" showVersion={false} />
            </div>
            <div className="hidden lg:flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#d9ff5a] font-bold">
                Workspace
              </span>
              <span className="text-ink-muted">/</span>
              <span className="text-sm font-medium text-white truncate max-w-[220px]">
                {projectName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
            </div>
            <div className="h-5 w-px bg-border hidden md:block" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                <span>{viewLabel}</span>
              </div>
              <div className="text-[10px] text-ink-muted hidden md:block">
                Personal computing workspace
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-[#d9ff5a]/40 text-xs text-paper-300 hover:text-white transition-fast cursor-pointer focus-ring shadow-sm"
                title="Open Command Palette (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-[#d9ff5a]" />
                <span className="hidden md:inline">Search anything</span>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-canvas-elevated text-paper-300 border border-border/50">
                  ⌘K
                </kbd>
              </button>
            )}
            <button
              type="button"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-paper-300 hover:text-white hover:bg-canvas-surface transition-fast cursor-pointer focus-ring"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-border">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#d9ff5a] to-[#a3e635] flex items-center justify-center text-xs font-bold text-black shadow-sm ring-2 ring-[#d9ff5a]/30">
                U
              </div>
            </div>
          </div>
        </header>
        )}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-canvas-base">
            {children}
          </main>
          {inspector}
        </div>
      </div>
    </div>
  );
}

export default AppShell;