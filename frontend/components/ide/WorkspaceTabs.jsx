import React from 'react';
import AppIcon from '../ui/AppIcon';
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
    <div className={`flex items-center h-8 bg-canvas-base border-b border-border overflow-x-auto select-none no-scrollbar ${className}`}>
      <div className="flex items-center h-full flex-1 min-w-0">
        {tabs.map((tabPath) => {
          const isActive = activePath === tabPath;
          const isModified = modifiedPaths.has ? modifiedPaths.has(tabPath) : (Array.isArray(modifiedPaths) && modifiedPaths.includes(tabPath));
          const filename = tabPath.split('/').pop() || tabPath;
          const Icon = iconForFile(tabPath);

          return (
            <div
              key={tabPath}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab && onSelectTab(tabPath)}
              className={`group relative flex items-center gap-1.5 h-full pl-3 pr-2 text-[11px] font-mono border-r border-border-subtle transition-colors cursor-pointer flex-shrink-0 ${
                isActive
                  ? 'bg-canvas-surface text-paper-100'
                  : 'text-ink-muted hover:text-paper-200 hover:bg-canvas-surface/50'
              }`}
              title={tabPath}
            >
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-[1.5px] bg-accent" />
              )}

              <Icon className={`w-3 h-3 flex-shrink-0 ${isActive ? 'text-accent' : 'text-ink-muted'}`} />
              <span className="truncate max-w-[140px]">{filename}</span>

              <div className="flex items-center ml-0.5">
                {isModified && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400 group-hover:hidden"
                    title="Modified"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab && onCloseTab(tabPath);
                  }}
                  className={`p-0.5 rounded text-ink-muted hover:text-paper-100 transition-colors cursor-pointer ${
                    isModified ? 'hidden group-hover:inline-flex' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Close tab"
                  aria-label={`Close ${filename}`}
                >
                  <AppIcon name="close" size={9} />
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
          className="px-2.5 h-full flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-colors cursor-pointer"
          title="New file"
          aria-label="New file"
        >
          <AppIcon name="plus" size={12} />
        </button>
      )}
    </div>
  );
}
