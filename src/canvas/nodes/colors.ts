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
  goal: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    hover: 'hover:border-amber-600',
    selected: 'ring-4 ring-amber-400 ring-opacity-50',
    text: 'text-amber-900',
  },
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
    bg: 'bg-slate-50',
    border: 'border-slate-400',
    hover: 'hover:border-slate-500',
    selected: 'ring-4 ring-slate-300 ring-opacity-50',
    text: 'text-slate-900',
  },
  risk: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    hover: 'hover:border-red-600',
    selected: 'ring-4 ring-red-400 ring-opacity-50',
    text: 'text-red-900',
  },
  action: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
    hover: 'hover:border-emerald-600',
    selected: 'ring-4 ring-emerald-400 ring-opacity-50',
    text: 'text-emerald-900',
  },
} as const

export type NodeColorType = keyof typeof nodeColors
