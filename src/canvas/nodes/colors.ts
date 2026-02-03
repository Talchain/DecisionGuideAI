/**
 * Node type colors using Olumi Two-Shade System v2.0
 *
 * Each node type maps to semantic colors:
 * - Background: {color}-light (light shade)
 * - Border/Text: {color} (main shade)
 * - Hover: {color}-hover (derived state)
 * - Selected: ring with main color at 50% opacity
 */

export const nodeColors = {
  goal: {
    bg: 'bg-goal-light',
    border: 'border-goal',
    hover: 'hover:border-goal-hover',
    selected: 'ring-4 ring-goal/50',
    text: 'text-goal',
  },
  decision: {
    bg: 'bg-info-light',
    border: 'border-info',
    hover: 'hover:border-info-hover',
    selected: 'ring-4 ring-info/50',
    text: 'text-info',
  },
  option: {
    bg: 'bg-option-light',
    border: 'border-option',
    hover: 'hover:border-option/80',
    selected: 'ring-4 ring-option/50',
    text: 'text-option',
  },
  outcome: {
    bg: 'bg-success-light',
    border: 'border-success',
    hover: 'hover:border-success-hover',
    selected: 'ring-4 ring-success/50',
    text: 'text-success',
  },
  factor: {
    bg: 'bg-factor-light',
    border: 'border-factor',
    hover: 'hover:border-factor/80',
    selected: 'ring-4 ring-factor/50',
    text: 'text-factor',
  },
  risk: {
    bg: 'bg-danger-light',
    border: 'border-danger',
    hover: 'hover:border-danger-hover',
    selected: 'ring-4 ring-danger/50',
    text: 'text-danger',
  },
  action: {
    bg: 'bg-success-light',
    border: 'border-success',
    hover: 'hover:border-success-hover',
    selected: 'ring-4 ring-success/50',
    text: 'text-success',
  },
} as const

export type NodeColorType = keyof typeof nodeColors
