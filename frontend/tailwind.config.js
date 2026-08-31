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
          950: 'var(--ink-950, #11100f)',
          900: 'var(--ink-900, #171614)',
          850: 'var(--ink-850, #1e1c1a)',
          800: 'var(--ink-800, #262320)',
          700: 'var(--ink-700, #3b3834)',
          500: 'var(--ink-500, #77716a)',
          primary: 'var(--color-text-primary, #f4f0e8)',
          secondary: 'var(--color-text-secondary, #ded8cc)',
          muted: 'var(--color-text-muted, #b7afa2)',
        },
        paper: {
          0: '#fbfaf7',
          50: '#f3f0e9',
          100: 'var(--paper-100, #f4f0e8)',
          200: 'var(--paper-200, #ded8cc)',
          300: 'var(--paper-300, #b7afa2)',
          400: 'var(--paper-400, #8c8477)',
        },
        canvas: {
          base: 'var(--color-canvas-base, #11100f)',
          subtle: 'var(--color-canvas-subtle, #171614)',
          surface: 'var(--color-canvas-surface, #1e1c1a)',
          elevated: 'var(--color-canvas-elevated, #262320)',
          overlay: 'var(--color-canvas-overlay, #3b3834)',
        },
        border: {
          subtle: 'var(--color-border-subtle, rgba(244, 240, 232, 0.05))',
          DEFAULT: 'var(--color-border-default, rgba(244, 240, 232, 0.09))',
          strong: 'var(--color-border-strong, rgba(244, 240, 232, 0.16))',
          focus: 'var(--color-border-focus, #d45b3f)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary, #d45b3f)',
          hover: 'var(--accent-primary-strong, #b8452f)',
          subtle: 'var(--accent-subtle, rgba(212, 91, 63, 0.12))',
          border: 'var(--accent-border, rgba(212, 91, 63, 0.28))',
        },
        signal: {
          success: 'var(--signal-success, #5c8b6b)',
          warning: 'var(--signal-warning, #b78945)',
          error: 'var(--signal-error, #b9574e)',
          info: 'var(--signal-info, #5d7895)',
        },
        status: {
          success: 'var(--signal-success, #5c8b6b)',
          warning: 'var(--signal-warning, #b78945)',
          error: 'var(--signal-error, #b9574e)',
          info: 'var(--signal-info, #5d7895)',
        },
        txt: {
          primary: 'var(--color-text-primary, #f4f0e8)',
          secondary: 'var(--color-text-secondary, #ded8cc)',
          muted: 'var(--color-text-muted, #b7afa2)',
          disabled: 'var(--color-text-disabled, #77716a)',
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
