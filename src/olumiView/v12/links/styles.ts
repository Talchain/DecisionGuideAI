/**
 * V12 link styles (rule 2: links drawn exactly as the View holds them). One table, role -> how the line is drawn, so the canvas and the key
 * read the same source. Shapes are the Funding-Working board's own; colours are the design system's tokens.
 * DS rule (DESIGN_SYSTEM.md "Edge polarity tokens", canvas/edges/directionStroke.ts): an effect link's COLOUR is its direction
 * (--edge-positive increases, --edge-negative decreases, --edge-neutral not settled / none). A role (input to, size, measures, target) is
 * dash and line end only; it never overrides an effect's polarity colour. measures and target take the DS goal colour (--goal), no polarity.
 * `reason` and an unknown role are not here: they are drawn as before (`linkStyle` returns null).
 */
import { linkRole, type LinkRole } from '../contract'

export type LineEnd = 'arrow' | 'dot' | 'none'
export interface LinkStyle { stroke: string; dash: string | null; end: LineEnd; label: string | null; width: number }
export type StyledRole = Exclude<LinkRole, 'reason'>

export const INK = 'var(--text-body, #3F3F3E)'
/** The DS "no verdict" edge colour: a direction not settled or not stated, and the dotted role lines (input to, size). */
export const EDGE_NEUTRAL = 'var(--edge-neutral)'
export const INPUT_GREY = EDGE_NEUTRAL
/** The DS goal colour (brand.css --goal, #F5C433), the colour of the aim's diamond. Not the near-miss golds. */
export const GOLD = 'var(--goal)'
/** An effect link's colour by its direction. The canvas is a light board (StyledEdge pins isDark false), so the dark tokens are named for the day it is not. */
export const EFFECT_STROKES = { increases: 'var(--edge-positive)', decreases: 'var(--edge-negative)', neutral: EDGE_NEUTRAL } as const
export const EFFECT_STROKES_DARK = { increases: 'var(--edge-positive-dark)', decreases: 'var(--edge-negative-dark)', neutral: 'var(--edge-neutral-dark)' } as const
export const effectStroke = (sign: string | null | undefined, isDark = false): string => {
  const t = isDark ? EFFECT_STROKES_DARK : EFFECT_STROKES
  return sign === 'increases' ? t.increases : sign === 'decreases' ? t.decreases : t.neutral
}
export const EFFECT_WIDTH_MIN = 1.5
export const EFFECT_WIDTH_MAX = 3
/**
 * Strength is thickness where the View gives one that can be compared: `strength.share` (a unit-free share, 0 to 1). Raw low/likely/high are
 * in the link's own units, so they are never compared across links (SCI-16); with no share the line is the default width.
 */
export const effectWidth = (share: number | null | undefined): number =>
  typeof share === 'number' && Number.isFinite(share) ? EFFECT_WIDTH_MIN + (EFFECT_WIDTH_MAX - EFFECT_WIDTH_MIN) * Math.min(1, Math.abs(share)) : EFFECT_WIDTH_MIN
/** Fixed notation words (UI chrome, not core's): a link whose direction core has not settled. */
export const DIRECTION_NOT_SETTLED = 'Direction not settled'
export const DOUBT_DASH = '5 4'

export const LINK_STYLES: Readonly<Record<StyledRole, LinkStyle>> = {
  effect: { stroke: EDGE_NEUTRAL, dash: null, end: 'arrow', label: null, width: 1.5 },
  input: { stroke: INPUT_GREY, dash: '1 4', end: 'dot', label: null, width: 1.5 },
  measures: { stroke: GOLD, dash: null, end: 'none', label: null, width: 2 },
  target: { stroke: GOLD, dash: null, end: 'arrow', label: null, width: 2 },
  size: { stroke: INPUT_GREY, dash: '1 4', end: 'none', label: 'size', width: 1.5 },
}

/** The style for a link's role; null for `reason`, an unknown role and no role (drawn as today). */
export const linkStyle = (link: object): (LinkStyle & { role: StyledRole }) | null => {
  const role = linkRole(link)
  return role === null || role === 'reason' ? null : { ...LINK_STYLES[role], role }
}

/** A modelled effect's dash: only where core doubts the link. */
export const effectDash = (doubt: boolean): string | null => (doubt ? DOUBT_DASH : null)
