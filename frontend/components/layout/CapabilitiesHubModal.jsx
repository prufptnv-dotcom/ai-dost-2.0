import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, Sparkles, Code2, Bot, Puzzle, Zap,
  Image as ImageIcon, Move3d, PenTool, FileText,
  BarChart3, Calendar, Scale, Building2, Languages,
  MapPinned, ShieldCheck, ArrowRight
} from 'lucide-react';

export const CAPABILITY_GROUPS = [
  {
    title: 'Code & Autonomous Engineering',
    items: [
      { id: 'copilot', label: 'Copilot IDE', desc: 'In-browser editor, WebContainer dev server & live preview', icon: Code2, badge: 'Core' },
      { id: 'agent', label: 'Agent Workbench', desc: 'Autonomous planning, terminal execution & self-healing', icon: Bot, badge: 'Agentic' },
      { id: 'mcp', label: 'MCP Integrations', desc: 'Model Context Protocol servers & external bridges', icon: Puzzle, badge: 'Protocol' },
      { id: 'skills', label: 'Skills Marketplace', desc: 'On-demand agent skills, workflows & prompt extensions', icon: Sparkles, badge: 'Skills' },
      { id: 'automations', label: 'Automations & Watchers', desc: 'Background cron jobs, file watchers & workflows', icon: Zap, badge: 'Cron' },
    ],
  },
  {
    title: 'Creative Studios & Media',
    items: [
      { id: 'images', label: 'Image Studio', desc: 'Z-Image Turbo generation & visual prompt studio', icon: ImageIcon, badge: 'Turbo' },
      { id: 'animations', label: '3D Motion Studio', desc: 'Anime.js & Three.js 3D kinetic visualizations', icon: Move3d, badge: '3D WebGL' },
      { id: 'writing', label: 'Writing & Copy Studio', desc: 'Executive reports, articles, emails & technical copy', icon: PenTool, badge: 'Studio' },
      { id: 'resume', label: 'Resume & CV Builder', desc: 'ATS-optimized professional resume generator with PDF export', icon: FileText, badge: 'PDF' },
    ],
  },
  {
    title: 'Data, Planning & Decision',
    items: [
      { id: 'analytics', label: 'Data Analytics Studio', desc: 'Dataset exploration, metric charts & SQL generation', icon: BarChart3, badge: 'Analytics' },
      { id: 'planner', label: 'Productivity Planner', desc: 'Habit tracker, routines & sprint schedules', icon: Calendar, badge: 'Habits' },
      { id: 'decision', label: 'Decision Matrix & RICE', desc: 'Trade-off analysis, tech stack matrix & weighted scoring', icon: Scale, badge: 'Framework' },
      { id: 'artifacts', label: 'Artifacts Gallery', desc: 'Saved interactive canvases, documents & code snippets', icon: FileText, badge: 'Library' },
    ],
  },
  {
    title: 'Bharat & Specialized Hubs',
    items: [
      { id: 'bharat', label: 'Bharat Open APIs Hub', desc: 'Free Indian public data APIs (PIN, IFSC, ISRO, Weather)', icon: Building2, badge: 'India' },
      { id: 'language', label: 'Language & Translation Hub', desc: 'Polyglot translation, grammar polish & Hinglish studio', icon: Languages, badge: 'Polyglot' },
      { id: 'travel', label: 'Travel & Local Explorer', desc: 'Itinerary builder, restaurant discovery & packing checklist', icon: MapPinned, badge: 'Travel' },
      { id: 'security', label: 'Security & Cyber Hub', desc: 'OWASP vulnerability audit, security headers & threat model', icon: ShieldCheck, badge: 'Security' },
      { id: 'capabilities', label: '50-Domain Master Catalog', desc: 'Complete enterprise taxonomy of 50 AI domains', icon: Sparkles, badge: 'Catalog' },
    ],
  },
];

export default function CapabilitiesHubModal({
  isOpen = false,
  onClose,
  onSelectView,
  currentView = 'chat',
}) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredGroups = CAPABILITY_GROUPS.map((grp) => {
    const matchingItems = grp.items.filter(
      (item) =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.desc.toLowerCase().includes(search.toLowerCase()) ||
        item.badge.toLowerCase().includes(search.toLowerCase())
    );
    return { ...grp, items: matchingItems };
  }).filter((grp) => grp.items.length > 0);

  const handleLaunch = (viewId) => {
    onSelectView?.(viewId);
    onClose?.();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-canvas-surface border border-border shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-canvas-elevated">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-paper-100">
                  AI-Dost Capabilities & Studios Hub
                </h2>
                <p className="text-xs text-ink-muted">
                  Explore specialized autonomous agents, studios, and Indian data hubs
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-canvas-overlay text-ink-muted hover:text-paper-100 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-3 border-b border-border bg-canvas-base/50 flex items-center gap-3">
            <Search className="w-4 h-4 text-ink-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools, studios, skills, or data hubs..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-paper-100 placeholder:text-ink-muted outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-[11px] text-ink-muted hover:text-paper-100 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Body Categories */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {filteredGroups.length === 0 ? (
              <div className="text-center py-12 text-ink-muted text-xs">
                No tools or studios match &quot;{search}&quot;.
              </div>
            ) : (
              filteredGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2.5">
                  <h3 className="text-[11px] font-mono uppercase tracking-wider text-ink-muted font-semibold px-1">
                    {group.title}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isCurrent = currentView === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleLaunch(item.id)}
                          className={`group relative text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer flex items-start gap-3.5 ${
                            isCurrent
                              ? 'bg-accent/10 border-accent text-paper-100 shadow-sm'
                              : 'bg-canvas-elevated hover:bg-canvas-overlay border-border hover:border-accent/40 text-paper-200'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isCurrent
                                ? 'bg-accent text-white'
                                : 'bg-canvas-surface border border-border group-hover:border-accent/40 group-hover:text-accent text-ink-muted'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-paper-100 truncate">
                                {item.label}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-surface border border-border font-mono text-ink-muted group-hover:text-paper-100 shrink-0">
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-1 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>

                          <ArrowRight className="w-3.5 h-3.5 text-ink-muted opacity-0 group-hover:opacity-100 group-hover:text-accent transition-all shrink-0 mt-2 -translate-x-1 group-hover:translate-x-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Note */}
          <div className="px-6 py-3 border-t border-border bg-canvas-elevated flex items-center justify-between text-[11px] text-ink-muted">
            <span>Tip: You can also summon any studio directly from chat or press <kbd className="px-1.5 py-0.5 rounded bg-canvas-surface border border-border font-mono text-[10px] text-paper-200">Ctrl K</kbd></span>
            <button
              onClick={onClose}
              className="text-paper-100 hover:text-accent transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
