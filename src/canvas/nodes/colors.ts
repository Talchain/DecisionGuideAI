/**
 * Node type colors using Olumi Two-Shade System v2.0
 *
 * Each node type maps to semantic colors:
 * - Background: {color}-light (light shade)
 * - Border/Text: {color} (main shade)
 * - Frame: the card's resting 1px frame (contract v3.1 — see below)
 * - Hover: {color}-hover (derived state)
 * - Selected: ONE neutral lift on every family, never a blue ring (Paul, 1 Oct — see below)
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
 * ⭐ `selected` IS ONE TOKEN ON EVERY FAMILY, AND IT IS NOT BLUE (Paul, 1 Oct 2026: "We need to remove all of the
 * blue highlighted borders when anything is clicked on. That needs to be stripped completely from the PoC.").
 * - **Before:** contract v3.1 FRAME-09 drew selection as a 2px info ring (`ring-2 ring-info`). Earlier still, it was
 *   a 4px ring in each node's own hue, so clicking a risk card gave it a Danger halo.
 * - **Now:** a selected card lifts on the neutral `shadow-2` elevation, with no border and no ring, so it still
 *   reads as the one picked out. It is still ONE token on every family.
 * - The AI states (highlight / attended) keep their own rings in `BaseNode`: the AI sets those, not a click.
 */

/** The one selection treatment for every card family: a neutral lift, never a blue ring (Paul, 1 Oct 2026). */
export const NODE_SELECTED_CLASSES = 'shadow-2'

export const nodeColors = {
  goal: {
    bg: 'bg-goal-light',
    border: 'border-goal',
    frame: 'border-[color:color-mix(in_srgb,var(--goal)_76%,var(--border-default))]',
    hover: 'hover:border-goal-hover',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-goal',
  },
  decision: {
    bg: 'bg-info-light',
    border: 'border-info',
    frame: 'border-[color:color-mix(in_srgb,var(--info)_76%,var(--border-default))]',
    hover: 'hover:border-info-hover',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-info',
  },
  option: {
    bg: 'bg-option-light',
    border: 'border-option',
    frame: 'border-[color:color-mix(in_srgb,var(--option)_76%,var(--border-default))]',
    hover: 'hover:border-option/80',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-option',
  },
  outcome: {
    bg: 'bg-success-light',
    border: 'border-success',
    frame: 'border-[color:color-mix(in_srgb,var(--success)_76%,var(--border-default))]',
    hover: 'hover:border-success-hover',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-success',
  },
  factor: {
    bg: 'bg-factor-light',
    border: 'border-factor',
    frame: 'border-[color:color-mix(in_srgb,var(--factor)_76%,var(--border-default))]',
    hover: 'hover:border-factor/80',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-factor',
  },
  risk: {
    bg: 'bg-danger-light',
    border: 'border-danger',
    frame: 'border-[color:color-mix(in_srgb,var(--danger)_76%,var(--border-default))]',
    hover: 'hover:border-danger-hover',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-danger',
  },
  action: {
    bg: 'bg-success-light',
    border: 'border-success',
    frame: 'border-[color:color-mix(in_srgb,var(--success)_76%,var(--border-default))]',
    hover: 'hover:border-success-hover',
    selected: NODE_SELECTED_CLASSES,
    text: 'text-success',
  },
} as const

export type NodeColorType = keyof typeof nodeColors
