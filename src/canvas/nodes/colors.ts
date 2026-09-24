/**
 * Node type colors using Olumi Two-Shade System v2.0
 *
 * Each node type maps to semantic colors:
 * - Background: {color}-light (light shade)
 * - Border/Text: {color} (main shade)
 * - Frame: the card's resting 1px frame (contract v3.1 — see below)
 * - Hover: {color}-hover (derived state)
 * - Selected: ONE info ring on every family (contract v3.1 — see below)
 *
 * ⭐ `frame` IS THE CARD'S OWN BORDER, AND IT IS NOT `border` (contract v3.1
 * FRAME-08 / OR-03 / T10). The contract draws every card with
 * `border:1px solid color-mix(in srgb,var(--kind) 76%,#E2DDD5)` — the kind hue
 * mixed a quarter of the way to a warm neutral, so the loudest hues (risk
 * #EA7B4B, goal #F5C433) stop being the heaviest line on the board. It is
 * derived from TWO EXISTING TOKENS (`--{kind}` and `--border-default`), never a
 * new colour: factor lands at #BFB7A8 against the contract's #BCB5A7.
 * `border` keeps the full kind hue for its other readers (legend swatches and
 * anything outside the card frame); only the frame moves.
 *
 * ⚠ LITERAL STRINGS, NOT ASSEMBLED. Tailwind scans source text, so each class is
 * spelled out in full; a template-built `border-[color:...${kind}...]` would emit
 * no CSS at all.
 *
 * ⭐ `selected` IS ONE TOKEN ON EVERY FAMILY (contract v3.1 FRAME-09 / OR-10 /
 * T03): `.node.selected{box-shadow:0 0 0 2px var(--info),…}`. It was a 4px ring
 * in the node's own hue plus a white 2px offset — a six-hue, two-tone halo, and
 * on a risk card a 4px Danger halo triggered by the neutral act of clicking it.
 * Selection is an interaction state, so it takes the interaction colour (info)
 * at the focus width (2px, DS v5 §6.3). The AI states (highlight / attended)
 * keep their own wider rings in `BaseNode` so they stay distinguishable.
 */

export const nodeColors = {
  goal: {
    bg: 'bg-goal-light',
    border: 'border-goal',
    frame: 'border-[color:color-mix(in_srgb,var(--goal)_76%,var(--border-default))]',
    hover: 'hover:border-goal-hover',
    selected: 'ring-2 ring-info',
    text: 'text-goal',
  },
  decision: {
    bg: 'bg-info-light',
    border: 'border-info',
    frame: 'border-[color:color-mix(in_srgb,var(--info)_76%,var(--border-default))]',
    hover: 'hover:border-info-hover',
    selected: 'ring-2 ring-info',
    text: 'text-info',
  },
  option: {
    bg: 'bg-option-light',
    border: 'border-option',
    frame: 'border-[color:color-mix(in_srgb,var(--option)_76%,var(--border-default))]',
    hover: 'hover:border-option/80',
    selected: 'ring-2 ring-info',
    text: 'text-option',
  },
  outcome: {
    bg: 'bg-success-light',
    border: 'border-success',
    frame: 'border-[color:color-mix(in_srgb,var(--success)_76%,var(--border-default))]',
    hover: 'hover:border-success-hover',
    selected: 'ring-2 ring-info',
    text: 'text-success',
  },
  factor: {
    bg: 'bg-factor-light',
    border: 'border-factor',
    frame: 'border-[color:color-mix(in_srgb,var(--factor)_76%,var(--border-default))]',
    hover: 'hover:border-factor/80',
    selected: 'ring-2 ring-info',
    text: 'text-factor',
  },
  risk: {
    bg: 'bg-danger-light',
    border: 'border-danger',
    frame: 'border-[color:color-mix(in_srgb,var(--danger)_76%,var(--border-default))]',
    hover: 'hover:border-danger-hover',
    selected: 'ring-2 ring-info',
    text: 'text-danger',
  },
  action: {
    bg: 'bg-success-light',
    border: 'border-success',
    frame: 'border-[color:color-mix(in_srgb,var(--success)_76%,var(--border-default))]',
    hover: 'hover:border-success-hover',
    selected: 'ring-2 ring-info',
    text: 'text-success',
  },
} as const

export type NodeColorType = keyof typeof nodeColors
