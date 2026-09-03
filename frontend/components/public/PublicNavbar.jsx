import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, X, ArrowRight, Sun, Moon, Sparkles } from 'lucide-react';
import { AiDostMark } from '../brand/AiDostMark';

const NAV_LINKS = [
  { href: '/product', label: 'Product' },
  { href: '/capabilities', label: 'Capabilities' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/security', label: 'Security' },
  { href: '/docs', label: 'Docs' },
];

export function PublicNavbar({ theme = 'dark', onToggleTheme }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [router.asPath]);

  return (
    <header className={`sticky top-0 z-50 gemini-header-glass transition-all duration-300 ${scrolled ? 'py-1 shadow-[0_8px_32px_rgba(0,0,0,0.36)] backdrop-blur-2xl' : 'py-2.5'}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-13' : 'h-16'}`}>
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display font-bold text-base text-paper-100 hover:opacity-95 transition-opacity focus-ring rounded-full shrink-0 whitespace-nowrap"
          aria-label="AI-Dost Home"
        >
          <AiDostMark size={28} />
          <span className="tracking-tight text-paper-100 font-semibold whitespace-nowrap">AI-Dost</span>
          <div className="gemini-shimmer-badge hidden md:inline-flex text-[10px] font-mono text-paper-200">
            <Sparkles className="w-3 h-3 text-[#4893fc] gemini-sparkle-icon" />
            <span>Autonomous AI Workspace</span>
          </div>
        </Link>

        {/* Desktop Navigation Floating Capsule */}
        <nav
          className="hidden md:flex items-center gap-1 bg-white/[0.04] border border-white/10 rounded-full p-1 shadow-[0_4px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl"
          aria-label="Main Navigation"
        >
          {NAV_LINKS.map((link) => {
            const isActive = router.pathname === link.href || (link.href !== '/' && router.pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`gemini-nav-pill text-xs ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Right */}
        <div className="hidden md:flex items-center gap-3">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2.5 rounded-full text-ink-muted hover:text-paper-100 hover:bg-white/10 transition-fast cursor-pointer focus-ring"
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <Link
            href="/dashboard"
            className="gemini-btn-primary inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-fast cursor-pointer focus-ring shadow-lg"
          >
            <span>Launch Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xs text-ink-muted hover:text-paper-100 cursor-pointer focus-ring"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="p-2 rounded-xs text-paper-100 hover:bg-canvas-surface cursor-pointer focus-ring"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-canvas-base px-4 pt-2 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            {NAV_LINKS.map((link) => {
              const isActive = router.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2.5 rounded-xs text-sm font-medium transition-fast focus-ring ${
                    isActive
                      ? 'text-accent-primary bg-canvas-surface font-semibold'
                      : 'text-ink-muted hover:text-paper-100 hover:bg-canvas-surface/50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="pt-2 border-t border-border-subtle">
            <Link
              href="/dashboard"
              className="gemini-btn-primary w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold transition-fast cursor-pointer focus-ring"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
