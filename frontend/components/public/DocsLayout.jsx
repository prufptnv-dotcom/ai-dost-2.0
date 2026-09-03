import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { PublicLayout } from './PublicLayout';
import { BookOpen, ChevronRight, Terminal, Cpu, Shield, Wrench, FolderGit2, Sparkles } from 'lucide-react';

const DOCS_NAV = [
  {
    category: 'Start Here',
    items: [
      { href: '/docs', label: 'Documentation Overview' },
      { href: '/docs/getting-started', label: 'Quickstart & Installation' },
      { href: '/docs/concepts', label: 'Core Architecture & Concepts' },
    ],
  },
  {
    category: 'Autonomous Engine',
    items: [
      { href: '/docs/agent', label: '8-Stage Execution Pipeline' },
      { href: '/docs/tools', label: 'Tool Registry & Scaffolding' },
      { href: '/docs/projects', label: 'Workspaces & Persistence' },
    ],
  },
  {
    category: 'Security & Operations',
    items: [
      { href: '/docs/security', label: 'Capability Policies & Guards' },
      { href: '/docs/troubleshooting', label: 'Troubleshooting & Runbooks' },
    ],
  },
];

export function DocsLayout({ title, description, category, children }) {
  const router = useRouter();

  return (
    <PublicLayout title={`${title} — AI-Dost Documentation`} description={description}>
      <div className="relative border-b border-border bg-canvas-subtle py-8 overflow-hidden">
        {/* Subtle Gemini ambient glow */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[200px] bg-gradient-to-l from-[#4285f4]/15 via-[#9b72cb]/10 to-transparent blur-[100px] pointer-events-none rounded-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center gap-2 text-xs font-mono text-ink-muted mb-2">
            <Link href="/docs" className="hover:text-paper-100">Docs</Link>
            <ChevronRight className="w-3 h-3 text-border" />
            <span className="text-[#4893fc]">{category || 'Guide'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-paper-100">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm text-ink-muted mt-1 max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Docs Sidebar */}
          <aside className="lg:col-span-1 space-y-6">
            <nav className="space-y-6 text-xs font-sans" aria-label="Documentation Navigation">
              {DOCS_NAV.map((group, gIdx) => (
                <div key={gIdx} className="space-y-2">
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold px-2">
                    {group.category}
                  </h4>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const isActive = router.pathname === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={`block px-3 py-1.5 rounded-r-lg transition-fast ${
                              isActive
                                ? 'bg-white/5 text-white font-semibold border-l-2 border-[#4893fc] shadow-[0_0_12px_rgba(66,133,244,0.15)]'
                                : 'text-paper-200 hover:text-paper-100 hover:bg-white/5'
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Docs Content */}
          <article className="lg:col-span-3 prose prose-invert max-w-none text-xs text-paper-200 leading-relaxed font-sans space-y-8">
            {children}
          </article>
        </div>
      </div>
    </PublicLayout>
  );
}
