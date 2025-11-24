/**
 * Phase 3: Node type colors aligned with Olumi palette
 * Provides consistent, accessible color scheme for all node types
 */

export const nodeColors = {
  decision: {
    bg: 'bg-sky-50',
    border: 'border-sky-500',
    text: 'text-sky-900',
    hover: 'hover:bg-sky-100',
  },
  option: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    text: 'text-purple-900',
    hover: 'hover:bg-purple-100',
  },
  outcome: {
    bg: 'bg-mint-50',
    border: 'border-mint-500',
    text: 'text-mint-900',
    hover: 'hover:bg-mint-100',
  },
  factor: {
    bg: 'bg-sand-50',
    border: 'border-sand-500',
    text: 'text-ink-900',
    hover: 'hover:bg-sand-100',
  },
} as const

export type NodeColorType = keyof typeof nodeColors
