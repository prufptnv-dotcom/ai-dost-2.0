import React from 'react';
import { X, Plus, Circle } from 'lucide-react';
import { iconForFile } from '../views/CopilotTree';

export function WorkspaceTabs({
  tabs = [],
  activePath = '',
  modifiedPaths = new Set(),
  onSelectTab,
  onCloseTab,
  onNewTab,
  className = '',
}) {
  return (
    <div className={`flex items-center h-8 bg-canvas-subtle border-b border-border overflow-x-auto select-none no-scrollbar ${className}`}>
      <div className="flex items-center h-full flex-1 min-w-0">
        {tabs.map((tabPath) => {
          const isActive = activePath === tabPath;
          const isModified = modifiedPaths.has ? modifiedPaths.has(tabPath) : (Array.isArray(modifiedPaths) && modifiedPaths.includes(tabPath));
          const filename = tabPath.split('/').pop() || tabPath;
          const Icon = iconForFile(tabPath);

          return (
            <div
              key={tabPath}
              onClick={() => onSelectTab && onSelectTab(tabPath)}
              className={`group relative flex items-center gap-2 h-full px-3 text-xs font-mono border-r border-border transition-fast cursor-pointer flex-shrink-0 ${
                isActive
                  ? 'bg-canvas-base text-paper-100 font-medium'
                  : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface'
              }`}
              title={tabPath}
            >
              {/* Active Tab Accent Line */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-primary" />
              )}

              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-accent-primary' : 'text-ink-muted'}`} />
              <span className="truncate max-w-[140px]">{filename}</span>

              {/* Modified or Close Action */}
              <div className="flex items-center ml-1">
                {isModified ? (
                  <span
                    className="w-2 h-2 rounded-full bg-signal-warning group-hover:hidden"
                    title="Modified"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab && onCloseTab(tabPath);
                  }}
                  className={`p-0.5 rounded-xs text-ink-muted hover:text-paper-100 hover:bg-canvas-elevated transition-fast cursor-pointer ${
                    isModified ? 'hidden group-hover:inline-block' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {onNewTab && (
        <button
          type="button"
          onClick={onNewTab}
          className="px-2.5 h-full flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer border-l border-border"
          title="New File"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
