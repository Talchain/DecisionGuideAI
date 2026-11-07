/**
 * Strategy lane, slice 1 (7 Nov 2026): READS core's optional olumi.view/3 `strategy` key (olumi-core wip/strategy, src/view/strategy.ts):
 * the qualitative start state (items), each person's qualitative views on a card with core's pill ("Observed, two rollouts"), one mark per
 * card the revealed views speak to (the reveal's own kind values, core's sentence), the definitional gate in words, and the overview as a
 * projection. This file composes no words and formats no value; a View without the key draws nothing of it.
 */
import type { View } from '../client'
import { marksOn, revealOf } from '../reveal'

export type Strategy = NonNullable<View['strategy']>
export type StrategyMark = Strategy['marks'][number]
export type StrategyView = Strategy['views'][number]
export type StrategyItem = Strategy['items'][number]

/** Core's `strategy`, or null when the View does not carry it (a scenario with no item and no qualitative view, or an older core). */
export function strategyOf(view: View | null): Strategy | null {
  const s = (view as { strategy?: unknown } | null)?.strategy
  return s !== null && typeof s === 'object' && Array.isArray((s as { marks?: unknown }).marks) ? (s as Strategy) : null
}

/**
 * Core's strategy mark for a card, unless the reveal already marks that card (`collab.marks`, drawn by RevealMarks): one chip per card, never
 * two marker systems on one card. The reveal's mark wins because it is the round's own producer; this one covers words-only views.
 */
export function strategyMarkOn(view: View | null, card: string): StrategyMark | null {
  const s = strategyOf(view)
  if (s === null) return null
  if (marksOn(revealOf(view), card).chip !== null) return null
  return s.marks.find((m) => m.card === card) ?? null
}

/** The people a mark gathers, each with the view of theirs it points at (core's order), for the chip's initials. */
export function peopleOf(view: View | null, mark: StrategyMark): readonly { readonly view: number; readonly by: string }[] {
  const s = strategyOf(view)
  return mark.people.map((p) => ({ view: s?.views.find((x) => x.by_id === p.id && x.about.id === mark.card)?.view ?? mark.views[0] ?? 0, by: p.name }))
}

/** One person's qualitative views (their stance pills and words per card), from their revealed or own view `id`, in core's order. */
export function viewLinesOf(view: View | null, id: number): readonly StrategyView[] {
  return strategyOf(view)?.views.filter((x) => x.view === id) ?? []
}
