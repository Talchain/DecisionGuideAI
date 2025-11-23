/**
 * Olumi Typography System
 *
 * Body/UI: Inter (--font-body)
 * Buttons: League Spartan (--font-heading)
 *
 * Usage:
 * import { typography } from '@/styles/typography'
 * <h2 className={typography.h2}>Heading</h2>
 */

export const typography = {
  // Headings - Inter
  h1: 'text-4xl font-semibold font-body leading-tight',          // 36px
  h2: 'text-2xl font-semibold font-body leading-tight',          // 24px
  h3: 'text-xl font-semibold font-body leading-snug',            // 20px
  h4: 'text-lg font-medium font-body leading-snug',              // 18px

  // Body - Inter
  bodyLarge: 'text-base font-body leading-relaxed',              // 16px
  body: 'text-sm font-body leading-relaxed',                     // 14px
  bodySmall: 'text-xs font-body leading-normal',                 // 12px

  // UI Elements - Inter
  label: 'text-sm font-medium font-body leading-normal',         // 14px
  caption: 'text-xs font-body leading-normal',                   // 12px

  // Buttons - League Spartan (ONLY exception)
  button: 'text-sm font-medium font-heading leading-none',       // 14px

  // Special - Inter
  code: 'text-xs font-mono leading-normal',                      // 12px monospace

  // Graph Nodes - Inter
  nodeTitle: 'text-sm font-semibold font-body leading-tight',    // 14px
  nodeLabel: 'text-xs font-body leading-tight',                  // 12px
  edgeLabel: 'text-[11px] font-body leading-tight',              // 11px for edge labels
} as const

export type TypographyKey = keyof typeof typography

// Helper function
export function typo(key: TypographyKey, additional?: string): string {
  return additional ? `${typography[key]} ${additional}` : typography[key]
}
