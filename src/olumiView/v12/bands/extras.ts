/** What Simple draws beside the model's cards (rule 6 and rule 7): the kept ideas, and the folded inputs' group. Pure: the View in, the nodes out. */
import type { View, ViewModel } from '../../client'
import { FOLD_ID, IDEA_PREFIX, inputIdsOf } from './bands'
import { FOLD_H, IDEA_H, VIEW_FOLD, VIEW_IDEA } from './BandNodes'
import { keptIdeasOf } from './keptIdeas'

export type BandExtra = { id: string; band: 'inputs' | 'ideas'; h: number; type: string; data: Record<string, unknown> }

/** `foldedModel`: the full drawn model while its inputs are folded (their group is drawn in their place), else null. */
export function extrasOf(view: View | null, sid: string | null, foldedModel: ViewModel | null): BandExtra[] {
  const fold: BandExtra[] = foldedModel === null ? [] : [{ id: FOLD_ID, band: 'inputs', h: FOLD_H, type: VIEW_FOLD, data: { count: inputIdsOf(foldedModel).length, sid } }]
  return [...fold, ...keptIdeasOf(view).map((idea): BandExtra => ({ id: IDEA_PREFIX + idea.id, band: 'ideas', h: IDEA_H, type: VIEW_IDEA, data: { idea } }))]
}
