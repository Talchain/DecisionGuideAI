/**
 * A card's premises (olumi.view/3 `cards[].premises[]`: what it rests on, the assumptions, prerequisites and challenges noted on it), in
 * the crafted Insights disclosure's groups (legacy `FactorInsights.tsx`: one heading per kind). The heading is core's own key entry for the
 * premise's glyph (`model.key[]`, e.g. ◇ "assumption"), so the UI names no kind itself; a glyph core's key does not hold is grouped under
 * no heading. Groups keep the order of their first premise; each premise keeps its place in `premises` (its View path).
 */
import type { ViewCard, ViewModel } from '../client'

export type PremiseGroup = {
  key: ViewModel['key'][number] | null
  items: { premise: ViewCard['premises'][number]; i: number }[]
}

export function premiseGroupsOf(card: ViewCard, key: ViewModel['key']): PremiseGroup[] {
  const groups = new Map<string, PremiseGroup>()
  card.premises.forEach((premise, i) => {
    const entry = key.find((k) => k.glyph === premise.glyph) ?? null
    const at = entry?.id ?? `glyph:${premise.glyph}`
    const g = groups.get(at) ?? { key: entry, items: [] }
    g.items.push({ premise, i })
    groups.set(at, g)
  })
  return [...groups.values()]
}

/** The marks the tab draws for who authored a figure (core's ◆ and ◐, `cards[].olumi`, `bound.olumi`, `rows[].olumi`), as core's key
 *  names them, in the key's order; only those a card in `cards` carries, so the key never explains a mark that is not on screen. */
export function authorKeyOf(model: ViewModel, cards: readonly ViewCard[]): ViewModel['key'] {
  const drawn = new Set<string>()
  for (const c of cards) {
    if (c.olumi !== null) drawn.add(c.olumi.glyph)
    if (c.bound?.olumi) drawn.add(c.bound.olumi.glyph)
    for (const r of c.rows) if (r.kind !== 'none' && r.olumi !== null) drawn.add(r.olumi.glyph)
  }
  return model.key.filter((k) => (k.id === 'olumi' || k.id === 'partly_olumi') && drawn.has(k.glyph))
}
