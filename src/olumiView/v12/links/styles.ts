/**
 * V12 link styles (rule 2: links drawn exactly as the View holds them). One table, role -> how the line is drawn, so the canvas and the key
 * read the same source. Shapes are the Funding-Working board's own; colours are the design system's tokens.
 * DS rule (DESIGN_SYSTEM.md "Edge polarity tokens", canvas/edges/directionStroke.ts): an effect link's COLOUR is its direction
 * (--edge-positive increases, --edge-negative decreases, --edge-neutral not settled / none). A role (input to, size, measures, target) is
 * dash and line end only; it never overrides an effect's polarity colour. measures and target take the DS goal colour (--goal), no polarity.
 * `reason` and an unknown role are not here: they are drawn as before (`linkStyle` returns null).
 */
import { linkRole, type LinkRole } from '../contract'
import { getCanvasStrengthBand } from '../../../canvas/domain/vocabulary'
import { EDGE_STROKE_WIDTH_BANDS } from '../../../canvas/utils/graphDisplayCalculations'

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
/** Every line that is not a sized effect: 2 px (production's thinnest rung, Paul 16 Nov, R5). */
export const PLAIN_WIDTH = EDGE_STROKE_WIDTH_BANDS.slight
/**
 * Production's width ladder, 2 / 3 / 4 / 5 (canvas/utils/graphDisplayCalculations EDGE_STROKE_WIDTH_BANDS, keyed on its strength bands, canvas/domain/vocabulary),
 * for an effect the engine gives a `strength.share` (a unit-free share, 0 to 1; raw low/likely/high are in the link's own units, so never compared
 * across links, SCI-16). With no share the line is the thinnest rung: a size is not a certainty. Screen px: the line does not scale with the camera.
 */
export const effectWidth = (share: number | null | undefined): number =>
  typeof share === 'number' && Number.isFinite(share) ? EDGE_STROKE_WIDTH_BANDS[getCanvasStrengthBand(Math.abs(share)).id] : PLAIN_WIDTH
/** A driver link (what would change, the lens): the ladder's 4 px rung at least. */
export const DRIVER_WIDTH = EDGE_STROKE_WIDTH_BANDS.strong
/** Fixed notation words (UI chrome, not core's): a link whose direction core has not settled. */
export const DIRECTION_NOT_SETTLED = 'Direction not settled'
/** Fixed notation words (UI chrome, not core's): a link core types as having no effect, when core sent no words for it. */
export const DIRECTION_NONE = 'No effect'
/** The one dash: a doubted link. A reason link is never dashed for being one: it is dotted (olumiLook.css `.ok-link-dotted`), so a dash still means doubt only. */
export const DOUBT_DASH = '5 4'

export const LINK_STYLES: Readonly<Record<StyledRole, LinkStyle>> = {
  effect: { stroke: EDGE_NEUTRAL, dash: null, end: 'arrow', label: null, width: PLAIN_WIDTH },
  input: { stroke: INPUT_GREY, dash: null, end: 'dot', label: null, width: PLAIN_WIDTH },
  measures: { stroke: GOLD, dash: null, end: 'none', label: null, width: PLAIN_WIDTH },
  target: { stroke: GOLD, dash: null, end: 'arrow', label: null, width: PLAIN_WIDTH },
  size: { stroke: INPUT_GREY, dash: null, end: 'none', label: 'size', width: PLAIN_WIDTH },
}

/** The style for a link's role; null for `reason`, an unknown role and no role (drawn as today). */
export const linkStyle = (link: object): (LinkStyle & { role: StyledRole }) | null => {
  const role = linkRole(link)
  return role === null || role === 'reason' ? null : { ...LINK_STYLES[role], role }
}

