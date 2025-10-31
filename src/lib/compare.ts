// src/lib/compare.ts
// Shallow diff of items with id; deterministic order. Returns arrays of ids.
export type IdObj = { id: string }
export function diff<T extends IdObj>(a: T[], b: T[]): { added: string[]; removed: string[]; changed: string[] } {
  const byId = (xs: T[]) => new Map(xs.map((x) => [x.id, x]))
  const ma = byId(a)
  const mb = byId(b)
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  for (const [id, va] of ma.entries()) {
    if (!mb.has(id)) removed.push(id)
    else {
      const vb = mb.get(id) as T
      if (JSON.stringify(va) !== JSON.stringify(vb)) changed.push(id)
    }
  }
  for (const [id] of mb.entries()) {
    if (!ma.has(id)) added.push(id)
  }
  const by = (xs: string[]) => xs.slice().sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
  return { changed: by(changed), added: by(added), removed: by(removed) }
}

/**
 * Compare Debug Utilities (PLoT V1 Phase 2+)
 *
 * Server returns debug.compare[option_id] → { p10, p50, p90, top3_edges[] } per option.
 * We derive client-side A/B deltas: delta = b - a
 */

import { parseDebugCompare } from '../adapters/plot/types'

export interface CompareDelta {
  p10: { a: number; b: number; delta: number }
  p50: { a: number; b: number; delta: number }
  p90: { a: number; b: number; delta: number }
  top3_edges: Array<{
    edge_id: string
    from: string
    to: string
    label?: string
    weight: number
  }>
}

/**
 * Derive A/B deltas from per-option debug.compare slices
 *
 * Server sends: debug.compare[option_id] → { p10, p50, p90, top3_edges }
 * We compute client-side deltas: delta = b - a
 *
 * @param compareMap - Raw debug.compare map from server (unknown type)
 * @param optionAId - ID of option A (e.g., "conservative")
 * @param optionBId - ID of option B (e.g., "optimistic")
 * @returns CompareDelta with deltas and top3_edges, or null if parsing fails
 */
export function deriveCompare(
  compareMap: unknown,
  optionAId: string,
  optionBId: string
): CompareDelta | null {
  // Parse and validate with Zod (fail-closed)
  const map = parseDebugCompare(compareMap)
  if (!map) {
    console.warn('[deriveCompare] Failed to parse debug.compare map')
    return null
  }

  const a = map[optionAId]
  const b = map[optionBId]

  if (!a || !b) {
    console.warn('[deriveCompare] Missing debug slice for options:', { optionAId, optionBId, available: Object.keys(map) })
    return null
  }

  return {
    p10: { a: a.p10, b: b.p10, delta: b.p10 - a.p10 },
    p50: { a: a.p50, b: b.p50, delta: b.p50 - a.p50 },
    p90: { a: a.p90, b: b.p90, delta: b.p90 - a.p90 },
    // Use option B's top3_edges (could extend to merge/union later)
    top3_edges: b.top3_edges
  }
}
