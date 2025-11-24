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
    // Sky-500 accent for decisions
    background: 'var(--info-100, #E1EFF7)',
    border: 'var(--sky-500, #63ADCF)',
    text: 'var(--text-primary, #262626)',
    icon: 'var(--sky-500, #63ADCF)',
    badge: 'var(--info-50, #F0F7FB)',
    badgeText: 'var(--text-secondary, rgba(38, 38, 38, 0.70))',
  },
  option: {
    // Mint-500 accent for options
    background: 'var(--success-100, #E0F5EB)',
    border: 'var(--mint-500, #67C89E)',
    text: 'var(--text-primary, #262626)',
    icon: 'var(--mint-500, #67C89E)',
    badge: 'var(--success-50, #F0FAF5)',
    badgeText: 'var(--text-secondary, rgba(38, 38, 38, 0.70))',
  },
  factor: {
    // Neutral sand-200 for factors
    background: 'var(--sand-200, #E1D8C7)',
    border: 'rgba(38, 38, 38, 0.24)',
    text: 'var(--text-primary, #262626)',
    icon: 'var(--text-secondary, rgba(38, 38, 38, 0.70))',
    badge: 'rgba(38, 38, 38, 0.06)',
    badgeText: 'var(--text-secondary, rgba(38, 38, 38, 0.70))',
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
    // Lilac-400 accent for outcomes (fully opaque background for better legibility)
    background: 'var(--lilac-50, #F3E8FF)',
    border: 'var(--lilac-400, #9E9AF1)',
    text: 'var(--text-primary, #262626)',
    icon: 'var(--lilac-400, #9E9AF1)',
    badge: 'var(--lilac-100, #EDE9FE)',
    badgeText: 'var(--text-secondary, rgba(38, 38, 38, 0.70))',
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
  factor: {
    background: 'var(--node-factor-bg, #1F2937)', // Dark gray - neutral for technical factors
    border: 'var(--node-factor-border, #9CA3AF)',
    text: '#F3F4F6', // 4.5:1 contrast
    icon: 'var(--node-factor-border, #9CA3AF)',
    badge: 'rgba(156, 163, 175, 0.15)',
    badgeText: '#E5E7EB',
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
  selected: '0 0 0 2px var(--semantic-info), 0 4px 6px -1px rgb(0 0 0 / 0.1)', // Olumi v1.2: sky-500
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
