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
          header: 'rgb(var(--text-header-rgb) / <alpha-value>)',
          body: 'var(--text-body)',
          light: 'rgb(var(--text-light-rgb) / <alpha-value>)',
          'on-color': 'var(--text-on-color)',
        },

        // ============================================
        // SURFACES & BACKGROUNDS
        // ============================================
        canvas: {
          DEFAULT: 'var(--bg-canvas)',
        },
        panel: {
          DEFAULT: 'rgb(var(--bg-panel-rgb) / <alpha-value>)',
          hover: 'rgb(var(--bg-panel-hover-rgb) / <alpha-value>)',
          border: 'rgb(var(--border-default-rgb) / <alpha-value>)',
          // ⛔ `field` DELIBERATELY DOES NOT LIVE HERE — see `borderColor` at the
          // foot of this file. A colour under `colors` generates the whole
          // utility family (`text-*`, `bg-*`, `border-*`); this token is a
          // BORDER colour at 3.70:1, which clears the 3.00:1 non-text floor and
          // fails the 4.5:1 normal-text floor, so a `text-panel-field` utility
          // would be a colour the product must never paint as text.
        },

        // Border emphasis
        border: {
          emphasis: 'rgb(var(--border-emphasis-rgb) / <alpha-value>)',
        },

        // Neutral track fill (empty progress bars, container outlines)
        track: {
          neutral: 'var(--track-neutral)',
        },

        // Legacy neutral (for gradual migration)
        ink: {
          900: 'rgb(var(--text-header-rgb) / <alpha-value>)',
        },
        paper: {
          50: 'rgb(var(--bg-panel-rgb) / <alpha-value>)',
        },
        sand: {
          200: 'rgb(var(--border-default-rgb) / <alpha-value>)',
        },

        // ============================================
        // SEMANTIC COLORS (Two-Shade System)
        // ============================================

        // Danger / Risk / Critical (Red)
        danger: {
          DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)',
          light: 'rgb(var(--danger-light-rgb) / <alpha-value>)',
          hover: 'var(--danger-hover)',
          active: 'var(--danger-active)',
          disabled: 'var(--danger-disabled)',
          // Legacy numeric aliases for backward compatibility
          100: 'rgb(var(--danger-light-rgb) / <alpha-value>)',
          200: 'rgb(var(--danger-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--danger-rgb) / <alpha-value>)',
          600: 'var(--danger-hover)',
          700: 'var(--danger-active)',
        },

        // Success / Outcome / Positive (Green)
        success: {
          DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)',
          light: 'rgb(var(--success-light-rgb) / <alpha-value>)',
          hover: 'var(--success-hover)',
          active: 'var(--success-active)',
          disabled: 'var(--success-disabled)',
          // Legacy numeric aliases for backward compatibility
          100: 'rgb(var(--success-light-rgb) / <alpha-value>)',
          200: 'rgb(var(--success-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--success-rgb) / <alpha-value>)',
          600: 'var(--success-hover)',
          700: 'var(--success-active)',
        },

        // Info / Decision / Navigation (Blue)
        info: {
          DEFAULT: 'rgb(var(--info-rgb) / <alpha-value>)',
          ink: 'rgb(var(--info-ink-rgb) / <alpha-value>)',
          light: 'rgb(var(--info-light-rgb) / <alpha-value>)',
          hover: 'var(--info-hover)',
          active: 'var(--info-active)',
          disabled: 'var(--info-disabled)',
          // Legacy numeric aliases for backward compatibility
          100: 'rgb(var(--info-light-rgb) / <alpha-value>)',
          200: 'rgb(var(--info-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--info-rgb) / <alpha-value>)',
          600: 'var(--info-hover)',
          700: 'var(--info-active)',
        },

        // Warning (Orange) - Separate from Danger
        warning: {
          DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)',
          ink: 'rgb(var(--warning-ink-rgb) / <alpha-value>)',
          light: 'rgb(var(--warning-light-rgb) / <alpha-value>)',
          hover: 'var(--warning-hover)',
          active: 'var(--warning-active)',
          disabled: 'var(--warning-disabled)',
          // Legacy numeric aliases for backward compatibility
          100: 'rgb(var(--warning-light-rgb) / <alpha-value>)',
          200: 'rgb(var(--warning-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--warning-rgb) / <alpha-value>)',
          600: 'var(--warning-hover)',
          700: 'var(--warning-active)',
        },

        // ============================================
        // NODE-SPECIFIC COLORS
        // ============================================

        // Goal (Yellow) - Entity colour only (v4: decoupled from primary)
        goal: {
          DEFAULT: 'rgb(var(--goal-rgb) / <alpha-value>)',
          light: 'rgb(var(--goal-light-rgb) / <alpha-value>)',
          hover: '#E5B523',  // Goal-specific hover (10% darker yellow)
          // Legacy numeric aliases
          50: 'rgb(var(--goal-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--goal-rgb) / <alpha-value>)',
        },

        // Option (Purple)
        option: {
          DEFAULT: 'rgb(var(--option-rgb) / <alpha-value>)',
          light: 'rgb(var(--option-light-rgb) / <alpha-value>)',
          // Legacy numeric aliases
          50: 'rgb(var(--option-light-rgb) / <alpha-value>)',
          400: 'rgb(var(--option-rgb) / <alpha-value>)',
          500: 'rgb(var(--option-rgb) / <alpha-value>)',
        },

        // Factor (Stone)
        factor: {
          DEFAULT: 'rgb(var(--factor-rgb) / <alpha-value>)',
          light: 'rgb(var(--factor-light-rgb) / <alpha-value>)',
          // Legacy numeric aliases
          50: 'rgb(var(--factor-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--factor-rgb) / <alpha-value>)',
        },

        // ============================================
        // PRIMARY (Maps to Info Blue — v5 §3.10)
        // ============================================
        primary: {
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
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
          500: 'rgb(var(--goal-rgb) / <alpha-value>)',
        },
        mint: {
          400: 'rgb(var(--success-rgb) / <alpha-value>)',
          500: 'rgb(var(--success-rgb) / <alpha-value>)',
        },
        sky: {
          200: 'rgb(var(--info-light-rgb) / <alpha-value>)',
          500: 'rgb(var(--info-rgb) / <alpha-value>)',
          600: 'var(--info-hover)',
        },
        carrot: {
          500: 'rgb(var(--danger-rgb) / <alpha-value>)',
        },
        lilac: {
          400: 'rgb(var(--option-rgb) / <alpha-value>)',
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
        // Contract v3.1 resting canvas card (DESIGN-GAP-v31 #43). A named
        // utility, not `shadow-[var(--…)]`: Tailwind reads a bare var() there
        // as a shadow COLOUR, and the card rendered with no shadow at all
        // (measured `box-shadow: none`, 26 Sep).
        'card-rest': 'var(--shadow-card-rest)',
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

      /**
       * ⭐⭐ BORDER-ONLY COLOURS — and `field` is here for TWO measured reasons,
       * not for tidiness.
       *
       * It was first added as `colors.panel.field`, which was wrong twice over:
       *
       * 1. ⛔ IT DID NOT RENDER. Tailwind flattens a NESTED colour key with a
       *    dash, so `colors.panel.field` generates `border-panel-field` — while
       *    `styles/controls.ts` and `EditableLabel.tsx` ship the class
       *    `border-field`. That utility was defined NOWHERE, so Tailwind emitted
       *    nothing and the 3.70:1 border never appeared. Confirmed by running
       *    tailwindcss over the committed config: `.border-panel-field` emitted,
       *    `.border-field` absent, with `border-[#ff0000]` in the same pass as a
       *    positive control and `.border-panel-border` (556 uses) as the
       *    contrast. A TOP-LEVEL key under `borderColor` yields the bare
       *    `border-field`, which is the class the source already uses.
       *
       * 2. ⛔ AND AS A `colors` ENTRY IT WAS A TEXT COLOUR IT MUST NEVER BE.
       *    `tests/ci-guards/reasoning-model-text-contrast-per-site.spec.ts`
       *    enumerates `theme.extend.colors` and pins the set of colours sitting
       *    between the 3:1 and 4.5:1 floors. `panel-field` at 3.70:1 landed in
       *    that band and the guard REDed — correctly, because a `text-*`
       *    utility existed for a colour that fails normal-text contrast.
       *
       * ⭐ Declaring it here fixes both at once: the class resolves, and the
       * colour leaves the text guard's enumeration because there is no longer
       * any way to paint it as text. The guard stops reporting it because the
       * risk was removed, not hidden.
       *
       * ⚠ `extend` MERGES, so every borderColor key Tailwind derives from
       * `colors` survives — `border-panel-border` and the other 332 are
       * untouched. `brand.css` remains the single source of the value.
       */
      borderColor: {
        field: 'rgb(var(--border-field-rgb) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
