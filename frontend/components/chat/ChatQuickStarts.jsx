import React from 'react';
import AppIcon from '../ui/AppIcon';
import { AiDostMark } from '../brand/AiDostMark';

export default function ChatQuickStarts({ onSelectPrompt }) {
  const cards = [
    {
      id: '3d-solar',
      title: '3D Solar System',
      description: 'Interactive Three.js physics & orbital simulation',
      prompt: 'Create an interactive 3D Solar System simulation in Three.js',
      icon: 'sparkles',
    },
    {
      id: 'fullstack-app',
      title: 'Full-Stack React App',
      description: 'Live workspace preview with modern UI',
      prompt: 'Generate a full-stack modern task management app with React and Tailwind',
      icon: 'code',
    },
    {
      id: 'research-pdf',
      title: 'Executive Research PDF',
      description: 'Multi-source verified dossier & export',
      prompt: 'Deep research on Autonomous AI Agents in 2026 report banao pdf me',
      icon: 'file',
    },
    {
      id: 'security-hub',
      title: 'Security Audit Hub',
      description: 'OWASP compliance & threat modeling',
      prompt: 'Run an automated security audit checklist for Next.js web apps',
      icon: 'shield',
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[48vh] w-full max-w-2xl mx-auto px-4 text-center select-none py-8">
      <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/20 shadow-lg mb-6 transition-transform hover:scale-105 duration-200">
        <AiDostMark size={30} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-paper-100 tracking-tight mb-2">
        Hey. What are we working on today?
      </h1>
      <p className="text-sm text-ink-muted max-w-md mx-auto leading-relaxed mb-8">
        Ask me anything, or summon interactive tools, code apps, 3D simulations, and research on demand.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-xl text-left">
        {cards.map((card) => {
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelectPrompt(card.prompt)}
              className="group flex items-start gap-3.5 p-4 rounded-2xl bg-canvas-surface/60 hover:bg-canvas-surface backdrop-blur-md border border-border hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5 text-left"
            >
              <div className="p-2.5 rounded-xl bg-canvas-elevated group-hover:bg-accent/15 border border-border group-hover:border-accent/30 text-ink-muted group-hover:text-accent transition-all duration-200 shrink-0 mt-0.5">
                <AppIcon name={card.icon} size={16} />
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
