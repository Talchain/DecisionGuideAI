// src/lib/graph.simplify.ts
export type Edge<T = unknown> = { id: string; from: string; to: string; weight: number } & T

/**
 * Compute simplify threshold T per PRD:
 * - default 0.3
 * - auto-raise to 0.4 when nodeCount > 12 or viewport ≤ 480 px
 */
export function computeSimplifyThreshold(opts: { nodeCount: number; width: number; defaultT?: number }): number {
  const base = typeof opts.defaultT === 'number' ? opts.defaultT : 0.3
  const raise = (opts.nodeCount > 12) || (opts.width <= 480)
  return raise ? 0.4 : base
}

export function simplifyEdges<T extends { weight: number }>(edges: T[], on: boolean, t: number): T[] {
  return on ? edges.filter((e) => e.weight >= t) : edges
}

export function srSummary(nHidden: number, t: number): string {
  return `Simplify on. ${nHidden} links hidden (threshold ${t.toFixed(1)}).`
}
