import React from 'react';
import Link from 'next/link';
import { DocsLayout } from '../../components/public/DocsLayout';
import {
  BookOpen, Terminal, Cpu, Shield, Wrench,
  FolderGit2, Sparkles, ArrowRight, CheckCircle2
} from 'lucide-react';

const TRACKS = [
  {
    title: 'Quickstart & Installation',
    href: '/docs/getting-started',
    desc: 'Launch backend on :5000, frontend on :3000, configure free Gemini API keys, and run your first autonomous prompt.',
    badge: '3 min read',
  },
  {
    title: 'Core Architecture & Concepts',
    href: '/docs/concepts',
    desc: 'Understand the "Simple Outside, Autonomous Inside" paradigm, the 5 engine layers, and runtime execution profiles.',
    badge: '5 min read',
  },
  {
    title: '8-Stage Execution Pipeline',
    href: '/docs/agent',
    desc: 'Deep dive into Intent, Context, Plan DAG, Execution, Observation, Verification, Repair loops, and Delivery contracts.',
    badge: '7 min read',
  },
  {
    title: 'Tool Registry & Scaffolding',
    href: '/docs/tools',
    desc: 'Explore the full-stack project generator (React, Express), MS Office document engines, and Playwright vision checks.',
    badge: '6 min read',
  },
  {
    title: 'Workspaces & Persistence',
    href: '/docs/projects',
    desc: 'How local SQLite persistence, directory boundary trees, and offline git commits manage state across reboots.',
    badge: '4 min read',
  },
  {
    title: 'Capability Policies & Guards',
    href: '/docs/security',
    desc: 'Role-based authority limits (Supervisor, Researcher, Coder, Verifier), path traversal defenses, and safety gates.',
    badge: '5 min read',
  },
  {
    title: 'Troubleshooting & Runbooks',
    href: '/docs/troubleshooting',
    desc: 'Operational runbooks for port collisions, rate-limit recovery, Ollama local model setup, and test execution.',
    badge: '4 min read',
  },
];

export default function DocsIndexPage() {
  return (
    <DocsLayout
      title="Documentation Hub"
      category="Overview"
      description="Official technical documentation, implementation blueprints, and architecture guides for AI-Dost."
    >
      <div className="space-y-6">
        <div className="gemini-glow-card p-6 sm:p-8 border border-white/10 space-y-3">
          <h2 className="text-base font-bold font-display text-paper-100">
            Welcome to the AI-Dost Developer Documentation
          </h2>
          <p className="text-xs text-paper-200 leading-relaxed font-sans">
            AI-Dost is an autonomous developer workspace. Unlike standard chatbots that only emit text responses, AI-Dost operates with full workspace awareness—formulating multi-step execution plans, running authorized tools, verifying code with tests, and repairing bugs.
          </p>
          <div className="pt-2">
            <Link
              href="/docs/getting-started"
              className="gemini-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-fast cursor-pointer shadow-md"
            >
              <span>Start with Quickstart</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-bold font-display text-paper-100">
            Documentation Guides & Topics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TRACKS.map((track) => (
              <Link
                key={track.href}
                href={track.href}
                className="gemini-glow-card p-5 border border-white/10 space-y-2 block group transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold font-display text-paper-100 group-hover:text-[#4893fc] transition-fast">
                    {track.title}
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-[#9b72cb] border border-white/10">{track.badge}</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed font-sans">
                  {track.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DocsLayout>
  );
}
