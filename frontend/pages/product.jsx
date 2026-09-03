import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { RevealOnScroll } from '../components/ui/RevealOnScroll';
import {
  Cpu, Layers, ShieldCheck, Database, Zap, GitBranch,
  Terminal, ArrowRight, CheckCircle2, MessageSquare, Bot, Sparkles
} from 'lucide-react';

const ARCH_LAYERS = [
  {
    title: '1. Human-Interface Layer (Natural Language)',
    desc: 'Bilingual conversational frontend (English/Hinglish) providing clean, deep-thinking chat, voice streaming, and contextual artifact display without noisy multi-panel clutter.',
    tech: 'React 19 • Next.js 16 • Tailwind Tokens • Web Speech',
  },
  {
    title: '2. Autonomous Supervisor Engine',
    desc: 'Coordinates intent extraction, tool routing, multi-step planning, task DAG generation, checkpoint saves, and self-healing repair cycles up to 50 autonomous execution steps.',
    tech: 'Autonomous Loop • Capability Policy • Circuit Breaker',
  },
  {
    title: '3. Multi-Model Inference Cascade',
    desc: 'Eliminates rate limits and single-provider failures through an automated fallback cascade across free tiers and local offline models with 30s timeout guards.',
    tech: 'Gemini 1.5 Flash → Groq Llama 3 → OpenRouter → Ollama (qwen2.5-coder)',
  },
  {
    title: '4. Tool & Scaffolding Execution Layer',
    desc: 'Runs authorized local file modifications, full-stack scaffolding (React, Vite, Express), MS Office document compilation, image generation, and Playwright verification.',
    tech: 'Local FS • Docker Sandbox • Document Generators • Pollinations AI',
  },
  {
    title: '5. Universal Persistence & Knowledge Store',
    desc: 'Maintains long-term project files, chat history, agent learning, and git commits directly on the workstation without reliance on third-party cloud databases.',
    tech: 'Local SQLite • better-sqlite3 • Local .git Repository',
  },
];

export default function ProductPage() {
  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <PublicLayout
      title="Product Overview — AI-Dost Autonomous AI Workspace"
      description="Deep dive into AI-Dost architecture: how natural language requests transform into planned, executed, verified, and delivered software outcomes."
    >
      {/* ─── Hero ─── */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <RevealOnScroll direction="up" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-canvas-surface/80 border border-white/10 text-[11px] font-mono text-[#4893fc] shadow-[0_0_12px_rgba(66,133,244,0.15)]">
            <Sparkles className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Product Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            Simple Outside. <br />
            <span className="gemini-gradient-text">Autonomous Inside.</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            AI-Dost replaces the fragmented experience of copy-pasting code between browser tabs, terminals, and editors. A single unified system that plans, writes, tests, and verifies work in an isolated workspace.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="gemini-btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold transition-fast focus-ring shadow-md"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/capabilities"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-medium bg-canvas-surface/80 hover:bg-canvas-elevated text-paper-100 border border-white/10 transition-fast focus-ring"
            >
              <span>Explore Capabilities</span>
            </Link>
          </div>
        </RevealOnScroll>
      </section>

      {/* ─── Architectural Stack ─── */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <RevealOnScroll direction="up" className="space-y-3">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold block">
              The Engine Stack
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              5 Disciplined Architectural Layers
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted max-w-2xl">
              Engineered with clean separation of concerns. The interface handles conversation, the supervisor manages autonomy, the cascade ensures uptime, and tools operate within strictly bounded workspaces.
            </p>
          </RevealOnScroll>

          <div className="space-y-4">
            {ARCH_LAYERS.map((layer, idx) => (
              <RevealOnScroll
                key={idx}
                delay={idx * 80}
                direction="up"
                onMouseMove={handleCardMouseMove}
                className="gemini-glow-card p-6 rounded-2xl border border-white/10 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold font-display text-paper-100">
                    {layer.title}
                  </h3>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#4893fc] shrink-0 self-start sm:self-auto">
                    {layer.tech}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed font-sans">
                  {layer.desc}
                </p>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Core Pillars ─── */}
      <section className="py-16 md:py-24 bg-canvas-subtle border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <RevealOnScroll direction="up" className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold">
              Product Principles
            </h2>
            <p className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              Built on Core Engineering Values
            </p>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RevealOnScroll delay={0} direction="up" onMouseMove={handleCardMouseMove} className="gemini-glow-card p-6 border border-white/10 space-y-3">
              <Zap className="w-5 h-5 text-[#4893fc]" />
              <h4 className="text-sm font-semibold text-paper-100 font-display">Zero Quota Anxiety</h4>
              <p className="text-xs text-ink-muted leading-relaxed font-sans">
                Most AI tools halt the moment a free quota expires. AI-Dost cascades automatically across multiple tier-free providers, falling back to local Ollama if internet connectivity is completely lost.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={100} direction="up" onMouseMove={handleCardMouseMove} className="gemini-glow-card p-6 border border-white/10 space-y-3">
              <Database className="w-5 h-5 text-[#9b72cb]" />
              <h4 className="text-sm font-semibold text-paper-100 font-display">Deterministic Persistence</h4>
              <p className="text-xs text-ink-muted leading-relaxed font-sans">
                Your conversations, project workspaces, and generated documents are stored locally in SQLite. Restarting the process or rebooting your machine preserves all state exactly where you left off.
              </p>
            </RevealOnScroll>
            <RevealOnScroll delay={200} direction="up" onMouseMove={handleCardMouseMove} className="gemini-glow-card p-6 border border-white/10 space-y-3">
              <GitBranch className="w-5 h-5 text-[#d96570]" />
              <h4 className="text-sm font-semibold text-paper-100 font-display">Offline Git Versioning</h4>
              <p className="text-xs text-ink-muted leading-relaxed font-sans">
                Every file modification creates an atomic local checkpoint commit. Roll back to any prior state instantly without requiring a remote GitHub repository or network connection.
              </p>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 text-center space-y-4">
        <h3 className="text-xl sm:text-2xl font-bold font-display text-paper-100">
          Ready to experience the autonomous workspace?
        </h3>
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xs text-xs font-semibold bg-accent-primary hover:bg-accent-primary-strong text-black transition-fast"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
