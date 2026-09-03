import React, { useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { RevealOnScroll } from '../components/ui/RevealOnScroll';
import { GeminiInteractivePromptDemo } from '../components/brand/GeminiInteractivePromptDemo';
import {
  ArrowRight, CheckCircle2, ShieldCheck, Cpu, Terminal,
  Sparkles, FileText, Code2, Search, Play, RefreshCw,
  FolderGit2, Lock, Layers, Zap, Check, Eye
} from 'lucide-react';

const EXECUTION_STAGES = [
  { id: 'intent', title: '1. Intent', desc: 'Parses natural language prompt and identifies primary objective' },
  { id: 'context', title: '2. Context', desc: 'Assembles relevant workspace files, schemas, and dependencies' },
  { id: 'plan', title: '3. Plan', desc: 'Formulates directed task DAG with role assignments' },
  { id: 'execute', title: '4. Execute', desc: 'Executes authorized tools (file edits, scaffolding, code synthesis)' },
  { id: 'observe', title: '5. Observe', desc: 'Captures tool stdout, exit codes, and compile diagnostics' },
  { id: 'verify', title: '6. Verify', desc: 'Runs unit tests, linters, or visual render checks' },
  { id: 'repair', title: '7. Repair', desc: 'Diagnoses detected bugs and applies targeted self-healing diffs' },
  { id: 'deliver', title: '8. Deliver', desc: 'Presents verified workspace artifacts and change summaries' },
];

const OUTCOME_CAPABILITIES = [
  {
    icon: Code2,
    tag: 'Build',
    title: 'Construct Complete Applications',
    desc: 'From single prompt to 17-file full-stack React + Express applications with structured routing, API endpoints, and clean CSS styling.',
    prompt: 'Build me a task management app with React and persistent storage',
  },
  {
    icon: Search,
    tag: 'Research',
    title: 'Synthesize Deep Technical Topics',
    desc: 'Conducts multi-step web and document research, gathers verified citations, and compiles structured analytical briefs.',
    prompt: 'Research edge AI inference models and compare latency vs RAM',
  },
  {
    icon: FileText,
    tag: 'Create',
    title: 'Generate Professional Documents',
    desc: 'Direct compilation of native Office formats (.docx, .pptx, .xlsx, .csv) and styled PDF reports with executive formatting.',
    prompt: 'Create a 5-slide presentation on cloud security migration',
  },
  {
    icon: RefreshCw,
    tag: 'Repair',
    title: 'Self-Healing Bug Fixing',
    desc: 'Diagnoses runtime and build exceptions, isolates line-level defects, runs tests, and applies verified diffs autonomously.',
    prompt: 'Fix the failing jest unit test in the authentication module',
  },
  {
    icon: FolderGit2,
    tag: 'Workspace',
    title: 'Project-Aware Context',
    desc: 'Maintains long-term project files, SQLite memory across sessions, and local git-level checkpoint rollbacks.',
    prompt: 'Review this project structure and suggest architectural improvements',
  },
  {
    icon: Lock,
    tag: 'Verify',
    title: 'Bounded Safety & Governance',
    desc: 'Strict capability policies prevent path traversal and unauthorized destructive actions without explicit user approval.',
    prompt: 'Audit workspace dependencies for unhandled exceptions',
  },
];

const PROMPT_DEMOS = [
  {
    input: 'Build a responsive personal portfolio with blog support',
    plan: ['Scaffold React+Vite project structure', 'Create markdown parser & blog post loader', 'Verify build & run visual checks'],
    files: ['src/App.jsx', 'src/components/Blog.jsx', 'src/styles/theme.css'],
    status: 'Verified & Ready',
  },
  {
    input: 'Analyze sales data and generate an executive summary report',
    plan: ['Read CSV dataset into dataframe', 'Calculate quarterly trends & KPIs', 'Export executive summary to PDF'],
    files: ['analytics/processor.py', 'reports/Q3_Summary.pdf'],
    status: 'Delivered to Workspace',
  },
];

export default function HomePage() {
  const [activeStage, setActiveStage] = useState(0);

  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <PublicLayout
      title="AI-Dost — Autonomous AI Developer Workspace"
      description="Tell AI-Dost what you need. Let it figure out the work. An autonomous AI workspace that plans, executes, verifies, and self-heals in your local environment."
    >
      {/* ─── Hero Section ─── */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden border-b border-border">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[600px] h-[380px] bg-gradient-to-tr from-[#4285f4]/25 via-[#9b72cb]/20 to-transparent blur-[130px] pointer-events-none rounded-full animate-pulse" />
        <div className="absolute top-10 right-1/4 w-[550px] h-[380px] bg-gradient-to-bl from-[#d96570]/20 via-[#1ba1e2]/20 to-transparent blur-[140px] pointer-events-none rounded-full" />

        <RevealOnScroll direction="up" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-canvas-surface/80 border border-white/10 text-[11px] font-mono text-paper-200 shadow-[0_0_15px_rgba(66,133,244,0.15)] backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#4893fc] gemini-sparkle-icon" />
            <span>Autonomous AI Workspace • Version 2.0</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold font-display tracking-tight text-paper-100 leading-[1.1]">
            Tell AI-Dost what you need. <br />
            <span className="gemini-gradient-text">Let it figure out the work.</span>
          </h1>

          <p className="text-base sm:text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed font-sans">
            An autonomous developer workspace designed for outcomes. Describe a project, bug, research topic, or document. AI-Dost plans, executes, verifies, and self-heals in your local workstation—while keeping your experience as simple as a conversation.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="gemini-btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-sm font-semibold transition-fast cursor-pointer focus-ring shadow-lg"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium bg-canvas-surface/80 hover:bg-canvas-elevated text-paper-100 border border-white/10 hover:border-white/20 transition-fast cursor-pointer focus-ring backdrop-blur-md"
            >
              <span>See How It Works</span>
            </Link>
          </div>

          <div className="pt-8 flex items-center justify-center gap-6 text-[11px] font-mono text-ink-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#4893fc]" /> Free Tier First
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#9b72cb]" /> Local-First SQLite
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#d96570]" /> 100% Private Workstation
            </span>
          </div>
        </RevealOnScroll>
      </section>

      {/* ─── Interactive Demonstration ─── */}
      <section className="py-16 md:py-24 bg-canvas-subtle border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <RevealOnScroll direction="up" className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold">
              Live Execution Model
            </h2>
            <p className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              One natural prompt. Complete autonomous delivery.
            </p>
            <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto">
              Observe how a single conversational instruction transitions into planning, file modification, and verification without exposing complex plumbing.
            </p>
          </RevealOnScroll>

          {/* Gemini Interactive Typing & Streaming Demo */}
          <RevealOnScroll direction="scale" delay={150}>
            <GeminiInteractivePromptDemo />
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── Outcomes Catalog ─── */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-accent-primary font-semibold">
              Capabilities
            </h2>
            <p className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              One system. Boundless developer outcomes.
            </p>
            <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto">
              Capabilities are expressed as outcomes you accomplish through conversation—not disconnected tools or bloated menus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {OUTCOME_CAPABILITIES.map((cap, i) => (
              <RevealOnScroll
                key={i}
                delay={i * 80}
                direction="up"
                onMouseMove={handleCardMouseMove}
                className="gemini-glow-card p-6 rounded-2xl space-y-4 group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-canvas-base border border-white/10 flex items-center justify-center text-[#4893fc] group-hover:text-[#9b72cb] transition-fast shadow-[0_0_12px_rgba(66,133,244,0.15)]">
                      <cap.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-paper-200">
                      {cap.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold font-display text-paper-100 group-hover:text-[#4893fc] transition-fast">
                    {cap.title}
                  </h3>
                  <p className="text-xs text-ink-muted leading-relaxed font-sans">
                    {cap.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-border-subtle">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted block mb-1">Example Request</span>
                  <p className="text-[11px] font-mono text-paper-200 bg-canvas-base/80 p-2.5 rounded-lg border border-white/5 truncate">
                    &ldquo;{cap.prompt}&rdquo;
                  </p>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          <div className="text-center pt-4">
            <Link
              href="/capabilities"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#4893fc] hover:underline"
            >
              <span>Explore all outcome capabilities</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 8-Stage Autonomous Lifecycle ─── */}
      <section className="py-16 md:py-24 bg-canvas-subtle border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold block">
              Execution Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              The 8-Stage Autonomous Pipeline
            </h2>
            <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto">
              How AI-Dost deterministically turns natural language into verified deliverables while preserving workspace security.
            </p>
          </div>

          {/* Stepper Pipeline */}
          <RevealOnScroll direction="up" delay={80}>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {EXECUTION_STAGES.map((stage, idx) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveStage(idx)}
                  className={`p-3 rounded-xl border text-left transition-all duration-300 cursor-pointer ${
                    activeStage === idx
                      ? 'bg-gradient-to-br from-[#4893fc]/20 to-[#9b72cb]/20 border-[#4893fc]/60 text-white shadow-[0_0_20px_rgba(66,133,244,0.25)] scale-[1.03]'
                      : 'bg-canvas-base border-border hover:bg-canvas-surface/60'
                  }`}
                >
                  <div className={`text-[11px] font-mono font-semibold ${activeStage === idx ? 'text-[#4893fc]' : 'text-paper-100'}`}>
                    {stage.title}
                  </div>
                  <div className="text-[10px] text-ink-muted mt-1 truncate">
                    {stage.desc}
                  </div>
                </button>
              ))}
            </div>
          </RevealOnScroll>

          {/* Focused Stage Detail Card */}
          <RevealOnScroll direction="scale" delay={120}>
            <div
              onMouseMove={handleCardMouseMove}
              className="gemini-glow-card p-6 sm:p-8 rounded-2xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm"
            >
              <div className="space-y-2 max-w-xl">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#4893fc] font-bold">
                  Detailed Lifecycle Phase
                </span>
                <h3 className="text-lg font-bold font-display text-paper-100">
                  {EXECUTION_STAGES[activeStage].title}: How It Works
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  {EXECUTION_STAGES[activeStage].desc}. Operates under strict capability controls to ensure workspace isolation, zero path traversal, and automatic fallback across inference models.
                </p>
              </div>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold bg-canvas-base hover:bg-canvas-elevated text-paper-100 border border-white/10 transition-fast shrink-0 shadow-sm"
              >
                <span>Read Execution Contract</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── Differentiation Table ─── */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold">
              Why AI-Dost
            </h2>
            <p className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              Beyond simple text generation.
            </p>
            <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto">
              How an autonomous local workspace fundamentally differs from traditional conversational AI chatbots.
            </p>
          </div>

          <div className="gemini-glow-card rounded-2xl border border-white/10 overflow-hidden shadow-xs">
            <div className="grid grid-cols-12 px-5 py-3 bg-canvas-subtle/80 border-b border-white/5 text-[11px] font-mono uppercase tracking-wider text-ink-muted">
              <div className="col-span-4 sm:col-span-3">Capability Dimension</div>
              <div className="col-span-4 sm:col-span-4 text-ink-muted">Standard AI Chatbots</div>
              <div className="col-span-4 sm:col-span-5 text-[#4893fc] font-bold">AI-Dost Autonomous Workspace</div>
            </div>
            <div className="divide-y divide-border-subtle text-xs font-sans">
              <div className="grid grid-cols-12 px-5 py-3.5 items-center">
                <div className="col-span-4 sm:col-span-3 font-semibold text-paper-100">Action Execution</div>
                <div className="col-span-4 sm:col-span-4 text-ink-muted">Outputs code snippets into chat bubbles</div>
                <div className="col-span-4 sm:col-span-5 text-paper-100 font-medium">Autonomously writes, edits, and tests files</div>
              </div>
              <div className="grid grid-cols-12 px-5 py-3.5 items-center">
                <div className="col-span-4 sm:col-span-3 font-semibold text-paper-100">Verification & QA</div>
                <div className="col-span-4 sm:col-span-4 text-ink-muted">None; user manually debugs errors</div>
                <div className="col-span-4 sm:col-span-5 text-paper-100 font-medium">Automated test runs and self-healing repair loops</div>
              </div>
              <div className="grid grid-cols-12 px-5 py-3.5 items-center">
                <div className="col-span-4 sm:col-span-3 font-semibold text-paper-100">Workspace Context</div>
                <div className="col-span-4 sm:col-span-4 text-ink-muted">Ephemeral chat history; lost upon reload</div>
                <div className="col-span-4 sm:col-span-5 text-paper-100 font-medium">Persistent local SQLite storage & git checkpoints</div>
              </div>
              <div className="grid grid-cols-12 px-5 py-3.5 items-center">
                <div className="col-span-4 sm:col-span-3 font-semibold text-paper-100">Model Resilience</div>
                <div className="col-span-4 sm:col-span-4 text-ink-muted">Single provider lock-in; breaks on quota</div>
                <div className="col-span-4 sm:col-span-5 text-paper-100 font-medium">Automatic cascade (Gemini → Groq → OpenRouter → Ollama)</div>
              </div>
              <div className="grid grid-cols-12 px-5 py-3.5 items-center">
                <div className="col-span-4 sm:col-span-3 font-semibold text-paper-100">Data Privacy</div>
                <div className="col-span-4 sm:col-span-4 text-ink-muted">Stored on cloud servers with telemetry</div>
                <div className="col-span-4 sm:col-span-5 text-paper-100 font-medium">100% local workstation storage; zero ad tracking</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Safety & Governance ─── */}
      <section className="py-16 md:py-24 bg-canvas-subtle border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-[#4893fc] font-semibold">
              Safety & Governance
            </h2>
            <p className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
              Autonomy without compromise.
            </p>
            <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto">
              Autonomous execution never means unrestricted authority. Strict perimeter defenses and capability policies govern every tool invocation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="gemini-glow-card p-6 rounded-2xl border border-white/10 space-y-2.5">
              <ShieldCheck className="w-5 h-5 text-[#4893fc]" />
              <h4 className="text-sm font-semibold text-paper-100 font-display">Path Traversal Guards</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                All file read and write operations are strictly normalized against authorized project directory paths. Null-byte injections and directory escapes are blocked at the engine layer.
              </p>
            </div>
            <div className="gemini-glow-card p-6 rounded-2xl border border-white/10 space-y-2.5">
              <Lock className="w-5 h-5 text-[#9b72cb]" />
              <h4 className="text-sm font-semibold text-paper-100 font-display">Role Capability Policies</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Execution roles are mathematically bounded: Supervisors only orchestrate; Researchers only read; Coders write within projects; Verifiers only test. No agent can self-escalate authority.
              </p>
            </div>
            <div className="gemini-glow-card p-6 rounded-2xl border border-white/10 space-y-2.5">
              <Eye className="w-5 h-5 text-[#d96570]" />
              <h4 className="text-sm font-semibold text-paper-100 font-display">Human Approval Gates</h4>
              <p className="text-xs text-ink-muted leading-relaxed">
                Destructive operations (clearing history, deleting projects, resetting settings) are physically isolated behind accessible confirmation modal dialogs requiring manual consent.
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/security"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#4893fc] hover:underline"
            >
              <span>Read the full technical security architecture</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        {/* Gemini Ambient Glowing Spotlight */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[350px] bg-gradient-to-r from-[#4285f4]/15 via-[#9b72cb]/15 to-[#d96570]/15 blur-[120px] rounded-full" />
        </div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-paper-100 tracking-tight">
            Tell AI-Dost what you want to <span className="gemini-gradient-text">get done</span>.
          </h2>
          <p className="text-sm sm:text-base text-ink-muted max-w-xl mx-auto">
            Experience an autonomous AI workspace built for results. No complex setup, no subscription walls, and complete local privacy.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="gemini-btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold transition-fast cursor-pointer focus-ring shadow-lg"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}