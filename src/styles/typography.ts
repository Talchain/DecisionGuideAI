/**
 * Olumi Typography System (Phase 1B)
 *
 * Single font family: Inter for all text
 *
 * Usage:
 * import { typography } from '@/styles/typography'
 * <h2 className={typography.h2}>Heading</h2>
 */

export const typography = {
  // Display
  display: 'text-5xl font-bold font-sans leading-tight tracking-tight',

  // Headings - Inter
  h1: 'text-4xl font-semibold font-sans leading-tight',
  h2: 'text-2xl font-semibold font-sans leading-tight',
  h3: 'text-xl font-semibold font-sans leading-snug',
  h4: 'text-lg font-medium font-sans leading-snug',
  h5: 'text-base font-medium font-sans leading-snug',

  // Body - Inter
  bodyLarge: 'text-base font-sans leading-relaxed',
  body: 'text-sm font-sans leading-relaxed',
  bodySmall: 'text-xs font-sans leading-normal',

  // UI Elements - Inter
  label: 'text-sm font-medium font-sans leading-normal',
  labelSmall: 'text-xs font-medium font-sans leading-normal',
  caption: 'text-xs font-sans leading-normal',

  // Interactive - Inter
  button: 'text-sm font-semibold font-sans leading-none',
  buttonSmall: 'text-xs font-semibold font-sans leading-none',
  link: 'text-sm font-medium font-sans underline hover:no-underline',

  // Specialized
  code: 'text-xs font-mono leading-normal',
  tabular: 'text-sm font-sans leading-normal tabular-nums',

  // Canvas/Graph - Inter
  nodeTitle: 'text-[13px] font-semibold font-sans leading-tight',
  nodeLabel: 'text-[11px] font-sans leading-tight',
  edgeLabel: 'text-[10px] font-sans leading-tight',

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
