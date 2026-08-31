import React from 'react';

export function Panel({
  children,
  header,
  headerActions,
  footer,
  className = '',
  bodyClassName = '',
  variant = 'default', // 'default' | 'elevated' | 'subtle'
}) {
  const VARIANTS = {
    default: 'bg-canvas-surface border-border',
    elevated: 'bg-canvas-elevated border-border-strong shadow-md',
    subtle: 'bg-canvas-subtle border-border-subtle',
  };

  const variantClass = VARIANTS[variant] || VARIANTS.default;

  return (
    <div className={`border rounded-lg overflow-hidden flex flex-col ${variantClass} ${className}`}>
      {header && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-canvas-subtle/50 select-none">
          <div className="text-ui-default font-semibold text-txt-primary font-sans">{header}</div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className={`p-4 flex-1 ${bodyClassName}`}>{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-border bg-canvas-subtle/50">{footer}</div>
      )}
    </div>
  );
}

export function Divider({
  orientation = 'horizontal',
  label,
  className = '',
}) {
  if (orientation === 'vertical') {
    return <div className={`w-[1px] bg-border self-stretch mx-2 ${className}`} />;
  }

  if (label) {
    return (
      <div className={`flex items-center gap-3 w-full my-4 ${className}`}>
        <div className="flex-1 h-[1px] bg-border" />
        <span className="text-ui-caption text-txt-muted uppercase tracking-wider font-mono">
          {label}
        </span>
        <div className="flex-1 h-[1px] bg-border" />
      </div>
    );
  }

  return <div className={`h-[1px] w-full bg-border my-4 ${className}`} />;
}

export default Panel;
