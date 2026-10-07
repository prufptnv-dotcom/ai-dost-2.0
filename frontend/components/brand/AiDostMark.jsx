import React from 'react';

/**
 * AiDostMark - Minimalist Indigo 'A' logo
 */
export function AiDostMark({ size = 20, className = '' }) {
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
      <rect width="24" height="24" rx="6" fill="#6366f1" />
      <text
        x="12"
        y="16.5"
        fill="white"
        fontSize="14"
        fontFamily="sans-serif"
        fontWeight="bold"
        textAnchor="middle"
      >
        A
      </text>
    </svg>
  );
}

export default AiDostMark;
