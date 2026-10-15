import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-accent hover:bg-accent-hover text-white shadow-sm border border-transparent active:scale-[0.98]',
  secondary: 'bg-canvas-surface hover:bg-canvas-elevated text-txt-primary border border-border hover:border-border-strong active:scale-[0.98]',
  subtle: 'bg-transparent hover:bg-canvas-elevated text-txt-secondary hover:text-txt-primary border border-transparent active:scale-[0.98]',
  danger: 'bg-status-error/10 hover:bg-status-error/20 text-status-error border border-status-error/30 active:scale-[0.98]',
  ghost: 'bg-transparent hover:bg-white/5 text-txt-secondary hover:text-txt-primary active:scale-[0.98]',
};

const SIZES = {
  xs: 'h-7 px-2 text-xs rounded-xs gap-1.5',
  sm: 'h-8 px-2.5 text-xs rounded-sm gap-1.5',
  md: 'h-9 px-3.5 text-sm rounded-md gap-2',
  lg: 'h-10 px-4 text-base rounded-lg gap-2.5',
};

export const Button = forwardRef(function Button(
  {
    children,
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  const variantClass = VARIANTS[variant] || VARIANTS.secondary;
  const sizeClass = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center font-medium font-sans select-none transition-fast focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-4 h-4 flex-shrink-0" />
      ) : null}
      {children && <span>{children}</span>}
      {!loading && IconRight && <IconRight className="w-4 h-4 flex-shrink-0" />}
    </button>
  );
});

export const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    variant = 'subtle',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    title,
    'aria-label': ariaLabel,
    ...props
  },
  ref
) {
  const ICON_SIZES = {
    xs: 'w-7 h-7 rounded-xs',
    sm: 'w-8 h-8 rounded-sm',
    md: 'w-9 h-9 rounded-md',
    lg: 'w-10 h-10 rounded-lg',
  };

  const sizeClass = ICON_SIZES[size] || ICON_SIZES.md;
  const variantClass = VARIANTS[variant] || VARIANTS.subtle;
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      title={title || ariaLabel}
      aria-label={ariaLabel || title}
      className={`inline-flex items-center justify-center transition-fast focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
    </button>
  );
});

export default Button;
