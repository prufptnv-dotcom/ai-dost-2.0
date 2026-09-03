import React from 'react';

/**
 * Skeleton component for high-polish shimmer placeholder states.
 * Automatically adapts to Light and Dark themes via CSS tokens.
 */
export function Skeleton({
  className = '',
  variant = 'rectangular', // 'rectangular' | 'text' | 'circular'
  animate = true,
  ...props
}) {
  const baseClasses = 'bg-canvas-elevated/70 border border-border-subtle';
  const animClass = animate ? 'animate-pulse' : '';

  const variantClasses = {
    rectangular: 'rounded-lg',
    text: 'h-4 w-full rounded-sm',
    circular: 'rounded-full',
  }[variant] || 'rounded-lg';

  return (
    <div
      aria-hidden="true"
      className={`${baseClasses} ${animClass} ${variantClasses} ${className}`}
      {...props}
    />
  );
}

export function SkeletonTableRow({ cols = 4, className = '' }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3.5 border-b border-border/50 animate-pulse ${className}`}>
      <Skeleton className="w-5 h-5 rounded-md shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-3.5 w-1/3 rounded-sm" />
        <Skeleton className="h-2.5 w-2/3 rounded-sm opacity-60" />
      </div>
      <Skeleton className="h-4 w-16 rounded-sm shrink-0 hidden sm:block" />
      <Skeleton className="h-6 w-14 rounded-md shrink-0" />
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`p-4 rounded-xl bg-canvas-surface border border-border animate-pulse space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-1/2 rounded-sm" />
          <Skeleton className="h-2.5 w-1/4 rounded-sm opacity-60" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-md opacity-70" />
      <div className="flex justify-between items-center pt-1">
        <Skeleton className="h-3 w-16 rounded-sm" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
    </div>
  );
}

export default Skeleton;
