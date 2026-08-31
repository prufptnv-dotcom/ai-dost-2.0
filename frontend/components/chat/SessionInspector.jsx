import React from 'react';
import {
  X,
  Code2,
  Globe,
  FileCode2,
  Terminal,
  Brain,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export default function SessionInspector({
  sessionId = 'ai-dost-session-001',
  isLive = true,
  duration = '24m 18s',
  tokens = '12.4k',
  model = 'Gemini 2.5 Pro',
  temperature = 0.3,
  maxTokens = 8192,
  toolsState = 'Auto',
  artifacts = [],
  agentActivity = [],
  onClose,
  onOpenArtifact,
  onNavigateToAgent,
}) {
  const defaultArtifacts = [
    { name: 'architecture-diagram.png', time: '2m ago', type: 'PNG', color: 'text-amber-400 bg-amber-500/10' },
    { name: 'api-specification.md', time: '5m ago', type: 'MD', color: 'text-blue-400 bg-blue-500/10' },
    { name: 'database-schema.sql', time: '15m ago', type: 'SQL', color: 'text-purple-400 bg-purple-500/10' },
    { name: 'chat-streaming.js', time: '30m ago', type: 'JS', color: 'text-emerald-400 bg-emerald-500/10' },
    { name: 'verification-report.json', time: '1h ago', type: 'JSON', color: 'text-rose-400 bg-rose-500/10' },
  ];

  const defaultAgentActivity = [
    { role: 'Supervisor', status: 'Running', color: 'text-emerald-400 bg-emerald-500/15' },
    { role: 'Researcher', status: 'Analyzing', color: 'text-cyan-400 bg-cyan-500/15' },
    { role: 'Coder', status: 'Building', color: 'text-blue-400 bg-blue-500/15' },
    { role: 'Verifier', status: 'Validating', color: 'text-amber-400 bg-amber-500/15' },
    { role: 'Human Approval', status: 'Waiting', color: 'text-purple-400 bg-purple-500/15' },
  ];

  const displayArtifacts = artifacts.length > 0 ? artifacts : defaultArtifacts;
  const displayActivity = agentActivity.length > 0 ? agentActivity : defaultAgentActivity;

  return (
    <aside className="w-[320px] shrink-0 h-full border-l border-border bg-canvas-subtle flex flex-col overflow-y-auto select-none z-30">
      {/* Active Session Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-paper-100">Active Session</span>
            {isLive && (
              <span className="flex items-center gap-1 text-[9px] font-mono font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-ink-muted mt-0.5">{sessionId}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-muted hover:text-paper-100 hover:bg-canvas-surface transition-fast cursor-pointer focus-ring"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Duration & Tokens Metric Card */}
        <div className="p-3.5 rounded-xl bg-canvas-surface border border-border shadow-sm">
          <div className="flex items-center justify-between text-xs text-paper-300 mb-2">
            <div>
              <span className="text-ink-muted text-[10px] uppercase font-mono block">Duration</span>
              <span className="font-semibold text-paper-100">{duration}</span>
            </div>
            <div className="text-right">
              <span className="text-ink-muted text-[10px] uppercase font-mono block">Tokens</span>
              <span className="font-semibold text-indigo-400">{tokens}</span>
            </div>
          </div>
          {/* Progress gradient bar */}
          <div className="w-full h-1.5 rounded-full bg-canvas-elevated overflow-hidden flex">
            <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full w-[45%]" />
          </div>
        </div>

        {/* Session Tools */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-2.5">
            Session tools
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: 'Code', icon: Code2, color: 'text-blue-400 hover:bg-blue-500/15' },
              { label: 'Web', icon: Globe, color: 'text-cyan-400 hover:bg-cyan-500/15' },
              { label: 'Files', icon: FileCode2, color: 'text-amber-400 hover:bg-amber-500/15' },
              { label: 'Terminal', icon: Terminal, color: 'text-emerald-400 hover:bg-emerald-500/15' },
              { label: 'Memory', icon: Brain, color: 'text-purple-400 hover:bg-purple-500/15' },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border border-border bg-canvas-surface transition-fast cursor-pointer focus-ring shadow-sm ${tool.color}`}
                  title={tool.label}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span className="text-[9px] font-medium text-paper-300">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Artifacts */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              Recent Artifacts
            </span>
            <button
              type="button"
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-fast cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="space-y-1.5">
            {displayArtifacts.map((art) => (
              <button
                key={art.name}
                type="button"
                onClick={() => onOpenArtifact?.(art)}
                className="w-full p-2 rounded-lg border border-border bg-canvas-surface hover:bg-canvas-elevated hover:border-indigo-500/30 flex items-center justify-between gap-2 text-left transition-fast cursor-pointer focus-ring shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs text-paper-200 truncate">{art.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] text-ink-muted font-mono">{art.time}</span>
                  <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${art.color}`}>
                    {art.type}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent Activity */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">
              Agent Activity
            </span>
            <button
              type="button"
              onClick={onNavigateToAgent}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium transition-fast cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="space-y-1.5">
            {displayActivity.map((ag) => (
              <div
                key={ag.role}
                className="p-2 rounded-lg border border-border bg-canvas-surface flex items-center justify-between gap-2 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-xs font-medium text-paper-200">{ag.role}</span>
                </div>
                <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full border border-border/40 ${ag.color}`}>
                  {ag.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Settings */}
        <div className="pt-2 border-t border-border space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-ink-muted mb-2">
            Chat Settings
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-ink-muted">Model</span>
            <span className="font-semibold text-paper-100">{model}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-ink-muted">Temperature</span>
            <span className="font-mono text-paper-200">{temperature}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-ink-muted">Max Tokens</span>
            <span className="font-mono text-paper-200">{maxTokens}</span>
          </div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="text-ink-muted">Tools</span>
            <span className="text-emerald-400 font-semibold">{toolsState}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
