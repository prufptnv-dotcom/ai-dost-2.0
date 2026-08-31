import React, { forwardRef } from 'react';

export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon: Icon,
    iconRight: IconRight,
    className = '',
    containerClassName = '',
    disabled = false,
    ...props
  },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`}>
      {label && (
        <label className="text-ui-caption font-medium text-txt-secondary select-none">
          {label}
        </label>
      )}
      <div className="relative flex items-center w-full">
        {Icon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-txt-muted">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          className={`w-full h-9 bg-canvas-surface text-txt-primary placeholder-txt-muted text-sm rounded-md border transition-fast focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
            Icon ? 'pl-9' : 'pl-3'
          } ${IconRight ? 'pr-9' : 'pr-3'} ${
            error
              ? 'border-status-error focus:border-status-error'
              : 'border-border hover:border-border-strong focus:border-border-focus'
          } ${className}`}
          {...props}
        />
        {IconRight && (
          <div className="absolute right-3 flex items-center pointer-events-none text-txt-muted">
            <IconRight className="w-4 h-4" />
          </div>
        )}
      </div>
      {error ? (
        <span className="text-xs text-status-error font-medium">{error}</span>
      ) : hint ? (
        <span className="text-xs text-txt-muted">{hint}</span>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    hint,
    className = '',
    containerClassName = '',
    disabled = false,
    rows = 3,
    ...props
  },
  ref
) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`}>
      {label && (
        <label className="text-ui-caption font-medium text-txt-secondary select-none">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={`w-full bg-canvas-surface text-txt-primary placeholder-txt-muted text-sm rounded-md p-3 border transition-fast focus-ring resize-y disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-status-error focus:border-status-error'
            : 'border-border hover:border-border-strong focus:border-border-focus'
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="text-xs text-status-error font-medium">{error}</span>
      ) : hint ? (
        <span className="text-xs text-txt-muted">{hint}</span>
      ) : null}
    </div>
  );
});

export default Input;
