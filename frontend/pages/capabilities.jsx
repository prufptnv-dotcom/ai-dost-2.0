import React, { useState } from 'react';
import Link from 'next/link';
import { PublicLayout } from '../components/public/PublicLayout';
import { RevealOnScroll } from '../components/ui/RevealOnScroll';
import {
  Code2, FileText, Search, RefreshCw, Cpu, Layers,
  Terminal, ShieldCheck, ArrowRight, Check, Sparkles,
  Database, Image, FileSpreadsheet
} from 'lucide-react';

const CAPABILITY_GROUPS = [
  {
    id: 'build',
    name: 'Build & Code',
    badge: 'Autonomous Scaffolding',
    icon: Code2,
    description: 'Scaffolds complete multi-file applications with production directory structures, routes, styling, and dependencies.',
    items: [
      {
        title: 'Full-Stack Web Scaffolding',
        desc: 'Generates cohesive full-stack applications (React + Vite + Express) with 15+ organized files in a single autonomous execution pass.',
        prompt: 'Build a fullstack note-taking app with tag search and SQLite persistence',
      },
      {
        title: 'Component & API Development',
        desc: 'Writes clean, modular components, REST controllers, and utility modules adhering to modern JavaScript and Python best practices.',
        prompt: 'Create an Express auth middleware that verifies JWT and checks roles',
      },
      {
        title: 'Copilot IDE Integration',
        desc: 'Inspect code in the built-in Monaco editor with syntax highlighting for 15+ languages, split terminals, and local git rollbacks.',
        prompt: 'Open the user controller in the editor and add input validation',
      },
    ],
  },
  {
    id: 'research',
    name: 'Research & Synthesize',
    badge: 'Web & Document Intelligence',
    icon: Search,
    description: 'Executes verified multi-query web research, reads technical documents, and synthesizes structured findings.',
    items: [
      {
        title: 'Source-Attributed Web Research',
        desc: 'Connects to live search (via Tavily engine) to retrieve real-time facts, documentation, and releases with exact citation sources.',
        prompt: 'Research recent WebAssembly optimizations in 2026 and summarize benchmarks',
      },
      {
        title: 'Codebase Knowledge Querying',
        desc: 'Uses local LlamaIndex RAG to query and retrieve context from thousands of lines across local repositories and documentation.',
        prompt: 'Search the codebase for all endpoints handling user password updates',
      },
      {
        title: 'Bilingual Technical Analysis',
        desc: 'Understands and answers complex technical questions in Hindi, Hinglish, and English with conversational fluency.',
        prompt: 'Explain how Docker container network isolation works in simple Hinglish',
      },
    ],
  },
  {
    id: 'create',
    name: 'Create Documents & Media',
    badge: 'Native Document Engine',
    icon: FileText,
    description: 'Directly produces standard Office documents, formatted PDFs, and AI-synthesized imagery.',
    items: [
      {
        title: 'MS Office Document Generation',
        desc: 'Compiles real Microsoft Word (.docx), PowerPoint (.pptx), and Excel (.xlsx) files formatted with executive styling.',
        prompt: 'Generate an executive presentation on microservices with 6 slides',
      },
      {
        title: 'PDF & Report Production',
        desc: 'Renders styled, printable PDF documents complete with headers, tables, and Hindi font support via local Python engines.',
        prompt: 'Turn this technical audit into a downloadable PDF report',
      },
      {
        title: 'Visual Image Generation',
        desc: 'Generates UI illustrations, concept art, and diagrams directly inside chat via free tier-first image synthesis.',
        prompt: 'Create a minimalist vector illustration of an autonomous cyber agent',
      },
    ],
  },
  {
    id: 'verify',
    name: 'Verify & Self-Heal',
    badge: 'Automated QA Loops',
    icon: RefreshCw,
    description: 'Observes tool execution outputs, runs unit tests, and autonomously repairs bugs before declaring work complete.',
    items: [
      {
        title: 'Automated Test Verification',
        desc: 'Detects `npm test` or `pytest` suites in the project and runs them automatically to verify that newly generated code passes.',
        prompt: 'Run tests on the project and verify zero regressions',
      },
      {
        title: 'Multi-Iteration Self-Repair',
        desc: 'If a test or build fails, the agent captures stdout diagnostics, generates targeted diffs, and iterates up to 3 repair cycles.',
        prompt: 'Fix the syntax error in server.js that crashed the build',
      },
      {
        title: 'Visual UI Verification',
        desc: 'In Docker environments, captures Playwright screenshots of running dev servers and analyzes visual layout bugs using vision models.',
        prompt: 'Capture a screenshot of the landing page and verify button alignment',
      },
    ],
  },
];

