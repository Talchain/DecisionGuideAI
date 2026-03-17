/**
 * Olumi Typography System (Design System v4)
 *
 * Single font family: Inter for all text.
 * Full specification: docs/design/Olumi_Design_System_v4.md
 *
 * Usage:
 * import { typography } from '@/styles/typography'
 * <h2 className={typography.h2}>Heading</h2>
 */

export const typography = {
  // Display (Hero)
  display: 'text-5xl font-bold font-sans leading-tight tracking-tight',

  // Headings - Inter (Olumi v1.2 aligned)
  h1: 'text-5xl font-semibold font-sans leading-tight',     // 48px
  h2: 'text-3xl font-semibold font-sans leading-tight',     // 30px (close to 32px)
  h3: 'text-2xl font-semibold font-sans leading-snug',      // 24px
  h4: 'text-xl font-medium font-sans leading-snug',         // 20px
  h5: 'text-lg font-medium font-sans leading-snug',         // 18px

  // Body - Inter (Olumi v1.2: Body is 16px)
  bodyLarge: 'text-lg font-sans leading-relaxed',           // 18px
  body: 'text-base font-sans leading-relaxed',              // 16px (guideline)
  bodySmall: 'text-sm font-sans leading-normal',            // 14px (minimum)

  // UI Elements - Inter (Olumi v1.2: Label is 14px)
  label: 'text-sm font-medium font-sans leading-normal',    // 14px (guideline)
  labelSmall: 'text-xs font-medium font-sans leading-normal', // 12px (badges only)
  caption: 'text-xs font-sans leading-normal',              // 12px (badges/chips)

  // Interactive - Inter
  button: 'text-sm font-semibold font-sans leading-none',   // 14px
  buttonSmall: 'text-xs font-semibold font-sans leading-none', // 12px
  link: 'text-sm font-medium font-sans underline hover:no-underline',

  // Specialized
  code: 'text-xs font-mono leading-normal',
  tabular: 'text-sm font-sans leading-normal tabular-nums', // 14px

  // Canvas/Graph - Inter (smaller for dense UI)
  nodeTitle: 'text-[13px] font-semibold font-sans leading-tight',
  nodeLabel: 'text-[11px] font-sans leading-tight',
  edgeLabel: 'text-[10px] font-sans leading-tight',

  // Results Panel — strict 3-size system for 360px side panel
  // Only these three tokens should be used inside src/components/results/
  panelHeader: 'text-sm font-semibold font-sans leading-snug',    // 14px — section titles, winner name, key emphasis
  panelBody: 'text-xs font-sans leading-relaxed',                 // 12px — body text, descriptions, bullets, card content
  panelMeta: 'text-[11px] font-sans leading-snug',                // 11px — badges, pills, axis labels, tertiary metadata

  // Utility
  screenReaderOnly: 'sr-only',
} as const

export type TypographyKey = keyof typeof typography

/**
 * Helper to combine typography with additional classes
 */
export function typo(key: TypographyKey, additional?: string): string {
  return additional ? `${typography[key]} ${additional}` : typography[key]
}
