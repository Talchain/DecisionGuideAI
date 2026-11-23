/** What Simple draws beside the model's cards (rules 6 and 7, D1): the kept ideas, the folded inputs' group and each row's group card. Pure: the View in, the nodes out. */
import type { View, ViewModel } from '../../client'
import { drawKindOf } from '../../layout'
import { isDashedCardKind } from '../cards/kind'
import { FOLD_ID, IDEA_PREFIX, inputIdsOf, type BandId } from './bands'
import { FOLD_H, IDEA_H, VIEW_FOLD, VIEW_IDEA } from './BandNodes'
import { challengedIn, type CardGroup } from './groups'
import { keptIdeasOf } from './keptIdeas'

export type BandExtra = { id: string; band: BandId; h: number; type: string; data: Record<string, unknown> }

/** `foldedModel`: the drawn model while its inputs are folded (their group is drawn in their place), else null. `groups`: the rows' group cards still closed. */
export function extrasOf(view: View | null, sid: string | null, foldedModel: ViewModel | null, groups: readonly CardGroup[] = []): BandExtra[] {
  const fold: BandExtra[] = foldedModel === null ? [] : [{ id: FOLD_ID, band: 'inputs', h: FOLD_H, type: VIEW_FOLD, data: { count: inputIdsOf(foldedModel).length, sid } }]
  // A group whose row is folded by rule 7 is inside that fold, not beside it.
  const shown = foldedModel === null ? groups : groups.filter((g) => g.band !== 'inputs')
  const cards = new Map((view?.model?.cards ?? []).map((c) => [c.id, c]))
  // Olumi's own words for its proposal of these cards: the proposal's mark on their change (`proposal.changes[].olumi.title`), verbatim; null where core sends none.
  const olumiWords = (ids: readonly string[]): string | null => view?.proposal?.changes.find((ch) => ids.includes(ch.id) && ch.olumi != null)?.olumi?.title ?? null
  const marksOf = (ids: readonly string[]) => [...new Map(ids.flatMap((id) => {
    const card = cards.get(id)
    if (card === undefined) return []
    const kind = drawKindOf(card, view?.model ?? null), dashed = isDashedCardKind(card)
    return [[`${kind}:${dashed}`, { kind, dashed }] as const]
  })).values()]
  const grouped = shown.map((g): BandExtra => ({ id: g.id, band: g.band, h: FOLD_H, type: VIEW_FOLD, data: { count: g.cards.length, sid, group: {
    id: g.id, kind: g.kind, kinds: g.kinds, marks: marksOf(g.cards), words: g.kind === 'proposed' ? olumiWords(g.cards) : null, hover: g.cards.map((id) => cards.get(id)?.heading ?? '').filter((x) => x !== '').join('\n'),
    challenged: view?.model == null ? 0 : challengedIn(view.model, g),
  } } }))
  return [...fold, ...grouped, ...keptIdeasOf(view).map((idea): BandExtra => ({ id: IDEA_PREFIX + idea.id, band: 'ideas', h: IDEA_H, type: VIEW_IDEA, data: { idea } }))]
}
