/**
 * The V12 contract (16 Nov): View fields core adds for the V12 design boards. Every accessor returns null (or false, or []) when core does
 * not send the field, so the page draws nothing it was not told: never a link role, a baseline, a range or a reason of its own.
 * Core side: the same names, on `model.links[]` and `model.cards[]` (wip/v12-core-claude).
 */

/** What a link is, as core holds it: a modelled effect, an input to a calculation, the size of an effect, how an outcome measures an aim,
 *  the bound an aim is held to, or a reason card's link. */
export type LinkRole = 'effect' | 'input' | 'size' | 'measures' | 'target' | 'reason'
const ROLES: ReadonlySet<string> = new Set<LinkRole>(['effect', 'input', 'size', 'measures', 'target', 'reason'])

export const linkRole = (link: object): LinkRole | null => {
  const r = (link as { role?: unknown }).role
  return typeof r === 'string' && ROLES.has(r) ? (r as LinkRole) : null
}

/** For a `size` link: the effect link whose size it is (its two ends), so the wire attaches to that link, never to a card as a cause. */
export const sizedLink = (link: object): { from: string; to: string } | null => {
  const s = (link as { sizes?: unknown }).sizes as { from?: unknown; to?: unknown } | null | undefined
  return s != null && typeof s.from === 'string' && typeof s.to === 'string' ? { from: s.from, to: s.to } : null
}

/** The option the person already has (carrying on as now), as core marks it. */
export const isBaseline = (card: object): boolean => (card as { baseline?: unknown }).baseline === true

/** A sized figure's range in numbers, on its own unit: the low and high ends and the most likely value where one is given. */
export interface FigureRange { low: number; likely: number | null; high: number; unit: string }
export const figureRange = (card: object): FigureRange | null => {
  const r = ((card as { figure?: { range?: unknown } | null }).figure?.range ?? null) as Partial<Record<keyof FigureRange, unknown>> | null
  if (r === null || typeof r !== 'object') return null
  const { low, likely, high, unit } = r
  if (typeof low !== 'number' || typeof high !== 'number' || typeof unit !== 'string' || !Number.isFinite(low) || !Number.isFinite(high)) return null
  return { low, high, unit, likely: typeof likely === 'number' && Number.isFinite(likely) ? likely : null }
}

/** On a calculated card, the options core could not calculate, each with core's own reason (for example "170 runs gave a time below zero"). */
export interface WithheldValue { option: string; text: string }
export const withheldValues = (card: object): WithheldValue[] => {
  const vs = (card as { values?: unknown }).values
  if (!Array.isArray(vs)) return []
  return vs.flatMap((v: { option?: unknown; text?: unknown; withheld?: unknown }) =>
    v?.withheld === true && typeof v.option === 'string' && typeof v.text === 'string' ? [{ option: v.option, text: v.text }] : [])
}
