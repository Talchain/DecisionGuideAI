/**
 * V12 link styles (rule 2: links drawn exactly as the View holds them). One table, role -> how the line is drawn, so the canvas and the key
 * read the same source. Shapes are the Funding-Working board's own; colours are the design system's tokens (body ink, light text, the aim's gold).
 * `reason` and an unknown role are not here: they are drawn as before (`linkStyle` returns null).
 */
import { linkRole, type LinkRole } from '../contract'

export type LineEnd = 'arrow' | 'dot' | 'none'
export interface LinkStyle { stroke: string; dash: string | null; end: LineEnd; label: string | null; width: number }
export type StyledRole = Exclude<LinkRole, 'reason'>

export const INK = 'var(--text-body, #3F3F3E)'
export const INPUT_GREY = 'var(--text-light, #908D8D)'
export const GOLD = 'var(--o-goal, #D9A400)'
/** Fixed notation words (UI chrome, not core's): a link whose direction core has not settled. */
export const DIRECTION_NOT_SETTLED = 'Direction not settled'
export const DOUBT_DASH = '5 4'

export const LINK_STYLES: Readonly<Record<StyledRole, LinkStyle>> = {
  effect: { stroke: INK, dash: null, end: 'arrow', label: null, width: 1.5 },
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