export default function CapabilitiesPage() {
  const [copied, setCopied] = useState(null);

  const handleCopy = (text) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleCardMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <PublicLayout
      title="Capabilities — AI-Dost Autonomous AI Workspace"
      description="Explore outcome-oriented capabilities: building fullstack apps, deep technical research, document generation, and self-healing verification."
    >
      {/* ─── Header ─── */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-20 border-b border-border bg-canvas-subtle overflow-hidden">
        {/* Google Gemini Dual Ambient Celestial Orbs */}
        <div className="absolute -top-24 left-1/4 w-[500px] h-[300px] bg-gradient-to-tr from-[#4285f4]/20 via-[#9b72cb]/18 to-transparent blur-[120px] pointer-events-none rounded-full" />
        <div className="absolute top-10 right-1/4 w-[450px] h-[300px] bg-gradient-to-bl from-[#d96570]/15 via-[#1ba1e2]/15 to-transparent blur-[120px] pointer-events-none rounded-full" />

        <RevealOnScroll direction="up" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-canvas-surface/80 border border-white/10 text-[11px] font-mono text-[#4893fc] shadow-[0_0_12px_rgba(66,133,244,0.15)]">
            <span>Outcome Catalog</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold font-display tracking-tight text-paper-100">
            What Can You <span className="gemini-gradient-text">Accomplish?</span>
          </h1>
          <p className="text-sm sm:text-base text-ink-muted max-w-2xl mx-auto leading-relaxed">
            AI-Dost capabilities are organized around concrete outcomes. Rather than navigating disconnected tools, you describe your objective and the system coordinates the necessary abilities internally.
          </p>
        </RevealOnScroll>
      </section>

      {/* ─── Capability Groups ─── */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
          {CAPABILITY_GROUPS.map((group) => (
            <div key={group.id} className="space-y-6">
              {/* Group Header */}
              <RevealOnScroll direction="up" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <group.icon className="w-5 h-5 text-[#4893fc]" />
                    <h2 className="text-xl sm:text-2xl font-bold font-display text-paper-100">
                      {group.name}
                    </h2>
                  </div>
                  <p className="text-xs text-ink-muted max-w-xl">
                    {group.description}
                  </p>
                </div>
                <span className="text-[10px] font-mono font-medium px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#4893fc] shrink-0 self-start sm:self-auto shadow-[0_0_10px_rgba(66,133,244,0.12)]">
                  {group.badge}
                </span>
              </RevealOnScroll>

              {/* Group Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {group.items.map((item, idx) => (
                  <RevealOnScroll
                    key={idx}
                    delay={idx * 80}
                    direction="up"
                    onMouseMove={handleCardMouseMove}
                    className="gemini-glow-card p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <h3 className="text-sm font-semibold font-display text-paper-100">
                        {item.title}
                      </h3>
                      <p className="text-xs text-ink-muted leading-relaxed font-sans">
                        {item.desc}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border-subtle space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted">Example Prompt</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.prompt)}
                          className="text-[10px] font-mono text-ink-muted hover:text-accent-primary flex items-center gap-1 cursor-pointer"
                        >
                          {copied === item.prompt ? (
                            <>
                              <Check className="w-3 h-3 text-accent-primary" /> Copied
                            </>
                          ) : (
                            <span>Copy</span>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-paper-200 bg-canvas-base p-2 rounded-xs border border-border leading-tight">
                        &ldquo;{item.prompt}&rdquo;
                      </p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-16 text-center space-y-4">
        <h3 className="text-xl sm:text-2xl font-bold font-display text-paper-100">
          Try these capabilities in your local workspace.
        </h3>
        <div>
          <Link
            href="/dashboard"
            className="gemini-btn-primary inline-flex items-center gap-2 px-7 py-3 rounded-full text-xs font-semibold transition-fast shadow-md"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
