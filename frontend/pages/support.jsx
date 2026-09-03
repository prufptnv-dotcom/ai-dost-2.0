import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import {
  HelpCircle, BookOpen, Terminal, Bug, ShieldAlert,
  ArrowRight, ExternalLink, CheckCircle2
} from 'lucide-react';

const COMMON_QUESTIONS = [
  {
    q: 'How do I start the AI-Dost backend and frontend locally?',
    a: 'Run `cd backend && node server.js` to start the core API on port 5000. In a second terminal, run `cd frontend && npm run dev` to start the Next.js frontend on port 3000.',
  },
  {
    q: 'Where do I get a free API key to run AI-Dost?',
    a: 'You can get a free Google Gemini API key from Google AI Studio (makersuite.google.com). Add it to your `.env` file as `GEMINI_API_KEY=your_key`. The free tier includes 1,500 requests per day.',
  },
  {
    q: 'Can I use AI-Dost completely offline without internet?',
    a: 'Yes. Install Ollama (ollama.com) and pull the code model: `ollama pull qwen2.5-coder:7b`. Start `ollama serve`. AI-Dost will automatically utilize your local model if offline or if cloud quotas are exhausted.',
  },
  {
    q: 'Are my project files or code sent to external servers?',
    a: 'No. All project workspaces, code modifications, and conversation records are stored locally in your workstation SQLite database (aidost.db). Only the prompt and required code context sent during cloud model queries travel to the chosen LLM provider.',
  },
  {
    q: 'What should I do if an autonomous task seems stuck or errors out?',
    a: 'AI-Dost includes a 50-step execution ceiling and 30-second timeouts per tool invocation. You can also interrupt or inspect any active step from the agent workbench view.',
  },
];

export default function SupportPage() {
  return (
    <PublicLayout
      title="Support & Diagnostics — AI-Dost"
      description="Developer support, diagnostics, common questions, and community issue reporting for AI-Dost."
    >
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="gemini-shimmer-badge text-[11px] font-mono text-[#4893fc]">
            <HelpCircle className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Developer Support</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            Support & <span className="gemini-gradient-text">Community Hub</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            Need help configuring your local environment, setting up API cascades, or reporting a bug? We are here to help.
          </p>
        </div>
      </section>

      {/* ─── Resource Quicklinks ─── */}
      <section className="py-12 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Link
              href="/docs"
              className="gemini-glow-card p-6 border border-white/10 space-y-2 group block"
            >
              <BookOpen className="w-5 h-5 text-[#4893fc]" />
              <h3 className="text-sm font-semibold text-paper-100 group-hover:text-[#4893fc] transition-fast">
                Technical Documentation
              </h3>
              <p className="text-xs text-ink-muted">
                Step-by-step installation guides, architectural explanations, and tool usage blueprints.
              </p>
            </Link>

            <Link
              href="/docs/troubleshooting"
              className="gemini-glow-card p-6 border border-white/10 space-y-2 group block"
            >
              <Terminal className="w-5 h-5 text-[#9b72cb]" />
              <h3 className="text-sm font-semibold text-paper-100 group-hover:text-[#9b72cb] transition-fast">
                Troubleshooting Runbooks
              </h3>
              <p className="text-xs text-ink-muted">
                Quick diagnostic checklists for port conflicts, model timeouts, and Docker sandbox errors.
              </p>
            </Link>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="gemini-glow-card p-6 border border-white/10 space-y-2 group block"
            >
              <Bug className="w-5 h-5 text-[#d96570]" />
              <h3 className="text-sm font-semibold text-paper-100 group-hover:text-[#d96570] transition-fast flex items-center gap-1.5">
                <span>GitHub Issues</span>
                <ExternalLink className="w-3 h-3 text-ink-muted" />
              </h3>
              <p className="text-xs text-ink-muted">
                Report reproducible bugs, submit feature requests, or browse existing discussion threads.
              </p>
            </a>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold">
              Frequently Asked Questions
            </h2>
            <p className="text-2xl font-bold font-display text-paper-100">
              Common Technical Inquiries
            </p>
          </div>

          <div className="space-y-4">
            {COMMON_QUESTIONS.map((faq, i) => (
              <div
                key={i}
                className="gemini-glow-card p-6 border border-white/10 space-y-2"
              >
                <h3 className="text-sm font-semibold font-display text-paper-100">
                  {faq.q}
                </h3>
                <p className="text-xs text-paper-200 leading-relaxed font-sans">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Community Issue Reporting ─── */}
      <section className="py-16 text-center space-y-4">
        <div className="max-w-md mx-auto space-y-2">
          <Bug className="w-6 h-6 text-accent-primary mx-auto" />
          <h3 className="text-lg font-bold font-display text-paper-100">
            Open-Source Issue Tracking
          </h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Discovered a bug or want to suggest an improvement? File an issue or pull request on our GitHub repository.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
