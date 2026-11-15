/**
 * UI-BRIEF-20261115 section 3, the central move: every option with a worked-out result for the goal, on ONE shared true 0..100% rail, its
 * chance as a dot and core's saved range as a whisker, so how far the options overlap (and how fragile their order is) reads at a glance.
 * Read ONLY from the View: the dot is the chance row core serves for the headline's own aim (`rows[kind=chance].chance`), the whisker is core's
 * `headline.range` sentence (rangeBandOf), the words beside it are core's `headline.text`. A result core calls fixed ("never met in this
 * model") is on the rail at its served row value, with no whisker. Options with no result yet are NOT on the rail (an empty rail reads as
 * zero; they are unworked, not losing): one group, under core's own words for them when core words them all alike.
 */
import type { ViewCard, ViewModel } from './client'
import { rangeBandOf, type RangeBand } from './resultRange'

/** Core's challenge mark for an option: the key's own glyph and word for a challenge (`model.key`, by its id), titled with the badge's words. */
export type RailChallenge = { readonly glyph: string; readonly word: string; readonly title: string; readonly badge: NonNullable<ViewCard['badge']> }
export type RailRow = { readonly id: string; readonly name: string; readonly text: string; readonly title: string; readonly range: string | null; readonly at: number; readonly band: RangeBand | null; readonly challenge: RailChallenge | null }
export type RailRest = { readonly id: string; readonly name: string; readonly text: string; readonly title: string; readonly challenge: RailChallenge | null }
export type ChanceRailT = { readonly rows: readonly RailRow[]; readonly rest: readonly RailRest[]; readonly caption: string | null }

/** Only where the saved badge names a challenge (Olumi's disconfirming claims are the product), and only core's glyph for it: the badge's
 *  counts are not drawn on the rail (DL, 15 Nov: they ran into the option names). Null where core's key carries no challenge mark. */
export const challengeOf = (model: ViewModel, card: ViewCard): RailChallenge | null => {
  const b = card.badge as (ViewCard['badge'] & { readonly words?: string }) | null | undefined
  const k = (model.key ?? []).find((x) => x.id === 'challenge')
  if (b == null || k === undefined || k.glyph === '' || !/challenge/i.test(b.words ?? b.text ?? '')) return null
  return { glyph: k.glyph, word: k.text, title: b.title !== '' ? b.title : (b.words ?? b.text), badge: b }
}

/** The served row value for the headline's own aim, a fraction 0..1, for a chance or a fixed result; else null. */
const rowAt = (card: ViewCard): number | null => {
  const h = card.headline
  if (h == null || (h.state !== 'chance' && h.state !== 'fixed')) return null
  const row = card.rows.find((r) => r.kind === 'chance' && r.aim_id === h.aim_id) as { chance?: number | null } | undefined
  return typeof row?.chance === 'number' && row.chance >= 0 && row.chance <= 1 ? row.chance : null
}

export function chanceRailOf(model: ViewModel | null): ChanceRailT | null {
  if (model === null) return null
  const rows: RailRow[] = [], rest: RailRest[] = []
  for (const c of model.cards) {
    if (c.family !== 'option' || c.headline == null) continue
    const h = c.headline, at = rowAt(c)
    if (at !== null) rows.push({ id: c.id, name: c.heading, text: h.text, title: h.title, range: h.range ?? null, at, band: h.state === 'chance' ? rangeBandOf(h.range) : null, challenge: challengeOf(model, c) })
    else rest.push({ id: c.id, name: c.heading, text: h.text, title: h.title, challenge: challengeOf(model, c) })
  }
  if (rows.length === 0 && rest.length === 0) return null
  // In the View's own order (the pairing gate: the UI never reorders View values; an order by chance would be core's to serve).
  const words = new Set(rest.map((r) => r.text))
  const caption = rest.length > 0 && words.size === 1 && rest[0]!.text !== '' ? rest[0]!.text : null
  return { rows, rest, caption }
}
