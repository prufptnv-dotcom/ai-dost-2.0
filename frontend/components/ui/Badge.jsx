import React from 'react';

const VARIANTS = {
  default: 'bg-canvas-elevated text-txt-secondary border-border',
  primary: 'bg-accent/10 text-accent border-accent/20',
  success: 'bg-status-success/10 text-status-success border-status-success/20',
  warning: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  error: 'bg-status-error/10 text-status-error border-status-error/20',
  info: 'bg-status-info/10 text-status-info border-status-info/20',
};

const SIZES = {
  sm: 'px-1.5 py-0.5 text-[10px] rounded-xs font-mono font-medium',
  md: 'px-2 py-0.5 text-xs rounded-sm font-sans font-medium',
  lg: 'px-2.5 py-1 text-xs rounded-md font-sans font-medium',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  className = '',
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.default;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <span
      className={`inline-flex items-center gap-1 border select-none leading-none ${variantClass} ${sizeClass} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
      <span>{children}</span>
    </span>
  );
}

export function StatusIndicator({
  status = 'idle',
  label,
  size = 'sm',
  className = '',
}) {
  const STATUS_COLORS = {
    idle: 'bg-txt-muted',
    active: 'bg-accent animate-pulse',
    running: 'bg-status-info animate-pulse',
    success: 'bg-status-success',
    warning: 'bg-status-warning animate-pulse',
    error: 'bg-status-error',
  };

  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.idle;
  const dotSize = size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      <span className={`rounded-full flex-shrink-0 ${dotSize} ${colorClass}`} />
      {label && <span className="text-ui-caption text-txt-secondary font-medium">{label}</span>}
    </div>
  );
}

export default Badge;
