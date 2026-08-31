import React from 'react';
import { motion } from 'framer-motion';

const EXAMPLE_PROMPTS = [
  {
    label: 'Build a portfolio website',
    prompt: 'Mujhe ek modern portfolio website banani hai. Clean design, projects section aur contact form chahiye.',
  },
  {
    label: 'Research a topic',
    prompt: 'India me AI startups ka detailed research karo aur key findings summarize karo.',
  },
  {
    label: 'Create an image',
    prompt: 'Ek futuristic city ka beautiful illustration banao, vibrant colors ke saath.',
  },
  {
    label: 'Analyze a file',
    prompt: 'Mera file attach kar ke analysis do — key points aur summary chahiye.',
  },
];

export default function QuickActionGrid({ onSelectPrompt }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-3xl mx-auto px-4 py-10 text-center"
    >
      <h2 className="text-2xl font-bold text-paper-100 tracking-tight mb-2">
        How can I help?
      </h2>
      <p className="text-sm text-ink-muted mb-8 max-w-md mx-auto leading-relaxed">
        Ask me to explain something, build something, research something,
        create something, or get something done.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onSelectPrompt(p.prompt)}
            className="px-3.5 py-3 rounded-xl border border-border bg-canvas-surface hover:bg-canvas-elevated hover:border-border-strong transition-fast text-left cursor-pointer focus-ring text-xs text-paper-200 hover:text-paper-100 leading-5"
          >
            {p.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
