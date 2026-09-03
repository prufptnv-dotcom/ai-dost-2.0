import React, { useState, useEffect } from 'react';
import { CommandRail } from './CommandRail';
import { AiDostWordmark } from '../brand/AiDostWordmark';
import { AiDostMark } from '../brand/AiDostMark';
import { Search, Bell, ChevronDown, Menu, X, WifiOff, PanelLeftOpen } from 'lucide-react';

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
  const [isOnline, setIsOnline] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai_dost_sidebar_collapsed');
      if (saved !== null) setSidebarCollapsed(saved === 'true');
    } catch (_) {}

    const handleToggle = () => {
      setSidebarCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('ai_dost_sidebar_collapsed', String(next)); } catch (_) {}
        return next;
      });
    };
    window.addEventListener('ai_dost_toggle_sidebar', handleToggle);
    return () => window.removeEventListener('ai_dost_toggle_sidebar', handleToggle);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('ai_dost_sidebar_collapsed', String(next)); } catch (_) {}
      return next;
    });
  };

  useEffect(() => {
    const handleOpenMobileNav = () => setMobileNavOpen(true);
    window.addEventListener('ai-dost-open-mobile-nav', handleOpenMobileNav);
    return () => window.removeEventListener('ai-dost-open-mobile-nav', handleOpenMobileNav);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
      {/* Desktop sidebar — visible if not collapsed, hidden on mobile */}
      {!sidebarCollapsed && (
        <div className="hidden sm:block">
          <CommandRail
            currentView={currentView}
            onSelectView={handleSelectView}
            onNewChat={handleNewChat}
            onOpenCommandPalette={onOpenCommandPalette}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onToggleCollapse={toggleSidebar}
          />
        </div>
      )}

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

      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Offline indicator banner */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="h-7 px-3 bg-signal-warning-subtle border-b border-signal-warning/40 text-signal-warning text-xs font-medium flex items-center justify-between z-50 shrink-0 select-none"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px]">Working offline. Local workspace features remain available.</span>
            </div>
            <span className="text-[9px] uppercase font-mono tracking-wider opacity-75">Offline</span>
          </div>
        )}

        {/* Mobile top bar — only on small screens for non-chat views (chat has its own integrated header) */}
        {currentView !== 'chat' && (
          <div className="flex sm:hidden items-center h-11 px-3 border-b border-border bg-canvas-base/90 shrink-0 z-40">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-paper-300 hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
              aria-label="Open navigation"
            >
              <AiDostMark size={20} />
            </button>
            <span className="ml-2 text-xs font-semibold text-paper-100 truncate">{viewLabel}</span>
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center text-paper-300 hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Non-chat view header — desktop only */}
        {currentView !== 'chat' && (
        <header className="h-14 shrink-0 px-4 lg:px-6 bg-canvas-base/90 backdrop-blur-md border-b border-border hidden sm:flex items-center justify-between gap-4 z-40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden shrink-0">
              <AiDostWordmark size="sm" showVersion={false} />
            </div>
            <div className="hidden lg:flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-accent font-bold">
                Workspace
              </span>
              <span className="text-ink-muted">/</span>
              <span className="text-sm font-medium text-paper-100 truncate max-w-[220px]">
                {projectName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
            </div>
            <div className="h-5 w-px bg-border hidden md:block" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-paper-100 truncate flex items-center gap-2">
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
                className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg bg-canvas-surface hover:bg-canvas-elevated border border-border hover:border-accent/40 text-xs text-paper-300 hover:text-paper-100 transition-fast cursor-pointer focus-ring shadow-sm"
                title="Open Command Palette (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-accent" />
                <span className="hidden md:inline">Search anything</span>
                <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-canvas-elevated text-paper-300 border border-border/50">
                  ⌘K
                </kbd>
              </button>
            )}
            <button
              type="button"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-paper-300 hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer focus-ring"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-border">
              <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-bold text-paper-100 shadow-sm">
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