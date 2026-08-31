import React from 'react';

const SIZE_MAP = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

export default function BrandLogo({
  size = 'md',
  showText = false,
  className = '',
  textClassName = '',
  accent = '#3b82f6'
}) {
  const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 24);

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Clean Scalable Geometric Monogram */}
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0 transition-transform duration-150 active:scale-95"
        aria-label="AI-Dost Logo"
        role="img"
      >
        {/* Background rounded squircle */}
        <rect width="32" height="32" rx="7" fill="#181b24" />
        <rect x="0.5" y="0.5" width="31" height="31" rx="6.5" stroke="rgba(255,255,255,0.08)" />

        {/* Angular left bracket node (representing developer input / friendship) */}
        <path
          d="M10 9L15 16L10 23"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Right terminal cursor node (representing AI response / automation) */}
        <line
          x1="18"
          y1="22"
          x2="23"
          y2="22"
          stroke="#94a3b8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="20.5" cy="12.5" r="2.5" fill={accent} />
      </svg>

      {showText && (
        <span className={`font-display font-semibold text-text-primary tracking-tight ${textClassName || 'text-base'}`}>
          AI<span className="text-accent font-semibold ml-0.5">Dost</span>
        </span>
      )}
    </div>
  );
}
