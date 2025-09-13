// Explain Score Δ helpers (UI-only)
// Produces a deterministic list of top contributors to scenario score delta.
// Stable sort by |delta| desc, then title, then id. Values are clamped to [-100, 100].

import type { Graph } from '@/domain/graph'
import type { ScoreResult } from '@/domain/kr'

export type Contributor = {
  id: string
  title: string
  own: number
  fromChildren: number
  total: number
  delta: number
  reasons: string[]
}

const clamp = (x: number): number => {
  if (!Number.isFinite(x)) return 0
  return Math.max(-100, Math.min(100, x))
}

const byStable = (a: Contributor, b: Contributor) => {
  const ad = Math.abs(a.delta)
  const bd = Math.abs(b.delta)
  if (ad !== bd) return bd - ad
  if (a.title !== b.title) return a.title.localeCompare(b.title)
  return a.id.localeCompare(b.id)
}

export function topContributors(
  before: ScoreResult,
  after: ScoreResult,
  graph: Graph,
): Contributor[] {
  const ids = Object.keys(graph.nodes)
  const list: Contributor[] = []
  for (const id of ids) {
    const node = graph.nodes[id]
    const title = node?.title || id
    const b = before.explain?.[id] || { own: 0, fromChildren: 0 }
    const a = after.explain?.[id] || { own: 0, fromChildren: 0 }
    const own = clamp(a.own)
    const fromChildren = clamp(a.fromChildren)
    const total = clamp(own + fromChildren)
    const bTotal = clamp((b.own ?? 0) + (b.fromChildren ?? 0))
    const delta = clamp(total - bTotal)
    // Reasons: short & deterministic
    const reasons: string[] = []
    if (Math.abs((a.own ?? 0) - (b.own ?? 0)) >= 0.5) reasons.push('Own KR changed')
    if (Math.abs((a.fromChildren ?? 0) - (b.fromChildren ?? 0)) >= 0.5) reasons.push('Propagation changed')
    list.push({ id, title, own, fromChildren, total, delta, reasons })
  }
  list.sort(byStable)
  return list
}
