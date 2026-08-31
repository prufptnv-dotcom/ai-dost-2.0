import React from 'react';
import { Button } from './Button';

export function Skeleton({
  variant = 'text', // 'text' | 'rect' | 'circle'
  width,
  height,
  className = '',
}) {
  const VARIANTS = {
    text: 'h-4 w-full rounded-xs',
    rect: 'rounded-md',
    circle: 'rounded-full aspect-square',
  };

  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      style={style}
      className={`bg-canvas-elevated/70 animate-pulse ${VARIANTS[variant] || VARIANTS.text} ${className}`}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title = 'No items yet',
  description = 'Get started by creating your first item or selecting an action.',
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-canvas-subtle/30 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-canvas-surface border border-border flex items-center justify-center mb-4 text-txt-muted shadow-sm">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-txt-primary font-display mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-txt-muted max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button
          variant="primary"
          size="md"
          icon={actionIcon}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
