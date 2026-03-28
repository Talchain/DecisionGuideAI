/**
 * diversifyTriageItems — Deduplicates triage items by source factor so the
 * top 3 cards show items from different factors when possible.
 *
 * Severity override: if a same-source item's influence is > 2x the next
 * unique-source item's influence, it stays in top 3 (the signal is too
 * strong to demote).
 *
 * This is a display-ordering decision, not a semantic transform.
 */

import type { ImprovementItem } from '../hooks/usePreAnalysisData'

interface EdgeLike {
  id: string
  source: string
}

/**
 * Derive the "source factor" ID for dedup purposes.
 * - Node items: the node's own ID (from focus.id)
 * - Edge items: the edge's source node ID (looked up from the edges array)
 * - Fallback: item.key (treated as unique)
 */
function getSourceFactorId(item: ImprovementItem, edgeMap: Map<string, string>): string {
  if (!item.focus) return item.key
  if (item.focus.type === 'node') return item.focus.id
  // Edge item — resolve to source node
  return edgeMap.get(item.focus.id) ?? item.key
}

/**
 * Find the influence of the next item whose source factor hasn't been seen.
 * Returns 0 when no unique-source item exists ahead.
 */
function nextUniqueInfluence(
  items: ImprovementItem[],
  startIdx: number,
  seen: Set<string>,
  edgeMap: Map<string, string>,
  influenceMap?: Map<string, number>,
): number {
  for (let i = startIdx; i < items.length; i++) {
    const src = getSourceFactorId(items[i], edgeMap)
    if (!seen.has(src)) {
      return getInfluence(items[i], influenceMap) ?? 0
    }
  }
  return 0
}

function getInfluence(item: ImprovementItem, influenceMap?: Map<string, number>): number | undefined {
  if (!influenceMap || !item.focus) return undefined
  return influenceMap.get(item.focus.id)
}

export interface DiversifiedTriage {
  top3: ImprovementItem[]
  quickFix: ImprovementItem[]
}

/**
 * Diversify a priority-sorted list of improvement items so the top 3 cards
 * come from different source factors (unless the severity override kicks in).
 *
 * @param items - Priority-sorted (highest first) improvement items
 * @param edges - Canvas edges for resolving edge items to source nodes
 * @param influenceMap - Optional factor/edge influence map (0-1) for severity override
 */
export function diversifyTriageItems(
  items: ImprovementItem[],
  edges: EdgeLike[],
  influenceMap?: Map<string, number>,
): DiversifiedTriage {
  if (items.length === 0) return { top3: [], quickFix: [] }

  // Build edge→source lookup
  const edgeMap = new Map<string, string>()
  for (const e of edges) {
    edgeMap.set(e.id, e.source)
  }

  const top3: ImprovementItem[] = []
  const remaining: ImprovementItem[] = []
  const seen = new Set<string>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const src = getSourceFactorId(item, edgeMap)

    if (top3.length >= 3) {
      remaining.push(item)
      continue
    }

    if (!seen.has(src)) {
      // New source factor — always accept
      top3.push(item)
      seen.add(src)
    } else {
      // Same source factor — check severity override
      const itemInfluence = getInfluence(item, influenceMap) ?? 0
      const nextUnique = nextUniqueInfluence(items, i + 1, seen, edgeMap, influenceMap)
      if (itemInfluence > 2 * nextUnique && nextUnique > 0) {
        // Signal too strong to demote
        top3.push(item)
      } else {
        remaining.push(item)
      }
    }
  }

  return {
    top3,
    quickFix: remaining.slice(0, 3),
  }
}
