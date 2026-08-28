import React from 'react';
import { 
  Sparkles, 
  Terminal, 
  Layers, 
  Play, 
  Share2, 
  Settings, 
  ChevronDown,
  Circle,
  Command
} from 'lucide-react';

export default function AppHeader({ onOpenTemplates, isRunning, onRunProject, projectName = 'my-fullstack-app', modelName = 'Claude 3.5 Sonnet' }) {
  return (
    <header className="h-14 border-b border-white/[0.08] bg-[#0f1117]/80 backdrop-blur-md px-4 flex items-center justify-between select-none z-30">
      {/* Left: Brand & Active Project */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#161821] border border-white/[0.08]">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shadow-glow-sm">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight text-white">AI DOST</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono font-medium border border-sky-500/20">
            v2.0
          </span>
        </div>

        <div className="h-4 w-[1px] bg-white/[0.08]" />

        {/* Project Selector */}
        <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-neutral-300 hover:text-white hover:bg-white/[0.04] transition-colors border border-transparent hover:border-white/[0.06]">
          <span className="font-medium text-neutral-200">{projectName}</span>
          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
        </button>
      </div>

      {/* Center: Status & Model Indicator */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-[#161821]/60 border border-white/[0.06] text-xs text-neutral-400">
        <Circle className="w-2 h-2 text-emerald-400 fill-emerald-400 animate-pulse" />
        <span className="text-neutral-300 font-medium">Copilot Agent</span>
        <span className="text-neutral-600">•</span>
        <span className="font-mono text-[11px] text-neutral-400">{modelName}</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {onOpenTemplates && (
          <button 
            onClick={onOpenTemplates}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-neutral-300 hover:text-white bg-[#161821] hover:bg-[#1c1f2b] border border-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Templates</span>
          </button>
        )}

        <button 
          onClick={onRunProject}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 border border-sky-400/30 shadow-glow-sm transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>{isRunning ? 'Running' : 'Run App'}</span>
        </button>

        <div className="h-4 w-[1px] bg-white/[0.08] mx-1" />

        <button className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors" title="Share Project">
          <Share2 className="w-4 h-4" />
        </button>
        <button className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors" title="Settings">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
