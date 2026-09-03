import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { PublicNavbar } from './PublicNavbar';
import { PublicFooter } from './PublicFooter';

export function PublicLayout({
  title = 'AI-Dost — Autonomous AI Developer Workspace',
  description = 'Tell AI-Dost what you need. Let it figure out the work. An autonomous AI workspace that plans, executes, verifies, and self-heals in your local environment.',
  children,
}) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('ai_dost_theme') || localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    const isLight = saved === 'light';
    document.documentElement.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ai_dost_theme', next);
    localStorage.setItem('theme', next);
    const isLight = next === 'light';
    document.documentElement.classList.toggle('light-theme', isLight);
    document.body.classList.toggle('light-theme', isLight);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-canvas-base text-paper-100 font-sans selection:bg-[#4893fc] selection:text-white overflow-x-hidden">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Google Gemini Living Celestial Aurora Mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        <div className="gemini-aurora-orb-1" />
        <div className="gemini-aurora-orb-2" />
        <div className="gemini-aurora-orb-3" />
      </div>

      {/* Skip to Content for a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 z-50 px-4 py-2 bg-[#4893fc] text-white font-semibold text-xs rounded-full shadow-lg"
      >
        Skip to main content
      </a>

      <div className="relative z-10 flex flex-col min-h-screen">
        <PublicNavbar theme={theme} onToggleTheme={toggleTheme} />

        <main id="main-content" className="flex-1">
          {children}
        </main>

        <PublicFooter />
      </div>
    </div>
  );
}

export default PublicLayout;
