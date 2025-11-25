/**
 * Phase 1B: Node type colors using Olumi brand palette
 *
 * Each type has consistent colors for:
 * - Background (subtle tint)
 * - Border (strong accent)
 * - Hover state
 * - Selected state
 * - Text color
 */

export const nodeColors = {
  decision: {
    bg: 'bg-sky-50',
    border: 'border-sky-500',
    hover: 'hover:border-sky-600',
    selected: 'ring-4 ring-sky-400 ring-opacity-50',
    text: 'text-sky-900',
  },
  option: {
    bg: 'bg-purple-50',
    border: 'border-purple-500',
    hover: 'hover:border-purple-600',
    selected: 'ring-4 ring-purple-400 ring-opacity-50',
    text: 'text-purple-900',
  },
  outcome: {
    bg: 'bg-mint-50',
    border: 'border-mint-500',
    hover: 'hover:border-mint-600',
    selected: 'ring-4 ring-mint-400 ring-opacity-50',
    text: 'text-mint-900',
  },
  factor: {
    bg: 'bg-sand-50',
    border: 'border-sand-400',
    hover: 'hover:border-sand-500',
    selected: 'ring-4 ring-sand-300 ring-opacity-50',
    text: 'text-ink-900',
  },
} as const

export type NodeColorType = keyof typeof nodeColors
