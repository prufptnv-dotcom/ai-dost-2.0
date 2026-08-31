import React from 'react';

export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  tabClassName = '',
  variant = 'pill', // 'pill' | 'line'
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 ${
        variant === 'pill'
          ? 'p-1 bg-canvas-subtle border border-border-subtle rounded-md'
          : 'border-b border-border w-full'
      } ${className}`}
    >
      {tabs.map((t) => {
        const tabId = typeof t === 'string' ? t : t.id;
        const tabLabel = typeof t === 'string' ? t : t.label;
        const Icon = t.icon;
        const isActive = activeTab === tabId;

        if (variant === 'line') {
          return (
            <button
              key={tabId}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange && onChange(tabId)}
              className={`flex items-center gap-2 px-3.5 py-2 text-ui-default font-medium transition-fast border-b-2 cursor-pointer -mb-[1px] focus-ring ${
                isActive
                  ? 'border-accent text-txt-primary'
                  : 'border-transparent text-txt-muted hover:text-txt-secondary'
              } ${tabClassName}`}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span>{tabLabel}</span>
              {t.badge !== undefined && t.badge !== null && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-canvas-elevated text-txt-secondary border border-border-subtle">
                  {t.badge}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={tabId}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange && onChange(tabId)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-sm transition-fast cursor-pointer select-none focus-ring ${
              isActive
                ? 'bg-canvas-surface text-txt-primary shadow-sm border border-border'
                : 'text-txt-muted hover:text-txt-secondary hover:bg-white/5 border border-transparent'
            } ${tabClassName}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
            <span>{tabLabel}</span>
            {t.badge !== undefined && t.badge !== null && (
              <span className="text-[10px] px-1 rounded-xs bg-canvas-elevated text-txt-muted">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
