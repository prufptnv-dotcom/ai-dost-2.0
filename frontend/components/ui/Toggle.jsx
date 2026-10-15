import React from 'react';

/**
 * Animated toggle switch (Material/Linear style).
 * Styled by `.aidost-switch` in styles/globals.css.
 */
export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  id,
  'data-testid': testId,
}) {
  const labelNode = (label || description) ? (
    <div className="min-w-0">
      {label && <div className="text-xs font-medium text-paper-100">{label}</div>}
      {description && <div className="text-[11px] text-ink-muted">{description}</div>}
    </div>
  ) : null;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      {labelNode}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        data-testid={testId}
        onClick={() => onChange?.(!checked)}
        className={`aidost-switch ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      />
    </div>
  );
}
