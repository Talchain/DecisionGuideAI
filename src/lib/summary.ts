// src/lib/summary.ts
import type { Edge } from './graph.sample'

export type SummaryBands = {
  conservative: number
  likely: number
  optimistic: number
}

// Deterministic banding based on edge weight
export function bandEdgesByWeight(edges: Edge[]): SummaryBands {
  let conservative = 0
  let likely = 0
  let optimistic = 0
  for (const e of edges) {
    if (e.weight <= 0.2) conservative++
    else if (e.weight <= 0.5) likely++
    else optimistic++
  }
  return { conservative, likely, optimistic }
}
