/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Phase 1B: Typography - Single font family (Inter) for everything
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        body: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      transitionTimingFunction: {
        'bounce-ease': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      // Olumi Design System Colors
      colors: {
        // Neutrals
        ink: {
          900: 'var(--ink-900)',
        },
        canvas: {
          25: 'var(--canvas-25)',
        },
        paper: {
          50: 'var(--paper-50)',
        },
        sand: {
          200: 'var(--sand-200)',
        },
        // Brand Colors
        sun: {
          500: 'var(--sun-500)',
        },
        mint: {
          400: 'var(--mint-400)',
          500: 'var(--mint-500)',
        },
        sky: {
          200: 'var(--sky-200)',
          500: 'var(--sky-500)',
          600: 'var(--sky-600)',
        },
        carrot: {
          500: 'var(--carrot-500)',
        },
        lilac: {
          400: 'var(--lilac-400)',
        },
        periwinkle: {
          200: 'var(--periwinkle-200)',
        },
        banana: {
          200: 'var(--banana-200)',
        },
        // Semantic Tokens (override Tailwind defaults with Olumi)
        primary: {
          DEFAULT: 'var(--semantic-primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          disabled: 'var(--primary-disabled)',
        },
        danger: {
          50: 'var(--danger-50)',
          100: 'var(--danger-100)',
          200: 'var(--danger-200)',
          300: 'var(--danger-300)',
          400: 'var(--danger-400)',
          500: 'var(--danger-500)',
          600: 'var(--danger-600)',
          700: 'var(--danger-700)',
          800: 'var(--danger-800)',
          900: 'var(--danger-900)',
          DEFAULT: 'var(--semantic-danger)',
          hover: 'var(--danger-hover)',
          active: 'var(--danger-active)',
          disabled: 'var(--danger-disabled)',
        },
        warning: {
          50: 'var(--warning-50)',
          100: 'var(--warning-100)',
          200: 'var(--warning-200)',
          300: 'var(--warning-300)',
          400: 'var(--warning-400)',
          500: 'var(--warning-500)',
          600: 'var(--warning-600)',
          700: 'var(--warning-700)',
          800: 'var(--warning-800)',
          900: 'var(--warning-900)',
          DEFAULT: 'var(--semantic-warning)',
        },
        success: {
          50: 'var(--success-50)',
          100: 'var(--success-100)',
          200: 'var(--success-200)',
          300: 'var(--success-300)',
          400: 'var(--success-400)',
          500: 'var(--success-500)',
          600: 'var(--success-600)',
          700: 'var(--success-700)',
          800: 'var(--success-800)',
          900: 'var(--success-900)',
          DEFAULT: 'var(--semantic-success)',
        },
        info: {
          50: 'var(--info-50)',
          100: 'var(--info-100)',
          200: 'var(--info-200)',
          300: 'var(--info-300)',
          400: 'var(--info-400)',
          500: 'var(--info-500)',
          600: 'var(--info-600)',
          700: 'var(--info-700)',
          800: 'var(--info-800)',
          900: 'var(--info-900)',
          DEFAULT: 'var(--semantic-info)',
        },
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
      },
      borderRadius: {
        xl2: '1rem', // rounded-2xl alias for consistency
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
    },
  },
  plugins: [],
};