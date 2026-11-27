/**
 * V12 link styles (rule 2: links drawn exactly as the View holds them). One table, role -> how the line is drawn, so the canvas and the key
 * read the same source. Shapes are the Funding-Working board's own; colours are the design system's tokens.
 * DS rule (DESIGN_SYSTEM.md "Edge polarity tokens", canvas/edges/directionStroke.ts): an effect link's COLOUR is its direction
 * (--edge-positive increases, --edge-negative decreases, --edge-neutral not settled / none). A role (input to, size, measures, target) is
 * dash and line end only; it never overrides an effect's polarity colour. measures and target take the DS goal colour (--goal), no polarity.
 * `reason` and an unknown role are not here: they are drawn as before (`linkStyle` returns null).
 */
import { linkRole, type LinkRole } from '../contract'
import type { ViewLink } from '../../client'
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
/**
 * EVERY link is this one width, 2 px (production's thinnest rung; panel-visual L3). Core reserves `causal.strength.share` as null and the raw
 * low / likely / high are in each link's own units, so no width may imply a strength: the old 2 / 3 / 4 / 5 ladder and the driver minimum are gone.
 */
export const PLAIN_WIDTH = EDGE_STROKE_WIDTH_BANDS.slight
/**
 * The ink of a line is a TONE (a class on the link's `<g>`, olumiLook.css `.ok-link-tone-*`, which sets `--link-tone` from a token): the line, its end and its leader
 * all read that one property, so no component writes a colour. `TONE_TOKEN` is what each tone's class must declare (links.spec reads the stylesheet against it).
 */
export type Tone = 'positive' | 'negative' | 'neutral' | 'ink' | 'goal'
export const TONE_TOKEN: Readonly<Record<Tone, string>> = { positive: EFFECT_STROKES.increases, negative: EFFECT_STROKES.decreases, neutral: EDGE_NEUTRAL, ink: 'var(--text-header)', goal: GOLD }
export const toneOf = (stroke: string): Tone => (Object.keys(TONE_TOKEN) as Tone[]).find((t) => TONE_TOKEN[t] === stroke) ?? 'neutral'
/** Fixed notation words (UI chrome, not core's): a link whose direction core has not settled. */
export const DIRECTION_NOT_SETTLED = 'Direction not settled'
/** The one dash: a doubted link. A reason link is never dashed for being one: it is dotted (olumiLook.css `.ok-link-dotted`), so a dash still means doubt only. */
export const DOUBT_DASH = '5 4'

/** A challenged reason changes the line's ink. Other challenged links carry an alert halo. */
export const linkAlertStyle = ({ alert, kind }: Pick<ViewLink, 'alert' | 'kind'>): 'reason' | 'halo' | null =>
  !alert ? null : kind === 'reason' ? 'reason' : 'halo'

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

