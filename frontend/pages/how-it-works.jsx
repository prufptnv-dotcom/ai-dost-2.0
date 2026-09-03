import React from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { RevealOnScroll } from '../components/ui/RevealOnScroll';
import {
  ArrowDown, CheckCircle2, ShieldCheck, Cpu, Terminal,
  RefreshCw, Lock, Eye, AlertCircle, ArrowRight, Sparkles
} from 'lucide-react';

const PIPELINE_STEPS = [
  {
    step: '01',
    name: 'User Intent Extraction',
    title: 'Natural Language Ingestion',
    summary: 'The supervisor analyzes user text in English or Hinglish, identifying target outcomes, requested technologies, and task boundaries without assuming unstated permissions.',
    detail: 'Intent parser maps keywords to execution workflows (e.g. project scaffolding, file debugging, document generation, or knowledge retrieval).',
  },
  {
    step: '02',
    name: 'Context Assembly',
    title: 'Workspace Grounding',
    summary: 'Before planning, the engine reads local project manifests (package.json, requirements.txt), file trees, and relevant RAG memory.',
    detail: 'Prevents hallucinations by supplying exact active file paths and installed dependencies to the planning context.',
  },
  {
    step: '03',
    name: 'Task DAG Planning',
    title: 'Structured Plan Generation',
    summary: 'The supervisor decomposes the overarching objective into a sequential Directed Acyclic Graph (DAG) of distinct tasks.',
    detail: 'Each task assigns explicit roles (Researcher, Coder, Verifier) and scopes which tools are authorized for each individual step.',
  },
  {
    step: '04',
    name: 'Authorized Tool Execution',
    title: 'Bounded Local Operations',
    summary: 'Tools run one-by-one under strict capability policy checks. File writes and bash commands execute exclusively inside the normalized workspace.',
    detail: 'Supports multi-file editing, directory creation, dependency installation, and local command execution with 30s timeout guards.',
  },
  {
    step: '05',
    name: 'Output Observation',
    title: 'Diagnostic Capture',
    summary: 'Captures tool exit codes, standard output streams, compilation logs, and runtime errors in real time.',
    detail: 'Transfers exact error messages and line references to the supervisor to evaluate whether the step succeeded or failed.',
  },
  {
    step: '06',
    name: 'Automated Verification',
    title: 'Quality & Test Checkpoint',
    summary: 'Executes project test suites (npm test, pytest), runs linters, or performs visual render checks via Playwright screenshots.',
    detail: 'Work is never declared finished simply because code was generated; it must pass deterministic verification.',
  },
  {
    step: '07',
    name: 'Autonomous Self-Repair',
    title: 'Targeted Bug Fixing Loop',
    summary: 'If errors or test failures are observed, the supervisor analyzes the trace, formulates a repair diff, and re-executes up to 3 repair iterations.',
    detail: 'Isolates the specific failing line rather than regenerating the entire project, preserving existing working components.',
  },
  {
    step: '08',
    name: 'Verified Delivery',
    title: 'Artifact Presentation & Commit',
    summary: 'Presents verified files, changes summaries, or generated documents to the user and creates a local git checkpoint.',
    detail: 'The user receives complete, tested deliverables with full local rollback capabilities.',
  },
];

const ROLES = [
  {
    role: 'SUPERVISOR',
    badge: 'Orchestration Only',
    desc: 'Formulates plans, decomposes tasks, delegates to sub-roles, and monitors overall progress. Has ZERO direct file-write or shell execution privileges.',
  },
  {
    role: 'RESEARCHER',
    badge: 'Read-Only Tools',
    desc: 'Authorized to read files, search directory trees, perform web research, and query documentation. Cannot modify code or execute terminal commands.',
  },
  {
    role: 'CODER',
    badge: 'Workspace-Scoped',
    desc: 'Authorized to create, edit, and modify files within the active project workspace. Cannot escape workspace bounds or perform destructive deletes.',
  },
  {
    role: 'VERIFIER',
    badge: 'Test & Inspection',
    desc: 'Authorized to execute read-only test commands (npm test, pytest) and capture browser screenshots to validate functionality.',
  },
];

