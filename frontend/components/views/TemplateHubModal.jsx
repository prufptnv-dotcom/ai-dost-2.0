import React from 'react';
import {
  Sparkles, X, ShieldCheck, ShoppingCart, BarChart3,
  Kanban, MessageSquare, Bot, ArrowRight, Zap
} from 'lucide-react';

const ARCHETYPES = [
  {
    id: 'auth_fullstack',
    title: 'Fullstack Auth & Database',
    badge: 'Database + JWT',
    icon: ShieldCheck,
    color: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    description: 'Complete SQLite database app with password encryption, JWT authentication, user registration modal, and protected REST API endpoints.',
    prompt: 'Build a production-ready Fullstack Web App with SQLite database, JWT authentication, login/signup modals, and protected user records CRUD.'
  },
  {
    id: 'ecommerce',
    title: 'Modern E-Commerce Store',
    badge: 'Storefront + Cart',
    icon: ShoppingCart,
    color: 'from-blue-500/20 to-indigo-500/20',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
    description: 'Interactive product catalog with categories, search filtering, animated shopping cart drawer, and responsive checkout payment modal.',
    prompt: 'Build a modern E-Commerce Store with product search filters, category pills, slide-out shopping cart drawer, and checkout modal.'
  },
  {
    id: 'dashboard',
    title: 'SaaS Analytics Dashboard',
    badge: 'KPIs + Analytics',
    icon: BarChart3,
    color: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400',
    description: 'Executive analytics dashboard with revenue growth charts, KPI summary metric cards, transaction tables, and time-range filters.',
    prompt: 'Build a SaaS Analytics Dashboard with KPI metric cards, revenue analytics, search & filter transaction tables, and dark theme.'
  },
  {
    id: 'kanban',
    title: 'Agile Kanban Task Board',
    badge: 'Productivity',
    icon: Kanban,
    color: 'from-amber-500/20 to-orange-500/20',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
    description: 'Trello-style Agile board with Todo, In Progress, and Completed columns, priority status badges, and task creation dialogs.',
    prompt: 'Build an Agile Kanban Board with draggable columns (Todo, In Progress, Done), priority tags, and add task modals.'
  },
  {
    id: 'chat_social',
    title: 'Realtime Chat & Community',
    badge: 'Messaging',
    icon: MessageSquare,
    color: 'from-cyan-500/20 to-blue-500/20',
    borderColor: 'border-cyan-500/40',
    textColor: 'text-cyan-400',
    description: 'Multi-channel messaging app with chat bubbles, active online presence indicator, search, and message stream API.',
    prompt: 'Build a Realtime Chat App with channel sidebar, direct messaging, chat bubbles, and message stream backend.'
  },
  {
    id: 'ai_studio',
    title: 'AI Prompt Studio & Playground',
    badge: 'AI Tools',
    icon: Bot,
    color: 'from-violet-500/20 to-purple-500/20',
    borderColor: 'border-violet-500/40',
    textColor: 'text-violet-400',
    description: 'Dark-themed AI playground with prompt parameter controls (temperature, tokens), code synthesizer, and 1-click copy.',
    prompt: 'Build an AI Prompt Studio and code synthesizer playground with model presets, parameter sliders, and dark monospace theme.'
  }
];

export default function TemplateHubModal({ isOpen, onClose, onSelectTemplate }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden bg-zinc-950 border-zinc-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Golden Template Hub
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Instant 1-Click Launch
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Choose a production-ready archetype to scaffold full-stack code in seconds
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
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
                className={`group relative flex flex-col p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:shadow-xl bg-gradient-to-br ${t.color} ${t.borderColor} hover:border-white/40`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/40 border border-white/10">
                    <Icon className={`w-5 h-5 ${t.textColor}`} />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider bg-black/30 border border-white/10 ${t.textColor}`}>
                    {t.badge}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1 group-hover:text-indigo-200 transition-colors">
                  {t.title}
                </h3>
                <p className="text-xs text-zinc-300/80 leading-relaxed mb-4 flex-1">
                  {t.description}
                </p>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-semibold text-white group-hover:text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Launch Archetype
                  </span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-400">
          <span>⚡ All archetypes include React frontend, Express API backend, and responsive UI.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
