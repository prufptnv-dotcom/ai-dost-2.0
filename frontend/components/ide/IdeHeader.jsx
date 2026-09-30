import React from 'react';
import {
  Code2, Plus, Play, Loader2, Code, Columns2, Eye,
  History, Package, KeyRound, SaveAll, Download
} from 'lucide-react';

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
    <header className="h-13 shrink-0 flex items-center justify-between px-4 bg-canvas-surface border-b border-border z-20 select-none">
      {/* Left: Project identity + New Project button */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-accent text-white shadow-glow-sm">
          <Code2 size={15} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-bold text-paper-100 tracking-tight">{projectName}</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
              Live
            </span>
          </div>
          <span className="text-[10px] text-ink-muted font-mono">React 19 • Express • Vite • SQLite</span>
        </div>

        <button
          type="button"
          onClick={handleNewSession}
          className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all shadow-xs cursor-pointer"
          title="Create a fresh new session & project (saves existing project to History)"
        >
          <Plus size={12} className="text-accent" /> New Project
        </button>
      </div>

      {/* Center: Replit Central Run Button & Segmented Mode Switcher */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleReplitRun}
          disabled={isReplitRunning}
          className="flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
          title="Run Project (Ctrl+Enter)"
        >
          {isReplitRunning ? (
            <>
              <Loader2 size={13} className="animate-spin text-white" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play size={12} className="fill-white text-white" />
              <span>Run</span>
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
          >
            <Code size={13} /> Code
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceMode('split')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'split'
                ? 'bg-indigo-600 text-white shadow-md font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
            title="Split View (Code & Live Preview side-by-side)"
          >
            <Columns2 size={13} /> Split
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceMode('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              workspaceMode === 'preview'
                ? 'bg-emerald-600 text-white shadow-md font-semibold'
                : 'text-ink-muted hover:text-paper-100'
            }`}
          >
            <Eye size={13} /> Preview
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
      </div>

      {/* Right: Quick Launchers */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setHistoryModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs"
          title="Copilot IDE Session History"
        >
          <History size={13} className="text-accent" />
          <span>History</span>
          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-accent/15 text-accent border border-accent/20">
            {sessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPackagesModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs"
          title="Replit Package Manager (npm dependencies)"
        >
          <Package size={13} className="text-indigo-400" /> Packages
        </button>

        <button
          type="button"
          onClick={() => setSecretsModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer shadow-xs"
          title="Replit Secrets (.env environment variables)"
        >
          <KeyRound size={13} className="text-amber-400" /> Secrets
        </button>

        <button
          type="button"
          onClick={() => openProjectWizard()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-accent border border-accent/20 hover:border-accent/40 transition-all cursor-pointer shadow-xs"
          title="Launch Project Architect Wizard"
        >
          <Code2 size={13} className="text-accent" /> Project setup
        </button>

        <button
          type="button"
          onClick={saveAllFiles}
          disabled={dirtyPaths.size === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all disabled:opacity-40 cursor-pointer"
          title="Save all modified files"
        >
          <SaveAll size={13} className="text-emerald-500" />
          Save{dirtyPaths.size > 0 ? ` (${dirtyPaths.size})` : ''}
        </button>

        <a
          href={`${backendUrl}/api/preview/${projectId}/zip`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-canvas-surface hover:bg-canvas-elevated text-paper-200 hover:text-paper-100 border border-border transition-all cursor-pointer"
          title="Download ZIP with Windows & Mac double-click launchers"
        >
          <Download size={13} className="text-accent" /> ZIP
        </a>
      </div>
    </header>
  );
}

export default IdeHeader;