export default function HowItWorksPage() {
  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <PublicLayout
      title="How It Works — AI-Dost Autonomous Execution Engine"
      description="Detailed technical breakdown of the 8-stage autonomous pipeline: Intent, Context, Planning, Execution, Observation, Verification, Repair, and Delivery."
    >
      {/* ─── Header ─── */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <RevealOnScroll direction="up" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="gemini-shimmer-badge text-[11px] font-mono text-[#4893fc]">
            <Sparkles className="w-3.5 h-3.5 gemini-sparkle-icon" />
            <span>Execution Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            How Autonomous <span className="gemini-gradient-text">Execution Works</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            AI-Dost replaces fragile one-shot prompt generation with an 8-stage deterministic engineering pipeline. Here is how intent transforms into verified deliverables.
          </p>
        </RevealOnScroll>
      </section>

      {/* ─── 8-Stage Stepper ─── */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <RevealOnScroll direction="up" className="space-y-2 text-center sm:text-left">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold block">
              Execution Pipeline
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              The 8-Stage Lifecycle
            </h2>
          </RevealOnScroll>

          <div className="space-y-6 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-[#4893fc] before:via-[#9b72cb] before:to-[#d96570] hidden sm:block">
            {PIPELINE_STEPS.map((item, idx) => (
              <RevealOnScroll
                key={item.step}
                delay={idx * 70}
                direction="up"
                className="relative flex items-start gap-6 pl-12 group"
              >
                {/* Circle Marker with Gemini Ping Glow */}
                <span className="absolute left-1.5 top-2 w-6 h-6 rounded-full bg-canvas-base border-2 border-[#4893fc] group-hover:border-[#9b72cb] transition-all duration-300 flex items-center justify-center text-[10px] font-mono font-bold text-[#4893fc] shadow-[0_0_14px_rgba(66,133,244,0.4)] gemini-node-active">
                  {item.step}
                </span>

                {/* Content Card with Cursor Spotlight */}
                <div
                  onMouseMove={handleCardMouseMove}
                  className="gemini-glow-card w-full p-6 border border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#4893fc] font-bold">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-ink-muted">Phase {item.step}</span>
                  </div>
                  <h3 className="text-base font-semibold font-display text-paper-100">
                    {item.title}
                  </h3>
                  <p className="text-xs text-paper-200 leading-relaxed font-sans">
                    {item.summary}
                  </p>
                  <p className="text-[11px] text-[#9b72cb] font-mono pt-1">
                    ↳ {item.detail}
                  </p>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          {/* Mobile Fallback List */}
          <div className="sm:hidden space-y-4">
            {PIPELINE_STEPS.map((item, idx) => (
              <RevealOnScroll key={item.step} delay={idx * 60} direction="up">
                <div className="gemini-glow-card p-5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#4893fc] font-bold">
                    <span>{item.step} • {item.name}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-paper-100">{item.title}</h3>
                  <p className="text-xs text-ink-muted">{item.summary}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Role Separation ─── */}
      <section className="py-16 md:py-24 bg-canvas-subtle border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <RevealOnScroll direction="up" className="space-y-2 text-center sm:text-left">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold block">
              Capability Boundaries
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              Role-Based Authority Matrix
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted max-w-xl">
              To prevent security violations, the agent operates through 4 distinct sub-identities, each restricted by formal capability policies.
            </p>
          </RevealOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {ROLES.map((r, idx) => (
              <RevealOnScroll
                key={r.role}
                delay={idx * 90}
                direction="up"
                onMouseMove={handleCardMouseMove}
                className="gemini-glow-card p-6 border border-white/10 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold font-mono text-paper-100">{r.role}</h4>
                  <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#4893fc] shadow-[0_0_10px_rgba(66,133,244,0.15)]">
                    {r.badge}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed font-sans">
                  {r.desc}
                </p>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-16 text-center space-y-4">
        <h3 className="text-xl sm:text-2xl font-bold font-display text-paper-100">
          See the autonomous engine run on your workstation.
        </h3>
        <div>
          <Link
            href="/dashboard"
            className="gemini-btn-primary inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs font-semibold transition-fast shadow-lg"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
