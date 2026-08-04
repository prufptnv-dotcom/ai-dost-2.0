import React from 'react';
import { Bot, Heart, Zap, Github } from 'lucide-react';
import Link from 'next/link';

const GithubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 w-full mt-12">
      {/* Gradient top divider */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), rgba(139,92,246,0.3), transparent)' }} />

      <div
        style={{ background: 'rgba(5,6,10,0.8)', backdropFilter: 'blur(12px)' }}
        className="py-8 px-6"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">

            {/* Brand */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', boxShadow: '0 0 12px rgba(6,182,212,0.3)' }}
              >
                <Bot className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <span className="text-sm font-extrabold gradient-text">Ai-Dost</span>
              <div
                className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', color: '#22d3ee' }}
              >
                <Zap className="w-2.5 h-2.5" /> v2.0
              </div>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-1">
              {[
                { href: '/', label: 'Home' },
                { href: '/about-project', label: 'About' },
                { href: '/api-docs', label: 'API Docs' },
                { href: '/privacy-policy', label: 'Privacy' },
                { href: '/terms', label: 'Terms' },
              ].map(({ href, label }) => (
                <Link
                  key={label}
                  href={href}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5 transition-all duration-200"
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Social + Copyright */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/vikash-kumar-pandit/Ai-dost"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/6 transition-all duration-200 cursor-pointer"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <GithubIcon />
              </a>
              <div className="text-[#475569] text-[10px] flex items-center gap-1">
                Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> © {currentYear} Ai-Dost
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
