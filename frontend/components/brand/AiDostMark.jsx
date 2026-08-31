import React from 'react';

/**
 * AiDostMark - Dark Bento & Cyber/Operational developer monogram.
 * Geometric A/D monogram with Bioluminescent Lime & Cyber Rust gradients.
 */
export function AiDostMark({ size = 20, className = '', color = 'url(#aiDostBentoLimeGrad)' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AI-Dost"
    >
      <defs>
        <linearGradient id="aiDostBentoLimeGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#d9ff5a" />
          <stop offset="100%" stopColor="#a3e635" />
        </linearGradient>
        <linearGradient id="aiDostCyberRustGrad" x1="0" y1="0" x2="4" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff4d12" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>

      {/* Structural Backbone Stroke */}
      <rect x="3" y="3" width="3.5" height="18" rx="1" fill={color} />

      {/* Structural Cross Header */}
      <path
        d="M3 4.75C3 3.7835 3.7835 3 4.75 3H14C17.866 3 21 6.13401 21 10C21 13.866 17.866 17 14 17H6.5V20C6.5 20.5523 6.05228 21 5.5 21H4.5C3.94772 21 3.5 20.5523 3.5 20V4.75Z"
        fill={color}
      />

      {/* Inner Workbench / Conversation Chamber Void */}
      <path
        d="M6.5 6.5H13.5C15.433 6.5 17 8.067 17 10C17 11.933 15.433 13.5 13.5 13.5H6.5V6.5Z"
        fill="var(--color-canvas-surface, #18181d)"
      />

      {/* Cyber Rust Core Notch */}
      <rect
        x="9"
        y="8.5"
        width="4"
        height="3"
        rx="0.5"
        fill="url(#aiDostCyberRustGrad)"
      />
    </svg>
  );
}

export default AiDostMark;
