import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { Tag, Sparkles, Wrench, Shield, CheckCircle2 } from 'lucide-react';

const RELEASES = [
  {
    version: 'v2.0.0-rc.1',
    date: 'September 2026',
    title: 'Core Architecture Freeze & Frontend Industry Foundations',
    highlights: [
      'Frozen 8-Stage Autonomous Execution Pipeline (Intent → Context → Plan → Execute → Observe → Verify → Repair → Deliver).',
      'Completed Phase F1 Interaction Foundations: Arrow navigation in Command Palette, accessible modal confirmations for destructive actions.',
      'Tokenized IDE Overlays and Copilot cards to fully adapt between Dark and Light mode themes.',
      'Eliminated external font network calls in favor of local self-hosted typography with zero FOUT.',
      'Enforced 44x44px minimum touch targets across all mobile viewports.',
      'Added ambient network connectivity banner to AppShell for offline detection.',
    ],
    fixes: [
      'Resolved test duplicate element disambiguation in modal confirmation dialogues.',
      'Added comprehensive unit test suite validating offline states, modals, and design tokens.',
    ],
  },
  {
    version: 'v2.0.0-beta.2',
    date: 'August 2026',
    title: 'Autonomous Full-Stack Scaffolding & Verification',
    highlights: [
      'One-Prompt Full-Stack Project Generation: creates 15+ file React+Vite+Express applications autonomously.',
      'Automated Test Verification: runs npm test automatically and executes up to 3 self-healing repair iterations.',
      'Visual Verification with Playwright: captures full-page browser screenshots of running dev servers inside isolated Docker sandboxes.',
      'Multi-framework template fallbacks: React+Vite, Next.js App Router, Astro, and SvelteKit.',
    ],
    fixes: [
      'Fixed parseLLMAction parameter dropping for prompt and targetDir keys.',
      'Isolated scaffold workspace paths from backend root directory.',
    ],
  },
  {
    version: 'v2.0.0-beta.1',
    date: 'July 2026',
    title: 'Multi-Model Cascade & MS Office Document Engine',
    highlights: [
      'Multi-Model AI Cascade: automatic fallback from Gemini 1.5 Flash → Groq Llama 3 → OpenRouter → local Ollama (qwen2.5-coder).',
      'Native MS Office Document Generation: .docx, .pptx, .xlsx, .csv, and printable PDF reports directly from chat.',
      'Monaco Code Editor integration with syntax highlighting for 15+ languages and local git-level checkpoint rollbacks.',
      'Telegram Bot integration with long-polling for remote mobile control.',
    ],
    fixes: [
      'Fixed pptxgenjs v4 writeFile casing parameter bug.',
      'Fixed WebSocket upgrade collisions in sandbox container server.',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <PublicLayout
      title="Changelog & Releases — AI-Dost"
      description="Verified chronological release history of AI-Dost: architectural milestones, capability upgrades, and fixes."
    >
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="gemini-shimmer-badge text-[11px] font-mono text-[#4893fc]">
            <Tag className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Release History</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            AI-Dost <span className="gemini-gradient-text">Changelog</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            Chronological documentation of major architectural iterations, feature additions, and security hardenings.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {RELEASES.map((rel) => (
            <div
              key={rel.version}
              className="gemini-glow-card p-6 sm:p-8 border border-white/10 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#4893fc] shadow-[0_0_12px_rgba(66,133,244,0.18)]">
                    {rel.version}
                  </span>
                  <h2 className="text-base sm:text-lg font-bold font-display text-paper-100">
                    {rel.title}
                  </h2>
                </div>
                <span className="text-xs font-mono text-ink-muted">{rel.date}</span>
              </div>

              {/* Highlights */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#4893fc] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Key Architectural Additions
                </h3>
                <ul className="space-y-1.5 text-xs text-paper-200 font-sans pl-1">
                  {rel.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#4893fc] mt-0.5">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Fixes */}
              {rel.fixes && rel.fixes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-[#9b72cb] font-bold flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" /> Bug Fixes & Hardenings
                  </h3>
                  <ul className="space-y-1 text-xs text-ink-muted font-sans pl-1">
                    {rel.fixes.map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#9b72cb] mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
