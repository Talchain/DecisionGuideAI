/**
 * ⭐ OLUMI'S SUGGESTED MEASURE, SAID AS OLUMI'S (CEE #3585, buddy AMEND; DL 21 Oct). For a vague aim, core's drafter may
 * suggest what to measure it by (`living_model.aims[].target` with `source: 'olumi'`), with every figure null: no target
 * figure is ever invented. The engine graph carries no threshold for it, so the goal card had nothing to show and the
 * person never saw the suggestion. This reader returns the quantity and unit of the aim the card IS (the drawn goal
 * carries its aim's id), only when Olumi suggested it.
 * ⛔ Display only: it creates no threshold, sends nothing and edits nothing; setting a figure stays the existing route,
 * and a figure the person sets makes the measure theirs (CEE).
 */
import { useMemo } from 'react'

import { useSavedGraph } from './savedGraph'

export const SUGGESTED_MEASURE_LABEL = 'Olumi’s suggested measure'

export interface SuggestedMeasure {
  readonly quantity: string
  /** The unit, when it says something the quantity does not ("units" of "units" is said once). */
  readonly unit: string | null
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

export function suggestedMeasureOf(graph: unknown, goalId: string): SuggestedMeasure | null {
  if (!isRec(graph) || !isRec(graph.living_model) || !Array.isArray(graph.living_model.aims)) return null
  const aim = graph.living_model.aims.find((a): a is Rec => isRec(a) && a.id === goalId)
  const target = aim !== undefined && isRec(aim.target) ? aim.target : null
  if (target === null || target.source !== 'olumi') return null
  const quantity = str(target.quantity)
  if (quantity === null) return null
  const unit = str(target.unit)
  return { quantity, unit: unit !== null && unit.toLowerCase() !== quantity.toLowerCase() ? unit : null }
}

export const suggestedMeasureWords = (m: SuggestedMeasure): string =>
  `${SUGGESTED_MEASURE_LABEL}: ${m.quantity}${m.unit !== null ? ` (${m.unit})` : ''}`

/** The suggested measure for this goal card, from the saved graph on screen now (one shared read, `savedGraph.ts`). */
export function useSuggestedMeasure(goalId: string): SuggestedMeasure | null {
  const graph = useSavedGraph()
  return useMemo(() => (graph === null ? null : suggestedMeasureOf(graph, goalId)), [graph, goalId])
}
