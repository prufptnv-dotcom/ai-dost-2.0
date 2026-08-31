import React from 'react';
import { CommandRail } from './CommandRail';
import { AiDostWordmark } from '../brand/AiDostWordmark';
import { Search, Bell, ChevronDown } from 'lucide-react';

export function AppShell({ currentView = 'chat', onSelectView, onNewChat, theme = 'dark', onToggleTheme, onOpenCommandPalette, activeProject, inspector, children, className = '' }) {
  const projectName = typeof activeProject === 'string' ? activeProject : (activeProject?.project_name || activeProject?.name || 'Personal Workspace');
  const viewLabel = { chat:'Chat', agent:'Agent Workbench', copilot:'Copilot IDE', projects:'Projects', artifacts:'Artifacts', resume:'Resume Builder', voice:'Voice Studio', images:'Image Studio', history:'History', settings:'Settings', mcp:'MCP Integrations' }[currentView] || currentView;
  return (
    <div className={'aidost-app h-screen w-screen flex overflow-hidden bg-canvas-base text-paper-100 font-sans ' + className}>
      <CommandRail currentView={currentView} onSelectView={onSelectView} onNewChat={onNewChat} theme={theme} onToggleTheme={onToggleTheme} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 px-4 lg:px-6 bg-canvas-base/95 backdrop-blur-sm border-b border-border flex items-center justify-between gap-4 z-40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden shrink-0"><AiDostWordmark size="sm" showVersion={false} /></div>
            <div className="hidden lg:flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-muted">Workspace</span><span className="text-ink-muted">/</span>
              <span className="text-sm font-medium text-paper-100 truncate max-w-[220px]">{projectName}</span><ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
            </div>
            <div className="h-5 w-px bg-border hidden md:block" />
            <div className="min-w-0"><div className="text-sm font-semibold text-paper-100 truncate">{viewLabel}</div><div className="text-[10px] text-ink-muted hidden md:block">Personal computing workspace</div></div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenCommandPalette && <button type="button" onClick={onOpenCommandPalette} className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg bg-canvas-surface/80 hover:bg-canvas-elevated border border-border text-xs text-ink-muted hover:text-paper-100 transition-fast cursor-pointer focus-ring" title="Open Command Palette (Ctrl+K)"><Search className="w-3.5 h-3.5" /><span className="hidden md:inline">Search anything</span><kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-canvas-elevated text-ink-muted">⌘K</kbd></button>}
            <button type="button" className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer focus-ring" title="Notifications" aria-label="Notifications"><Bell className="w-4 h-4" /></button>
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-border"><div className="w-8 h-8 rounded-full bg-accent-subtle border border-accent-border flex items-center justify-center text-xs font-semibold text-accent">U</div></div>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden min-h-0"><main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-canvas-base">{children}</main>{inspector}</div>
      </div>
    </div>
  );
}
export default AppShell;