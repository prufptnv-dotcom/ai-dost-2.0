import React from 'react';

/**
 * AiDostMark - Signature "Editorial Workbench" developer monogram.
 * Geometric A/D monogram built from structural architectural strokes with
 * a distinctive open conversation notch. Crisp at 16px, monochrome-ready,
 * flat, without decorative glows or sparkles.
 */
export function AiDostMark({ size = 20, className = '', color = 'currentColor' }) {
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
        fill="var(--ink-950, #11100f)"
      />

      {/* Terracotta / Vermilion Focal Core Notch */}
      <rect
        x="9"
        y="8.5"
        width="4"
        height="3"
        rx="0.5"
        fill="var(--accent-primary, #d45b3f)"
      />
    </svg>
  );
}

export default AiDostMark;
