import React from 'react';
import { Sparkles, Code2, FileText, ShieldCheck } from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

export default function ChatQuickStarts({ onSelectPrompt }) {
  const cards = [
    {
      id: '3d-solar',
      title: '3D Solar System',
      description: 'Interactive Three.js physics & orbital simulation',
      prompt: 'Create an interactive 3D Solar System simulation in Three.js',
      icon: Sparkles,
    },
    {
      id: 'fullstack-app',
      title: 'Full-Stack React App',
      description: 'Live workspace preview with modern UI',
      prompt: 'Generate a full-stack modern task management app with React and Tailwind',
      icon: Code2,
    },
    {
      id: 'research-pdf',
      title: 'Executive Research PDF',
      description: 'Multi-source verified dossier & export',
      prompt: 'Deep research on Autonomous AI Agents in 2026 report banao pdf me',
      icon: FileText,
    },
    {
      id: 'security-hub',
      title: 'Security Audit Hub',
      description: 'OWASP compliance & threat modeling',
      prompt: 'Run an automated security audit checklist for Next.js web apps',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[48vh] w-full max-w-2xl mx-auto px-4 text-center select-none py-8">
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-canvas-surface border border-border shadow-xs mb-5 transition-transform hover:scale-105 duration-200">
        <AiDostMark size={26} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-paper-100 tracking-tight mb-2">
        Hey. What are we working on today?
      </h1>
      <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed mb-8">
        Ask me anything, or summon interactive tools, code apps, 3D simulations, and research on demand.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-xl text-left">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectPrompt(card.prompt)}
              className="group flex items-start gap-3.5 p-4 rounded-2xl bg-canvas-surface/70 hover:bg-canvas-surface backdrop-blur-md border border-border hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-lg hover:shadow-accent/5 text-left"
            >
              <div className="p-2.5 rounded-xl bg-canvas-elevated group-hover:bg-accent/15 border border-border group-hover:border-accent/30 text-ink-muted group-hover:text-accent transition-all duration-200 shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-paper-100 group-hover:text-accent transition-colors">
                  {card.title}
                </div>
                <div className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">
                  {card.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
