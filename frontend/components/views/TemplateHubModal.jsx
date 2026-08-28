import React from 'react';
import {
  Sparkles, X, ShieldCheck, ShoppingCart, BarChart3,
  Kanban, MessageSquare, Bot, ArrowRight, Zap, Layers
} from 'lucide-react';

const ARCHETYPES = [
  {
    id: 'auth_fullstack',
    title: 'Fullstack Auth & Database',
    badge: 'Database + JWT',
    icon: ShieldCheck,
    color: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    textColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    description: 'Complete SQLite database app with password encryption, JWT authentication, user registration modal, and protected REST API endpoints.',
    prompt: 'Build a production-ready Fullstack Web App with SQLite database, JWT authentication, login/signup modals, and protected user records CRUD.'
  },
  {
    id: 'ecommerce',
    title: 'Modern E-Commerce Store',
    badge: 'Storefront + Cart',
    icon: ShoppingCart,
    color: 'from-sky-500/10 via-blue-500/5 to-transparent',
    borderColor: 'border-sky-500/30 hover:border-sky-500/60',
    textColor: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    description: 'Interactive product catalog with categories, search filtering, animated shopping cart drawer, and responsive checkout payment modal.',
    prompt: 'Build a modern E-Commerce Store with product search filters, category pills, slide-out shopping cart drawer, and checkout modal.'
  },
  {
    id: 'dashboard',
    title: 'SaaS Analytics Dashboard',
    badge: 'KPIs + Analytics',
    icon: BarChart3,
    color: 'from-purple-500/10 via-indigo-500/5 to-transparent',
    borderColor: 'border-purple-500/30 hover:border-purple-500/60',
    textColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    description: 'Executive analytics dashboard with revenue growth charts, KPI summary metric cards, transaction tables, and time-range filters.',
    prompt: 'Build a SaaS Analytics Dashboard with KPI metric cards, revenue analytics, search & filter transaction tables, and dark theme.'
  },
  {
    id: 'kanban',
    title: 'Agile Kanban Task Board',
    badge: 'Productivity',
    icon: Kanban,
    color: 'from-amber-500/10 via-orange-500/5 to-transparent',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    textColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    description: 'Trello-style Agile board with Todo, In Progress, and Completed columns, priority status badges, and task creation dialogs.',
    prompt: 'Build an Agile Kanban Board with draggable columns (Todo, In Progress, Done), priority tags, and add task modals.'
  },
  {
    id: 'chat_social',
    title: 'Realtime Chat & Community',
    badge: 'Messaging',
    icon: MessageSquare,
    color: 'from-cyan-500/10 via-sky-500/5 to-transparent',
    borderColor: 'border-cyan-500/30 hover:border-cyan-500/60',
    textColor: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    description: 'Multi-channel messaging app with chat bubbles, active online presence indicator, search, and message stream API.',
    prompt: 'Build a Realtime Chat App with channel sidebar, direct messaging, chat bubbles, and message stream backend.'
  },
  {
    id: 'ai_studio',
    title: 'AI Prompt Studio & Playground',
    badge: 'AI Tools',
    icon: Bot,
    color: 'from-violet-500/10 via-purple-500/5 to-transparent',
    borderColor: 'border-violet-500/30 hover:border-violet-500/60',
    textColor: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    description: 'Dark-themed AI playground with prompt parameter controls (temperature, tokens), code synthesizer, and 1-click copy.',
    prompt: 'Build an AI Prompt Studio and code synthesizer playground with model presets, parameter sliders, and dark monospace theme.'
  }
];

export default function TemplateHubModal({ isOpen, onClose, onSelectTemplate }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-popover overflow-hidden bg-[#0f1117] border-white/[0.08]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#161821]/70 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 border border-sky-500/20 text-sky-400 shadow-glow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Golden Template Hub
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                  Instant 1-Click Launch
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-sans">
                Choose a production-ready archetype to scaffold full-stack code in seconds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARCHETYPES.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                onClick={() => {
                  onSelectTemplate(t.prompt);
                  onClose();
                }}
                className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] shadow-surface-card bg-[#161821] bg-gradient-to-br ${t.color} ${t.borderColor}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#090a0f] border border-white/[0.08]">
                    <Icon className={`w-4 h-4 ${t.textColor}`} />
                  </div>
                  <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${t.badgeBg}`}>
                    {t.badge}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-white mb-1.5 group-hover:text-sky-300 transition-colors">
                  {t.title}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4 flex-1 font-sans">
                  {t.description}
                </p>

                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-medium text-neutral-300 group-hover:text-white">
                  <span className="flex items-center gap-1.5 text-sky-400 text-[11px] font-mono">
                    <Sparkles className="w-3.5 h-3.5" />
                    Launch Archetype
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform text-sky-400" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-[#161821]/40 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span>⚡ All archetypes include React frontend, Express API backend, and responsive UI.</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-[#161821] hover:bg-[#1c1f2b] border border-white/[0.08] hover:border-white/[0.18] text-neutral-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
