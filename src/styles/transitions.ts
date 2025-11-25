/**
 * Phase 1B: Transition System
 *
 * Consistent animation timing across all components
 *
 * Usage:
 * import { transitions } from '@/styles/transitions'
 * <button className={`${transitions.colors} hover:bg-sky-600`}>
 */

export const transitions = {
  fast: 'transition-all duration-150 ease-in-out',
  base: 'transition-all duration-200 ease-in-out',
  slow: 'transition-all duration-300 ease-in-out',
  colors: 'transition-colors duration-200',
  transform: 'transition-transform duration-200',
  opacity: 'transition-opacity duration-200',
} as const

export type TransitionKey = keyof typeof transitions

/**
 * Usage Guidelines:
 * - Buttons, chips: transitions.colors
 * - Panels, modals: transitions.base
 * - Hover effects: transitions.fast
 * - Complex animations: transitions.slow
 * - Slides, reveals: transitions.transform
 */
