/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Typography - Single font family (Inter) for everything
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

      /**
       * Olumi Design System Colors - Two-Shade System
       *
       * Each semantic color has:
       * - DEFAULT: Main color for text, icons, strong accents
       * - light: Light shade for backgrounds
       *
       * For borders: Use main color at 30% opacity via className or rgba()
       */
      colors: {
        // ============================================
        // TEXT COLORS
        // ============================================
        text: {
          header: 'var(--text-header)',
          body: 'var(--text-body)',
          light: 'var(--text-light)',
          'on-color': 'var(--text-on-color)',
        },

        // ============================================
        // SURFACES & BACKGROUNDS
        // ============================================
        canvas: {
          DEFAULT: 'var(--bg-canvas)',
        },
        panel: {
          DEFAULT: 'var(--bg-panel)',
          hover: 'var(--bg-panel-hover)',
          border: 'var(--border-default)',
        },

        // Border emphasis
        border: {
          emphasis: 'var(--border-emphasis)',
        },

        // Neutral track fill (empty progress bars, container outlines)
        track: {
          neutral: 'var(--track-neutral)',
        },

        // Legacy neutral (for gradual migration)
        ink: {
          900: 'var(--text-header)',
        },
        paper: {
          50: 'var(--bg-panel)',
        },
        sand: {
          200: 'var(--border-default)',
        },

        // ============================================
        // SEMANTIC COLORS (Two-Shade System)
        // ============================================

        // Danger / Risk / Critical (Red)
        danger: {
          DEFAULT: 'var(--danger)',
          light: 'var(--danger-light)',
          bg: 'var(--danger-bg)',
          hover: 'var(--danger-hover)',
          active: 'var(--danger-active)',
          disabled: 'var(--danger-disabled)',
          // Legacy numeric aliases for backward compatibility
          50: 'var(--danger-bg)',
          100: 'var(--danger-light)',
          200: 'var(--danger-light)',
          500: 'var(--danger)',
          600: 'var(--danger-hover)',
          700: 'var(--danger-active)',
        },

        // Success / Outcome / Positive (Green)
        success: {
          DEFAULT: 'var(--success)',
          light: 'var(--success-light)',
          bg: 'var(--success-bg)',
          hover: 'var(--success-hover)',
          active: 'var(--success-active)',
          disabled: 'var(--success-disabled)',
          // Legacy numeric aliases for backward compatibility
          50: 'var(--success-bg)',
          100: 'var(--success-light)',
          200: 'var(--success-light)',
          500: 'var(--success)',
          600: 'var(--success-hover)',
          700: 'var(--success-active)',
        },

        // Info / Decision / Navigation (Blue)
        info: {
          DEFAULT: 'var(--info)',
          light: 'var(--info-light)',
          bg: 'var(--info-bg)',
          hover: 'var(--info-hover)',
          active: 'var(--info-active)',
          disabled: 'var(--info-disabled)',
          // Legacy numeric aliases for backward compatibility
          50: 'var(--info-bg)',
          100: 'var(--info-light)',
          200: 'var(--info-light)',
          500: 'var(--info)',
          600: 'var(--info-hover)',
          700: 'var(--info-active)',
        },

        // Warning (Orange) - Separate from Danger
        warning: {
          DEFAULT: 'var(--warning)',
          light: 'var(--warning-light)',
          bg: 'var(--warning-bg)',
          hover: 'var(--warning-hover)',
          active: 'var(--warning-active)',
          disabled: 'var(--warning-disabled)',
          // Legacy numeric aliases for backward compatibility
          50: 'var(--warning-bg)',
          100: 'var(--warning-light)',
          200: 'var(--warning-light)',
          500: 'var(--warning)',
          600: 'var(--warning-hover)',
          700: 'var(--warning-active)',
        },

        // ============================================
        // NODE-SPECIFIC COLORS
        // ============================================

        // Goal (Yellow) - Entity colour only (v4: decoupled from primary)
        goal: {
          DEFAULT: 'var(--goal)',
          light: 'var(--goal-light)',
          hover: '#E5B523',  // Goal-specific hover (10% darker yellow)
          // Legacy numeric aliases
          50: 'var(--goal-light)',
          500: 'var(--goal)',
        },

        // Option (Purple)
        option: {
          DEFAULT: 'var(--option)',
          light: 'var(--option-light)',
          // Legacy numeric aliases
          50: 'var(--option-light)',
          400: 'var(--option)',
          500: 'var(--option)',
        },

        // Factor (Stone)
        factor: {
          DEFAULT: 'var(--factor)',
          light: 'var(--factor-light)',
          // Legacy numeric aliases
          50: 'var(--factor-light)',
          500: 'var(--factor)',
        },

        // ============================================
        // PRIMARY (Maps to Info Blue — v5 §3.10)
        // ============================================
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          active: 'var(--primary-active)',
          disabled: 'var(--primary-disabled)',
        },

        // ============================================
        // CHART COLOURS (Data Visualisation — DS v5 §3.9)
        // Ordinal only, no semantic meaning. Aliases of brand.css --chart-N.
        // Mapping these enables bg/text/border/fill/stroke-chart-N utilities
        // so components no longer need inline style={{ fill: 'var(--chart-N)' }}.
        // Only chart-1..6 exist (chart-7/8 are planned, not implemented).
        // ============================================
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
          6: 'var(--chart-6)',
        },

        // ============================================
        // LEGACY BRAND ALIASES
        // (For backward compatibility during migration)
        // ============================================
        sun: {
          500: 'var(--goal)',
        },
        mint: {
          400: 'var(--success)',
          500: 'var(--success)',
        },
        sky: {
          200: 'var(--info-light)',
          500: 'var(--info)',
          600: 'var(--info-hover)',
        },
        carrot: {
          500: 'var(--danger)',
        },
        lilac: {
          400: 'var(--option)',
        },
      },

      // ============================================
      // SHADOWS
      // ============================================
      boxShadow: {
        panel: 'var(--shadow-panel)',
        1: 'var(--shadow-1)',
        2: 'var(--shadow-2)',
        3: 'var(--shadow-3)',
      },

      // ============================================
      // BORDER RADIUS
      // ============================================
      borderRadius: {
        xl2: '1rem',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },

      // ============================================
      // ANIMATION
      // ============================================
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      keyframes: {
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to:   { opacity: '0' },
        },
      },
      animation: {
        slideDown: 'slideDown 0.2s ease-out',
        fadeOut:   'fadeOut 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
