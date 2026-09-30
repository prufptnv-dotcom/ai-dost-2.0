/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.{css,scss}'
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: 'var(--ink-950, #090a0f)',
          900: 'var(--ink-900, #0d0f18)',
          850: 'var(--ink-850, #131622)',
          800: 'var(--ink-800, #1a1e30)',
          700: 'var(--ink-700, #252b44)',
          500: 'var(--ink-500, #64748b)',
          primary: 'var(--color-text-primary, #ffffff)',
          secondary: 'var(--color-text-secondary, #e2e8f0)',
          muted: 'var(--color-text-muted, #94a3b8)',
        },
        paper: {
          0: '#ffffff',
          50: '#f8fafc',
          100: 'var(--paper-100, #ffffff)',
          200: 'var(--paper-200, #e2e8f0)',
          300: 'var(--paper-300, #cbd5e1)',
          400: 'var(--paper-400, #94a3b8)',
        },
        canvas: {
          base: 'var(--color-canvas-base, #090a0f)',
          default: 'var(--color-canvas-base, #090a0f)',
          subtle: 'var(--color-canvas-subtle, #0d0f18)',
          surface: 'var(--color-canvas-surface, #131622)',
          elevated: 'var(--color-canvas-elevated, #1a1e30)',
          hover: 'var(--color-canvas-elevated, #1a1e30)',
          overlay: 'var(--color-canvas-overlay, #232840)',
        },
        border: {
          subtle: 'var(--color-border-subtle, rgba(255, 255, 255, 0.05))',
          DEFAULT: 'var(--color-border-default, rgba(255, 255, 255, 0.08))',
          default: 'var(--color-border-default, rgba(255, 255, 255, 0.08))',
          strong: 'var(--color-border-strong, rgba(255, 255, 255, 0.16))',
          focus: 'var(--color-border-focus, #6366f1)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary, #6366f1)',
          hover: 'var(--accent-primary-strong, #4f46e5)',
          subtle: 'var(--accent-subtle, rgba(99, 102, 241, 0.14))',
          border: 'var(--accent-border, rgba(99, 102, 241, 0.32))',
        },
        primary: {
          DEFAULT: 'var(--accent-primary, #6366f1)',
          hover: 'var(--accent-primary-strong, #4f46e5)',
          glow: 'var(--primary-lime-glow, rgba(99, 102, 241, 0.25))',
        },
        secondary: {
          DEFAULT: 'var(--gemini-purple, #a855f7)',
          hover: 'var(--gemini-violet, #7c3aed)',
        },
        signal: {
          success: 'var(--signal-success, #10b981)',
          warning: 'var(--signal-warning, #f59e0b)',
          error: 'var(--signal-error, #ef4444)',
          info: 'var(--signal-info, #06b6d4)',
        },
        status: {
          success: 'var(--signal-success, #10b981)',
          warning: 'var(--signal-warning, #f59e0b)',
          error: 'var(--signal-error, #ef4444)',
          info: 'var(--signal-info, #06b6d4)',
        },
        success: 'var(--signal-success, #10b981)',
        txt: {
          primary: 'var(--color-text-primary, #ffffff)',
          secondary: 'var(--color-text-secondary, #e2e8f0)',
          muted: 'var(--color-text-muted, #94a3b8)',
          disabled: 'var(--color-text-disabled, #64748b)',
        },
        text: {
          primary: 'var(--color-text-primary, #ffffff)',
          secondary: 'var(--color-text-secondary, #e2e8f0)',
          tertiary: 'var(--color-text-muted, #94a3b8)',
          muted: 'var(--color-text-muted, #94a3b8)',
          disabled: 'var(--color-text-disabled, #64748b)',
        }
      },
      borderRadius: {
        xs: 'var(--radius-xs, 2px)',
        sm: 'var(--radius-sm, 4px)',
        md: 'var(--radius-md, 6px)',
        lg: 'var(--radius-lg, 8px)',
        xl: 'var(--radius-xl, 10px)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'sm': 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.35))',
        'surface-card': 'var(--shadow-md, 0 4px 12px -2px rgba(0, 0, 0, 0.5))',
        'modal': 'var(--shadow-modal, 0 16px 40px -8px rgba(0, 0, 0, 0.8))',
        'popover': '0 10px 38px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px var(--color-border-default)',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        'fast': '120ms',
        'normal': '200ms',
        'slow': '300ms',
      }
    },
  },
  plugins: [],
};
