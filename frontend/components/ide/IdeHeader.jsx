import React from 'react';
import AppIcon from '../ui/AppIcon';

export function IdeHeader({
  projectName = 'Copilot Workspace',
  handleNewSession,
  handleReplitRun,
  isReplitRunning = false,
  workspaceMode = 'split',
  setWorkspaceMode,
  setHistoryModalOpen,
  sessions = [],
  setPackagesModalOpen,
  setSecretsModalOpen,
  openProjectWizard,
  saveAllFiles,
  dirtyPaths = new Set(),
  projectId = 'copilot-workspace',
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000',
}) {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between gap-3 px-4 bg-canvas-base border-b border-border z-20 select-none whitespace-nowrap overflow-hidden">
      {/* Left: Project identity + New Project button */}
      <div className="flex items-center gap-3 shrink-0 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent/15 text-accent border border-accent/30 shrink-0">
          <AppIcon name="code" size={15} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-semibold text-paper-100 tracking-tight truncate">{projectName}</h1>
            <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">
              Ready
            </span>
          </div>
          <span className="text-[10px] text-ink-muted font-mono block truncate">workspace / {projectId}</span>
        </div>

        <button
          type="button"
          onClick={handleNewSession}
          className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all shadow-xs cursor-pointer"
          title="Create a fresh new session & project (saves existing project to History)"
        >
          <AppIcon name="plus" size={12} className="text-accent" /> New Project
        </button>
      </div>

      {/* Center: Replit Central Run Button & Segmented Mode Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleReplitRun}
          disabled={isReplitRunning}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
          title="Run Project (Ctrl+Enter)"
        >
          {isReplitRunning ? (
            <>
              <AppIcon name="loader" size={13} className="text-white" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <AppIcon name="play" size={12} className="fill-white text-white" />
              <span>Run project</span>
              <kbd className="text-[9px] font-mono opacity-80 bg-black/20 px-1 py-0.5 rounded">Ctrl+↵</kbd>
            </>
          )}
        </button>

        <div className="flex items-center bg-canvas-base p-1 rounded-lg border border-border shadow-inner">
          <button
            type="button"
            onClick={() => setWorkspaceMode('code')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'code'
                ? 'bg-accent text-white shadow-glow-sm font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
            title="Code editor"
          >
            <AppIcon name="code" size={13} /> Code
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceMode('split')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'split'
                ? 'bg-accent text-white shadow-glow-sm font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
            title="Split View (Code & Live Preview side-by-side)"
          >
            <AppIcon name="columns" size={13} /> Split
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'preview'
                ? 'bg-accent text-white shadow-glow-sm font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
            title="Live preview"
          >
            <AppIcon name="eye" size={13} /> Preview
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="Preview ready" />
          </button>
        </div>
      </div>

      {/* Right: Quick Launchers */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setHistoryModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs"
          title="Copilot IDE Session History"
        >
          <AppIcon name="history" size={13} className="text-accent" />
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-accent/15 text-accent border border-accent/20">
            {sessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPackagesModalOpen(true)}
          className="p-1.5 rounded-md text-paper-200 hover:text-paper-100 hover:bg-canvas-elevated border border-border bg-canvas-surface transition-all cursor-pointer shadow-xs"
          title="Replit Package Manager (npm dependencies)"
        >
          <AppIcon name="package" size={13} className="text-indigo-400" />
        </button>

        <button
          type="button"
          onClick={() => setSecretsModalOpen(true)}
          className="p-1.5 rounded-md text-paper-200 hover:text-paper-100 hover:bg-canvas-elevated border border-border bg-canvas-surface transition-all cursor-pointer shadow-xs"
          title="Replit Secrets (.env environment variables)"
        >
          <AppIcon name="key" size={13} className="text-amber-400" />
        </button>

        <button
          type="button"
          onClick={() => openProjectWizard()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-accent border border-accent/20 hover:border-accent/40 transition-all cursor-pointer shadow-xs"
          title="Launch Project Architect Wizard"
        >
          <AppIcon name="code" size={13} className="text-accent" /> Project setup
        </button>

        <button
          type="button"
          onClick={saveAllFiles}
          disabled={dirtyPaths.size === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all disabled:opacity-40 cursor-pointer shadow-xs"
          title="Save all modified files"
        >
          <AppIcon name="save" size={13} className="text-emerald-500" />
          {dirtyPaths.size > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              {dirtyPaths.size}
            </span>
          )}
        </button>

        <a
          href={`${backendUrl}/api/preview/${projectId}/zip`}
          className="p-1.5 rounded-md text-paper-200 hover:text-paper-100 hover:bg-canvas-elevated border border-border bg-canvas-surface transition-all cursor-pointer shadow-xs"
          title="Download ZIP with Windows & Mac double-click launchers"
        >
          <AppIcon name="download" size={13} className="text-accent" />
        </a>
      </div>
    </header>
  );
}

export default IdeHeader;
