/**
 * Phase 1B: Shadow System
 *
 * Consistent elevation across all components
 *
 * Usage:
 * import { shadows } from '@/styles/shadows'
 * <div className={shadows.panel}>...</div>
 */

export const shadows = {
  none: 'shadow-none',
  sm: 'shadow-sm',        // Subtle elevation (cards, chips)
  md: 'shadow-md',        // Standard elevation (panels, dropdowns)
  lg: 'shadow-lg',        // High elevation (modals, dialogs)
  xl: 'shadow-xl',        // Maximum elevation (tooltips, popovers)
  panel: 'shadow-[0_2px_8px_rgba(0,0,0,0.08)]', // Custom panel shadow
  node: 'shadow-[0_1px_3px_rgba(0,0,0,0.1)]',   // Node shadow (subtle)
} as const

export type ShadowKey = keyof typeof shadows

/**
 * Usage Guidelines:
 * - Cards/panels: shadows.panel
 * - Nodes: shadows.node
 * - Modals: shadows.lg
 * - Dropdowns: shadows.md
 * - Buttons (hover): shadows.sm
 * - Tooltips: shadows.xl
 */
