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
    <header className="h-11 shrink-0 flex items-center gap-3 px-3 bg-canvas-base border-b border-border z-20 select-none whitespace-nowrap overflow-hidden">
      {/* Left: project identity */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-accent/15 text-accent border border-accent/25 shrink-0">
          <AppIcon name="code" size={13} />
        </div>
        <h1 className="text-xs font-semibold text-paper-100 tracking-tight truncate max-w-[180px]" title={projectName}>
          {projectName}
        </h1>
        <button
          type="button"
          onClick={() => setHistoryModalOpen(true)}
          className="p-1 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
          title={`Session history (${sessions.length})`}
          aria-label="Session history"
        >
          <AppIcon name="history" size={13} />
        </button>
        <button
          type="button"
          onClick={handleNewSession}
          className="p-1 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
          title="New project (saves current to History)"
          aria-label="New project"
        >
          <AppIcon name="plus" size={13} />
        </button>
      </div>

      {/* Center: run button + view mode */}
      <div className="flex items-center gap-2 shrink-0 mx-auto">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={handleReplitRun}
            disabled={isReplitRunning}
            className="flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-l-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-60"
            title="Run project (Ctrl+Enter)"
          >
            {isReplitRunning ? (
              <AppIcon name="loader" size={12} />
            ) : (
              <AppIcon name="play" size={11} className="fill-white" />
            )}
            <span>{isReplitRunning ? 'Running' : 'Run'}</span>
          </button>
          <button
            type="button"
            onClick={handleReplitRun}
            disabled={isReplitRunning}
            className="px-1.5 py-1 rounded-r-md text-white bg-emerald-600 hover:bg-emerald-500 border-l border-emerald-500/40 transition-colors cursor-pointer disabled:opacity-60"
            title="Run options"
            aria-label="Run options"
          >
            <AppIcon name="chevronDown" size={11} />
          </button>
        </div>

        <div className="flex items-center bg-canvas-surface p-0.5 rounded-md border border-border">
          {[
            { id: 'code', icon: 'code', label: 'Code', title: 'Code editor only' },
            { id: 'split', icon: 'columns', label: 'Split', title: 'Code & preview side-by-side' },
            { id: 'preview', icon: 'eye', label: 'Preview', title: 'Live preview only' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setWorkspaceMode(m.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                workspaceMode === m.id
                  ? 'bg-canvas-elevated text-paper-100 font-semibold'
                  : 'text-ink-muted hover:text-paper-200'
              }`}
              title={m.title}
              aria-pressed={workspaceMode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: icon-only launchers */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={saveAllFiles}
          disabled={dirtyPaths.size === 0}
          className="p-1.5 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors disabled:opacity-30 cursor-pointer"
          title={dirtyPaths.size > 0 ? `Save all (${dirtyPaths.size} modified)` : 'No unsaved changes'}
          aria-label="Save all files"
        >
          <AppIcon name="save" size={13} />
        </button>
        <button
          type="button"
          onClick={() => openProjectWizard()}
          className="p-1.5 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
          title="Project setup wizard"
          aria-label="Project setup"
        >
          <AppIcon name="wrench" size={13} />
        </button>
        <button
          type="button"
          onClick={() => setPackagesModalOpen(true)}
          className="p-1.5 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
          title="Package manager"
          aria-label="Package manager"
        >
          <AppIcon name="package" size={13} />
        </button>
        <button
          type="button"
          onClick={() => setSecretsModalOpen(true)}
          className="p-1.5 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
          title="Secrets (.env)"
          aria-label="Secrets"
        >
          <AppIcon name="key" size={13} />
        </button>
        <a
          href={`${backendUrl}/api/preview/${projectId}/zip`}
          className="p-1.5 rounded-md text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-colors cursor-pointer"
          title="Download project ZIP"
          aria-label="Download ZIP"
        >
          <AppIcon name="download" size={13} />
        </a>
      </div>
    </header>
  );
}

export default IdeHeader;
