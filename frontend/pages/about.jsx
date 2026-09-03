import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { AiDostMark } from '../components/brand/AiDostMark';
import { Heart, Code2, Globe, Shield, Terminal, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <PublicLayout
      title="About AI-Dost — Autonomous AI Developer Workspace"
      description="The story, mission, and open-source engineering philosophy behind AI-Dost: Simple Chat Outside, Autonomous System Inside."
    >
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="gemini-shimmer-badge text-[11px] font-mono text-[#4893fc]">
            <Code2 className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Project Mission</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            About <span className="gemini-gradient-text">AI-Dost</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            We believe software development should feel like an intuitive conversation with a capable partner—not endless boilerplate, broken context, and fragmented tools.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 font-sans text-xs text-paper-200 leading-relaxed">
          {/* Mission */}
          <div className="gemini-glow-card p-6 sm:p-8 border border-white/10 space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#4893fc]" /> The Genesis of AI-Dost
            </h2>
            <p className="text-paper-200 leading-relaxed font-sans">
              In 2024–2026, generative AI transformed how code is written, but introduced a new friction: developers spent endless hours copy-pasting code snippets out of web chatbots into IDEs, debugging runtime syntax errors manually, and dealing with quota cutoffs.
            </p>
            <p className="text-paper-200 leading-relaxed font-sans">
              <strong className="text-white">AI-Dost was built to eliminate this gap.</strong> Instead of just answering questions with text, AI-Dost is an autonomous system. When you ask for an application, it formulates a plan, scaffolds files, installs dependencies, runs tests, self-heals bugs, and delivers working software.
            </p>
          </div>

          {/* Philosophy */}
          <div className="space-y-4">
            <h2 className="text-base font-bold font-display text-paper-100">Our 4 Core Engineering Tenets</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="gemini-glow-card p-5 border border-white/10 space-y-1.5">
                <span className="font-semibold text-paper-100 font-display text-xs text-[#4893fc]">1. Simple Outside, Autonomous Inside</span>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  The user experience remains as simple as natural conversation. The 8-stage autonomy pipeline operates under the hood.
                </p>
              </div>
              <div className="gemini-glow-card p-5 border border-white/10 space-y-1.5">
                <span className="font-semibold text-paper-100 font-display text-xs text-[#9b72cb]">2. Local-First Sovereignty</span>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  Your files, code, and SQLite databases belong to your local machine. No telemetry or secret cloud synchronization.
                </p>
              </div>
              <div className="gemini-glow-card p-5 border border-white/10 space-y-1.5">
                <span className="font-semibold text-paper-100 font-display text-xs text-[#d96570]">3. Free-Tier Accessibility</span>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  Multi-provider cascade (Gemini, Groq, OpenRouter) and local Ollama ensure you can build without expensive subscriptions.
                </p>
              </div>
              <div className="gemini-glow-card p-5 border border-white/10 space-y-1.5">
                <span className="font-semibold text-paper-100 font-display text-xs text-[#1ba1e2]">4. Mathematical Safety</span>
                <p className="text-ink-muted text-[11px] leading-relaxed">
                  Role capability policies, normalized filesystem boundaries, and human confirmation gates ensure secure execution.
                </p>
              </div>
            </div>
          </div>

          {/* Transparent Team & Scope */}
          <div className="gemini-glow-card p-6 border border-white/10 space-y-3">
            <h2 className="text-base font-bold font-display text-paper-100">Transparent Project Scope</h2>
            <p className="text-paper-200 leading-relaxed font-sans">
              AI-Dost is an independent open-source software project crafted with care for developers globally. We do not manufacture fake corporate metrics, venture capital hype, or fabricated employee rosters. The product stands purely on its technical architecture, comprehensive test coverage, and developer utility.
            </p>
            <div className="pt-2">
              <Link
                href="/changelog"
                className="inline-flex items-center gap-1.5 text-[#4893fc] hover:underline font-semibold"
              >
                <span>View our verified release changelog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
