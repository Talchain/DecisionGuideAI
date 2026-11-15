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

export type RailRow = { readonly id: string; readonly name: string; readonly text: string; readonly title: string; readonly range: string | null; readonly at: number; readonly band: RangeBand | null; readonly badge: ViewCard['badge'] | null }
export type RailRest = { readonly id: string; readonly name: string; readonly text: string; readonly title: string; readonly badge: ViewCard['badge'] | null }
export type ChanceRailT = { readonly rows: readonly RailRow[]; readonly rest: readonly RailRest[]; readonly caption: string | null }

/** Core's badge, kept only where it names a challenge (Olumi's disconfirming claims are the product): its words, else its text. */
export const challengeBadgeOf = (card: ViewCard): ViewCard['badge'] | null => {
  const b = card.badge as (ViewCard['badge'] & { readonly words?: string }) | null | undefined
  return b != null && /challenge/i.test(b.words ?? b.text ?? '') ? b : null
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
  const options = model.cards.filter((c) => c.family === 'option' && c.headline != null)
  const rows: RailRow[] = [], rest: RailRest[] = []
  for (const c of options) {
    const h = c.headline!, at = rowAt(c)
    if (at !== null) rows.push({ id: c.id, name: c.heading, text: h.text, title: h.title, range: h.range ?? null, at, band: h.state === 'chance' ? rangeBandOf(h.range) : null, badge: challengeBadgeOf(c) })
    else rest.push({ id: c.id, name: c.heading, text: h.text, title: h.title, badge: challengeBadgeOf(c) })
  }
  if (rows.length === 0 && rest.length === 0) return null
  // Highest saved chance first; equal chances keep core's order.
  rows.sort((a, b) => b.at - a.at)
  const words = new Set(rest.map((r) => r.text))
  const caption = rest.length > 0 && words.size === 1 && rest[0]!.text !== '' ? rest[0]!.text : null
  return { rows, rest, caption }
}
