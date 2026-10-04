import React, { useState } from 'react';
import AppIcon from '../ui/AppIcon';

export default function ResearchProgressIndicator({
  query = '',
  sources = [],
  isSearching = false,
  status = '',
  totalResults = 0,
}) {
  const [expanded, setExpanded] = useState(false);

  const displayCount = sources.length || totalResults || 0;
  const isComplete = !isSearching && displayCount > 0;

  return (
    <div
      className="my-2.5 rounded-xl border border-cyan-500/25 bg-cyan-950/15 overflow-hidden backdrop-blur-md shadow-sm transition-all select-none"
      data-testid="research-progress-indicator"
    >
      {/* 3. Research Progress Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-cyan-900/10 border-b border-cyan-500/15">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 shrink-0">
            {isSearching ? (
              <AppIcon name="loader" size={12} className="text-cyan-300" />
            ) : (
              <AppIcon name="globe" size={12} className="text-cyan-300" />
            )}
            {isSearching && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-cyan-100 tracking-wide flex items-center gap-1.5 truncate">
              {isSearching ? 'Deep Web Research' : 'Verified Web Research'}
              {query && (
                <span className="text-[11px] font-mono text-cyan-300/80 font-normal truncate max-w-[200px] sm:max-w-xs">
                  “{query}”
                </span>
              )}
            </span>
            <span className="text-[10px] text-cyan-300/70 font-mono">
              {status || (isSearching ? 'Scanning web sources & verifying citations…' : `${displayCount} verified sources consulted`)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
              isSearching
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 animate-pulse'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
            }`}
          >
            {isSearching ? 'Researching' : 'Complete'}
          </span>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-cyan-300/70 hover:text-cyan-100 p-1 rounded-md transition-colors cursor-pointer"
              title="Toggle source list"
              aria-label="Toggle sources"
            >
              <AppIcon name={expanded ? 'chevronUp' : 'chevronDown'} size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 3-Step Research Pipeline Indicator */}
      <div className="px-3.5 py-2 grid grid-cols-3 gap-2 text-[10px] font-mono border-b border-cyan-500/10 bg-black/20">
        <div className="flex items-center gap-1.5 text-cyan-200">
          <AppIcon name="check" size={10} className="text-emerald-400 shrink-0" />
          <span className="truncate">1. Query Dispatched</span>
        </div>
        <div className="flex items-center gap-1.5 text-cyan-200">
          {displayCount > 0 ? (
            <AppIcon name="check" size={10} className="text-emerald-400 shrink-0" />
          ) : isSearching ? (
            <AppIcon name="loader" size={10} className="text-cyan-400 shrink-0" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full border border-cyan-500/40 shrink-0" />
          )}
          <span className="truncate">2. Sources Found ({displayCount})</span>
        </div>
        <div className="flex items-center gap-1.5 text-cyan-200">
          {isComplete ? (
            <AppIcon name="check" size={10} className="text-emerald-400 shrink-0" />
          ) : isSearching ? (
            <AppIcon name="loader" size={10} className="text-cyan-400 shrink-0" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full border border-cyan-500/40 shrink-0" />
          )}
          <span className="truncate">3. Synthesizing</span>
        </div>
      </div>

      {/* Animated Progress Bar */}
      <div className="h-1 w-full bg-cyan-950/60 overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r from-cyan-500 via-indigo-400 to-purple-400 transition-all duration-500 ${
            isSearching ? 'w-2/3 animate-pulse' : 'w-full'
          }`}
        />
      </div>

      {/* Expandable Sources Drawer */}
      {expanded && sources.length > 0 && (
        <div className="p-3 bg-black/40 flex flex-wrap gap-1.5">
          {sources.map((s, i) => {
            let domain = '';
            try {
              domain = new URL(s.url).hostname;
            } catch (_) {}
            return (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 max-w-[240px] truncate bg-cyan-950/30 border border-cyan-500/20 text-cyan-200 hover:text-white hover:border-cyan-400/50 transition-all shadow-xs cursor-pointer"
                title={s.title || domain}
              >
                <span className="font-mono text-cyan-400 text-[10px]">[{s.citationId || i + 1}]</span>
                <span className="truncate">{s.title || domain}</span>
                <AppIcon name="external" size={10} className="shrink-0 opacity-60 ml-0.5" />
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
