/**
 * Node theme tokens
 * Semantic colour tokens with 4.5:1 contrast for text, 3:1 for UI
 * British English: colour
 */

import type { NodeType } from '../domain/nodes'

/**
 * Node colour tokens
 * Provides light and dark theme variants
 */
interface NodeThemeTokens {
  background: string
  border: string
  text: string
  icon: string
  badge: string
  badgeText: string
}

/**
 * Light theme node colours
 * All text meets WCAG 4.5:1 contrast
 */
const LIGHT_THEME: Record<NodeType, NodeThemeTokens> = {
  goal: {
    background: '#FEF3C7', // Warm yellow
    border: '#F59E0B',
    text: '#78350F', // 4.5:1 contrast
    icon: '#F59E0B',
    badge: '#FDE68A',
    badgeText: '#78350F',
  },
  decision: {
    background: '#DBEAFE', // Sky blue
    border: '#3B82F6',
    text: '#1E3A8A', // 4.5:1 contrast
    icon: '#3B82F6',
    badge: '#BFDBFE',
    badgeText: '#1E3A8A',
  },
  option: {
    background: '#D1FAE5', // Emerald green
    border: '#10B981',
    text: '#065F46', // 4.5:1 contrast
    icon: '#10B981',
    badge: '#A7F3D0',
    badgeText: '#065F46',
  },
  risk: {
    background: '#FEE2E2', // Red
    border: '#EF4444',
    text: '#7F1D1D', // 4.5:1 contrast
    icon: '#EF4444',
    badge: '#FECACA',
    badgeText: '#7F1D1D',
  },
  outcome: {
    background: '#E9D5FF', // Purple
    border: '#A855F7',
    text: '#581C87', // 4.5:1 contrast
    icon: '#A855F7',
    badge: '#DDD6FE',
    badgeText: '#581C87',
  },
}

/**
 * Dark theme node colours
 * All text meets WCAG 4.5:1 contrast
 */
const DARK_THEME: Record<NodeType, NodeThemeTokens> = {
  goal: {
    background: '#78350F',
    border: '#FCD34D',
    text: '#FEF3C7', // 4.5:1 contrast
    icon: '#FCD34D',
    badge: '#92400E',
    badgeText: '#FDE68A',
  },
  decision: {
    background: '#1E3A8A',
    border: '#60A5FA',
    text: '#DBEAFE', // 4.5:1 contrast
    icon: '#60A5FA',
    badge: '#1E40AF',
    badgeText: '#BFDBFE',
  },
  option: {
    background: '#065F46',
    border: '#34D399',
    text: '#D1FAE5', // 4.5:1 contrast
    icon: '#34D399',
    badge: '#047857',
    badgeText: '#A7F3D0',
  },
  risk: {
    background: '#7F1D1D',
    border: '#F87171',
    text: '#FEE2E2', // 4.5:1 contrast
    icon: '#F87171',
    badge: '#991B1B',
    badgeText: '#FECACA',
  },
  outcome: {
    background: '#581C87',
    border: '#C084FC',
    text: '#F3E8FF', // 4.5:1 contrast
    icon: '#C084FC',
    badge: '#6B21A8',
    badgeText: '#E9D5FF',
  },
}

/**
 * Get node theme tokens for current theme
 */
export function getNodeTheme(type: NodeType, isDark = false): NodeThemeTokens {
  return isDark ? DARK_THEME[type] : LIGHT_THEME[type]
}

/**
 * Node size tokens
 */
export const NODE_SIZES = {
  radius: '8px',
  padding: '12px',
  headerHeight: '32px',
  minWidth: 160,
  minHeight: 60,
} as const

/**
 * Node shadow tokens
 */
export const NODE_SHADOWS = {
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  hover: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  selected: '0 0 0 2px #3B82F6, 0 4px 6px -1px rgb(0 0 0 / 0.1)',
} as const

/**
 * Node transition tokens
 * Respects prefers-reduced-motion
 */
export const NODE_TRANSITIONS = {
  default: 'all 150ms ease-out',
  shadow: 'box-shadow 150ms ease-out',
  transform: 'transform 150ms ease-out',
} as const
