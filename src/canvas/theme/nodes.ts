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
 * Dark theme node colours - Using Olumi brand palette
 * All text meets WCAG 4.5:1 contrast
 *
 * CSS Variables from index.css:
 * --node-goal-bg: #1A1E28, --node-goal-border: #F7C948
 * --node-decision-bg: #121A2A, --node-decision-border: #5B6CFF
 * --node-option-bg: #0F1F1B, --node-option-border: #20C997
 * --node-risk-bg: #241214, --node-risk-border: #FF6B6B
 * --node-outcome-bg: #171329, --node-outcome-border: #7B46FF
 */
const DARK_THEME: Record<NodeType, NodeThemeTokens> = {
  goal: {
    background: 'var(--node-goal-bg, #1A1E28)',
    border: 'var(--node-goal-border, #F7C948)',
    text: '#FEF3C7', // 4.5:1 contrast
    icon: 'var(--node-goal-border, #F7C948)',
    badge: 'rgba(247, 201, 72, 0.15)',
    badgeText: '#FDE68A',
  },
  decision: {
    background: 'var(--node-decision-bg, #121A2A)',
    border: 'var(--node-decision-border, #5B6CFF)',
    text: '#DBEAFE', // 4.5:1 contrast
    icon: 'var(--node-decision-border, #5B6CFF)',
    badge: 'rgba(91, 108, 255, 0.15)',
    badgeText: '#BFDBFE',
  },
  option: {
    background: 'var(--node-option-bg, #0F1F1B)',
    border: 'var(--node-option-border, #20C997)',
    text: '#D1FAE5', // 4.5:1 contrast
    icon: 'var(--node-option-border, #20C997)',
    badge: 'rgba(32, 201, 151, 0.15)',
    badgeText: '#A7F3D0',
  },
  risk: {
    background: 'var(--node-risk-bg, #241214)',
    border: 'var(--node-risk-border, #FF6B6B)',
    text: '#FEE2E2', // 4.5:1 contrast
    icon: 'var(--node-risk-border, #FF6B6B)',
    badge: 'rgba(255, 107, 107, 0.15)',
    badgeText: '#FECACA',
  },
  outcome: {
    background: 'var(--node-outcome-bg, #171329)',
    border: 'var(--node-outcome-border, #7B46FF)',
    text: '#F3E8FF', // 4.5:1 contrast
    icon: 'var(--node-outcome-border, #7B46FF)',
    badge: 'rgba(123, 70, 255, 0.15)',
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
 * Node shadow tokens - Using Olumi primary for selection
 */
export const NODE_SHADOWS = {
  default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  hover: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  selected: '0 0 0 2px var(--olumi-primary, #5B6CFF), 0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
