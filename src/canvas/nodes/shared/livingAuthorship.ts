/**
 * ⭐ WHO ADDED THIS ITEM, ON A CORE SCENARIO (DL ruling 21 Oct 2026 on the Lenses provenance audit, gap (a)). Core's engine
 * graph stamps only a VALUE's source, never the item's, so a factor, option or risk Olumi itself added (the living model's
 * `source: 'olumi'`) carried no "Olumi's" mark on its card or its hover card. Both read the item's source by its id from
 * the saved graph (the one shared read, `savedGraph.ts`) and mark it as the legacy wire's `provenance: 'ai_inferred'` does.
 * ⛔ Display only. A card that already says who authored it keeps its own word; any other source adds nothing.
 */
import { useMemo } from 'react'

import { useSavedGraph } from './savedGraph'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v)
const ITEM_LISTS = ['aims', 'options', 'factors', 'risks'] as const

/** The living model's `source` for the item with this id, or null (no living model, no such item, or no source). */
export function livingSourceOf(graph: unknown, id: string): string | null {
  if (!isRec(graph) || !isRec(graph.living_model)) return null
  const lm = graph.living_model
  for (const list of ITEM_LISTS) {
    const item = Array.isArray(lm[list]) ? (lm[list] as unknown[]).find((x) => isRec(x) && x.id === id) : undefined
    if (isRec(item)) return typeof item.source === 'string' ? item.source : null
  }
  return null
}

/** The node's data as the provenance readers take it: Olumi's item says so, unless the node already names its author. */
export function withLivingAuthorship<T>(data: T, source: string | null): T {
  if (source !== 'olumi' || !isRec(data) || data.provenance !== undefined && data.provenance !== null) return data
  return { ...data, provenance: 'ai_inferred' }
}

export function useLivingAuthorship<T>(id: string, data: T): T {
  const graph = useSavedGraph()
  const source = graph === null ? null : livingSourceOf(graph, id)
  return useMemo(() => withLivingAuthorship(data, source), [data, source])
}
