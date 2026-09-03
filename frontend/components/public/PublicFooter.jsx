import React from 'react';
import Link from 'next/link';
import { AiDostMark } from '../brand/AiDostMark';
import { ShieldCheck, Terminal, Heart } from 'lucide-react';

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border bg-canvas-subtle text-paper-200 font-sans text-xs before:absolute before:top-0 before:left-0 before:right-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-[#4893fc]/50 before:to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 font-display font-bold text-base text-paper-100 hover:opacity-90">
              <AiDostMark size={22} />
              <span>AI-Dost</span>
            </Link>
            <p className="text-ink-muted text-xs leading-relaxed max-w-sm">
              Simple Chat Outside. Autonomous System Inside.
              An autonomous AI workspace that plans, executes, verifies, and self-heals in your local environment.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>Local-First • 100% Private Workstation</span>
            </div>
          </div>

          {/* Product Col */}
          <div className="space-y-3">
            <h4 className="font-semibold text-paper-100 font-display text-xs uppercase tracking-wider">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/product" className="text-ink-muted hover:text-paper-100 transition-fast">Overview</Link></li>
              <li><Link href="/capabilities" className="text-ink-muted hover:text-paper-100 transition-fast">Capabilities</Link></li>
              <li><Link href="/how-it-works" className="text-ink-muted hover:text-paper-100 transition-fast">How It Works</Link></li>
              <li><Link href="/changelog" className="text-ink-muted hover:text-paper-100 transition-fast">Changelog</Link></li>
              <li><Link href="/dashboard" className="text-accent-primary hover:underline transition-fast">Launch App</Link></li>
            </ul>
          </div>

          {/* Resources & Docs Col */}
          <div className="space-y-3">
            <h4 className="font-semibold text-paper-100 font-display text-xs uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2">
              <li><Link href="/docs" className="text-ink-muted hover:text-paper-100 transition-fast">Documentation Hub</Link></li>
              <li><Link href="/docs/getting-started" className="text-ink-muted hover:text-paper-100 transition-fast">Getting Started</Link></li>
              <li><Link href="/docs/concepts" className="text-ink-muted hover:text-paper-100 transition-fast">Core Concepts</Link></li>
              <li><Link href="/docs/agent" className="text-ink-muted hover:text-paper-100 transition-fast">Autonomous Engine</Link></li>
              <li><Link href="/support" className="text-ink-muted hover:text-paper-100 transition-fast">Support & FAQ</Link></li>
            </ul>
          </div>

          {/* Trust & Legal Col */}
          <div className="space-y-3">
            <h4 className="font-semibold text-paper-100 font-display text-xs uppercase tracking-wider">Trust & Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/security" className="text-ink-muted hover:text-paper-100 transition-fast">Security Architecture</Link></li>
              <li><Link href="/privacy" className="text-ink-muted hover:text-paper-100 transition-fast">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-ink-muted hover:text-paper-100 transition-fast">Terms of Service</Link></li>
              <li><Link href="/policy" className="text-ink-muted hover:text-paper-100 transition-fast">Responsible AI Policy</Link></li>
              <li><Link href="/about" className="text-ink-muted hover:text-paper-100 transition-fast">About Project</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Strip */}
        <div className="mt-12 pt-8 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-ink-muted">
          <p>© {currentYear} AI-Dost. Open-source local autonomous engineering workspace. Released under MIT license.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-paper-100">Privacy</Link>
            <span className="text-border">/</span>
            <Link href="/terms" className="hover:text-paper-100">Terms</Link>
            <span className="text-border">/</span>
            <Link href="/security" className="hover:text-paper-100">Security</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
