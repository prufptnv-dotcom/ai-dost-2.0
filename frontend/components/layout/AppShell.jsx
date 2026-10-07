import React, { useState, useEffect } from 'react';
import { CommandRail } from './CommandRail';
import { AiDostMark } from '../brand/AiDostMark';
import AppIcon from '../ui/AppIcon';

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

  // viewLabel still drives the chat-view header + mobile nav; projectName went
  // away with the non-chat header (each view renders its own title bar).
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
      animations: 'Anime.js 3D Studio',
      bharat: 'Bharat Open APIs Hub',
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
      data-theme={theme}
      suppressHydrationWarning
      className={
        `aidost-app ${theme === 'light' ? 'light-theme' : ''} h-screen w-screen flex overflow-hidden bg-canvas-base text-paper-100 font-sans ` +
        className
      }
    >
      {/* Desktop sidebar — visible if not collapsed, hidden on mobile */}
      {!sidebarCollapsed ? (
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
      ) : (
        <div className="hidden sm:flex flex-col items-center py-3 px-2 border-r border-border bg-canvas-subtle z-30 shrink-0 w-12 gap-2.5 select-none">
          <button
            type="button"
            onClick={toggleSidebar}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer"
            title="Expand sidebar (Ctrl+B)"
            aria-label="Expand sidebar"
          >
            <AppIcon name="expand" size={16} />
          </button>

          <div className="w-5 h-px bg-border my-0.5" />

          <button
            type="button"
            onClick={handleNewChat}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white bg-accent hover:bg-accent-hover transition-fast cursor-pointer shadow-xs"
            title="New chat"
            aria-label="New chat"
          >
            <AppIcon name="plus" size={15} />
          </button>

          <button
            type="button"
            onClick={() => handleSelectView('chat')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-fast cursor-pointer ${
              currentView === 'chat' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
            title="Chat (Ctrl+1)"
          >
            <AppIcon name="message" size={15} />
          </button>

          <button
            type="button"
            onClick={() => handleSelectView('copilot')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-fast cursor-pointer ${
              currentView === 'copilot' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
            title="Copilot IDE (Ctrl+3)"
          >
            <AppIcon name="code" size={15} />
          </button>

          <button
            type="button"
            onClick={() => handleSelectView('agent')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-fast cursor-pointer ${
              currentView === 'agent' ? 'bg-accent/15 text-accent border border-accent/30' : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface'
            }`}
            title="Agent Workbench (Ctrl+2)"
          >
            <AppIcon name="bot" size={15} />
          </button>
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
              <AppIcon name="wifi" className="w-3.5 h-3.5 shrink-0" />
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
                <AppIcon name="search" className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden min-h-0">
          <main suppressHydrationWarning className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-canvas-base">
            {children}
          </main>
          {inspector}
        </div>
      </div>
    </div>
  );
}

export default AppShell;