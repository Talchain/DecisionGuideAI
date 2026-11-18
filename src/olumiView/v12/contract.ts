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

/** On a calculated card, the options core could not calculate, each with core's own reason (for example "170 samples gave a time below zero"):
 *  core's `values_withheld`, its own field, never among the bands in `values` (so no reader of `values` can take a position from one). */
export interface WithheldValue { option: string; text: string }
export const withheldValues = (card: object): WithheldValue[] => {
  const vs = (card as { values_withheld?: unknown }).values_withheld
  if (!Array.isArray(vs)) return []
  return vs.flatMap((v: { option?: unknown; text?: unknown }) =>
    typeof v?.option === 'string' && typeof v.text === 'string' ? [{ option: v.option, text: v.text }] : [])
}

/**
 * An option whose headline is withheld for want of a goal-type aim (`headline.state` none with no `aim_id`) but which has a worked-out result
 * on a limit (a `limit` row with a value): core's "No chance can be worked out…" is then about an aim the model does not have, so the card
 * leads with the limit's result and does not also show that line (DL, 16 Nov). Returns that first limit row, or null.
 */
export const limitLeadOf = (card: { headline?: { state?: string; aim_id?: string | null } | null; rows: ReadonlyArray<object> }): { aim_id: string; value: string; title: string } | null => {
  const h = card.headline
  if (h == null || h.state !== 'none' || h.aim_id != null) return null
  const r = (card.rows as Array<{ kind?: string; aim_id?: string | null; value?: string | null; title?: string }>)
    .find((x) => x.kind === 'limit' && typeof x.aim_id === 'string' && typeof x.value === 'string' && x.value !== '')
  return r === undefined ? null : { aim_id: r.aim_id!, value: r.value!, title: r.title ?? '' }
}

/**
 * Core's mark that the model's results were worked out by an earlier engine and are shown as saved (`model.run.earlier`, olumi.view/3 and /2, DL and
 * Codex 17 Nov). Absent when the running engine made them (every fresh draft and change). Read additively until the generated View type carries it.
 * Its words are core's, drawn verbatim; null when absent or empty.
 */
export type EarlierResults = { readonly text: string; readonly title: string }
export const earlierResultsOf = (model: { run?: object | null } | null | undefined): EarlierResults | null => {
  const e = (model?.run as { earlier?: { text?: unknown; title?: unknown } | null } | null | undefined)?.earlier
  return e != null && typeof e.text === 'string' && e.text !== '' ? { text: e.text, title: typeof e.title === 'string' && e.title !== '' ? e.title : e.text } : null
}

/**
 * Core's one finding line (`model.run.finding`, 18 Nov): which option the current model says is most likely to meet the aim, how likely, what it moves
 * most with. `text` is core's one sentence (where no chance exists, core's one-line "what a result needs"), `title` its long form, `figure` the card id
 * it moves most with, `needs` a second, quieter line. Optional and newer than the generated View type, so read through this accessor; null when absent
 * or empty (nothing is composed in its place).
 */
export type RunFinding = { readonly text: string; readonly title: string; readonly figure: string | null; readonly needs: string | null }
export const findingOf = (model: { run?: object | null } | null | undefined): RunFinding | null => {
  const f = (model?.run as { finding?: { text?: unknown; title?: unknown; figure?: unknown; needs?: unknown } | null } | null | undefined)?.finding
  if (f == null || typeof f.text !== 'string' || f.text === '') return null
  const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null)
  return { text: f.text, title: str(f.title) ?? f.text, figure: str(f.figure), needs: str(f.needs) }
}
/**
 * Whether the model has ANY calculated result on an option (an option card whose headline is a chance or a fixed result, by core's own
 * `headline.state`). Where it has none, `run.finding` is the model's status ("cannot be worked out yet", an aim kept in words), which the reply's
 * lead already says to the person: the panel does not say it a second time above the conversation (Codex ROOT 15:37Z and 15:43Z, 18 Nov). It
 * stays on the question card and on Analysis. A finding with at least one result (a most likely option, no clear leader, an incomplete
 * comparison) is evidence and is always drawn. Read by field, never from the finding's words.
 */
export const hasAnyResult = (model: { cards?: readonly { family?: string; headline?: { state?: string } | null }[] } | null | undefined): boolean =>
  (model?.cards ?? []).some((c) => c.family === 'option' && (c.headline?.state === 'chance' || c.headline?.state === 'fixed'))
