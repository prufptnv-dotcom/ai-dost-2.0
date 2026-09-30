import React from 'react';

export default function ViewSkeletonLoader({ type = 'studio', title = 'Loading...' }) {
  if (type === 'chat') {
    return (
      <div className="h-full w-full flex flex-col bg-canvas-base select-none overflow-hidden">
        {/* Header Skeleton */}
        <div className="h-14 px-6 border-b border-border flex items-center justify-between shrink-0 bg-canvas-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg skeleton-shimmer bg-canvas-elevated" />
            <div className="space-y-1.5">
              <div className="w-28 h-3 rounded skeleton-shimmer bg-canvas-elevated" />
              <div className="w-16 h-2 rounded skeleton-shimmer bg-canvas-elevated/70" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20 h-7 rounded-lg skeleton-shimmer bg-canvas-elevated" />
            <div className="w-7 h-7 rounded-lg skeleton-shimmer bg-canvas-elevated" />
          </div>
        </div>

        {/* Message Stream Skeleton */}
        <div className="flex-1 overflow-hidden p-6 max-w-3xl mx-auto w-full space-y-6">
          {/* AI Message 1 */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full skeleton-shimmer bg-canvas-elevated shrink-0 mt-1" />
            <div className="space-y-2 flex-1 max-w-xl">
              <div className="w-3/4 h-3.5 rounded skeleton-shimmer bg-canvas-elevated" />
              <div className="w-full h-3 rounded skeleton-shimmer bg-canvas-elevated/80" />
              <div className="w-5/6 h-3 rounded skeleton-shimmer bg-canvas-elevated/60" />
            </div>
          </div>

          {/* User Message */}
          <div className="flex justify-end">
            <div className="w-64 h-11 rounded-2xl rounded-tr-xs skeleton-shimmer bg-canvas-elevated border border-border/50" />
          </div>

          {/* AI Message 2 with code block skeleton */}
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-full skeleton-shimmer bg-canvas-elevated shrink-0 mt-1" />
            <div className="space-y-3 flex-1 max-w-xl">
              <div className="w-2/3 h-3.5 rounded skeleton-shimmer bg-canvas-elevated" />
              <div className="h-28 rounded-xl skeleton-shimmer bg-canvas-elevated border border-border/50" />
            </div>
          </div>
        </div>

        {/* Composer Dock Skeleton */}
        <div className="p-4 max-w-3xl mx-auto w-full">
          <div className="h-14 rounded-2xl border border-border bg-canvas-surface/80 skeleton-shimmer flex items-center justify-between px-4" />
        </div>
      </div>
    );
  }

  if (type === 'ide') {
    return (
      <div className="h-full w-full flex flex-col bg-canvas-base select-none overflow-hidden">
        {/* Top Header Bar */}
        <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-canvas-surface shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-28 h-6 rounded-md skeleton-shimmer bg-canvas-elevated" />
            <div className="w-20 h-6 rounded-md skeleton-shimmer bg-canvas-elevated/60" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24 h-7 rounded-lg skeleton-shimmer bg-canvas-elevated" />
            <div className="w-8 h-7 rounded-lg skeleton-shimmer bg-canvas-elevated" />
          </div>
        </div>

        {/* 3-Column Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Tree Left */}
          <div className="w-56 border-r border-border p-3 space-y-2 shrink-0 hidden md:block bg-canvas-subtle">
            <div className="w-20 h-3 rounded skeleton-shimmer bg-canvas-elevated mb-3" />
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded skeleton-shimmer bg-canvas-elevated shrink-0" />
                <div className="h-3 rounded skeleton-shimmer bg-canvas-elevated" style={{ width: `${45 + (i * 12) % 40}%` }} />
              </div>
            ))}
          </div>

          {/* Monaco Editor Center */}
          <div className="flex-1 flex flex-col border-r border-border bg-canvas-base">
            <div className="h-9 border-b border-border flex items-center px-4 gap-2 bg-canvas-surface/40">
              <div className="w-24 h-5 rounded skeleton-shimmer bg-canvas-elevated" />
            </div>
            <div className="flex-1 p-4 space-y-2.5 overflow-hidden">
              {[...Array(14)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-4 h-3 rounded skeleton-shimmer bg-canvas-elevated/40 shrink-0 text-right" />
                  <div className="h-3 rounded skeleton-shimmer bg-canvas-elevated" style={{ width: `${20 + (i * 19) % 70}%` }} />
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview Right */}
          <div className="w-[42%] flex flex-col bg-canvas-surface/30 shrink-0 hidden lg:flex">
            <div className="h-9 border-b border-border flex items-center justify-between px-3">
              <div className="w-28 h-4 rounded skeleton-shimmer bg-canvas-elevated" />
              <div className="w-16 h-4 rounded skeleton-shimmer bg-canvas-elevated" />
            </div>
            <div className="flex-1 p-4 flex items-center justify-center">
              <div className="w-full h-full rounded-xl border border-border skeleton-shimmer bg-canvas-elevated/40" />
            </div>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="h-6 px-3 border-t border-border flex items-center justify-between text-[11px] bg-canvas-surface shrink-0">
          <div className="w-24 h-3 rounded skeleton-shimmer bg-canvas-elevated" />
          <div className="w-36 h-3 rounded skeleton-shimmer bg-canvas-elevated" />
        </div>
      </div>
    );
  }

  if (type === 'agent') {
    return (
      <div className="h-full w-full flex flex-col bg-canvas-base select-none p-6 space-y-6 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="w-44 h-5 rounded-md skeleton-shimmer bg-canvas-elevated" />
            <div className="w-64 h-3 rounded skeleton-shimmer bg-canvas-elevated/60" />
          </div>
          <div className="w-28 h-8 rounded-lg skeleton-shimmer bg-canvas-elevated" />
        </div>

        {/* 3 Kanban Columns */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
          {[...Array(3)].map((_, colIdx) => (
            <div key={colIdx} className="rounded-xl border border-border bg-canvas-surface/60 p-4 space-y-3 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="w-20 h-3.5 rounded skeleton-shimmer bg-canvas-elevated" />
                <div className="w-6 h-3.5 rounded-full skeleton-shimmer bg-canvas-elevated" />
              </div>
              <div className="space-y-2.5 flex-1">
                {[...Array(3)].map((_, cardIdx) => (
                  <div key={cardIdx} className="p-3 rounded-lg border border-border/60 bg-canvas-elevated space-y-2">
                    <div className="w-3/4 h-3 rounded skeleton-shimmer bg-canvas-surface" />
                    <div className="w-1/2 h-2.5 rounded skeleton-shimmer bg-canvas-surface/60" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: Studio / Hub layout with header, filter pills, and 6-card grid
  return (
    <div className="h-full w-full flex flex-col bg-canvas-base select-none p-6 md:p-8 space-y-6 overflow-hidden">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg skeleton-shimmer bg-canvas-elevated" />
            <div className="w-48 h-6 rounded-md skeleton-shimmer bg-canvas-elevated" />
          </div>
          <div className="w-72 h-3 rounded skeleton-shimmer bg-canvas-elevated/60" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-28 h-8 rounded-lg skeleton-shimmer bg-canvas-elevated" />
          <div className="w-24 h-8 rounded-lg skeleton-shimmer bg-canvas-elevated" />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2">
        <div className="w-16 h-7 rounded-full skeleton-shimmer bg-canvas-elevated" />
        <div className="w-20 h-7 rounded-full skeleton-shimmer bg-canvas-elevated/70" />
        <div className="w-24 h-7 rounded-full skeleton-shimmer bg-canvas-elevated/70" />
        <div className="w-20 h-7 rounded-full skeleton-shimmer bg-canvas-elevated/70 hidden sm:block" />
      </div>

      {/* Card Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl border border-border bg-canvas-surface/80 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl skeleton-shimmer bg-canvas-elevated" />
                <div className="w-14 h-4 rounded-md skeleton-shimmer bg-canvas-elevated/60" />
              </div>
              <div className="w-36 h-4 rounded skeleton-shimmer bg-canvas-elevated" />
              <div className="space-y-1.5">
                <div className="w-full h-3 rounded skeleton-shimmer bg-canvas-elevated/70" />
                <div className="w-4/5 h-3 rounded skeleton-shimmer bg-canvas-elevated/50" />
              </div>
            </div>

            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <div className="w-20 h-3 rounded skeleton-shimmer bg-canvas-elevated/40" />
              <div className="w-14 h-6 rounded-lg skeleton-shimmer bg-canvas-elevated" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
