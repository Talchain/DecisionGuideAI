// src/lib/graph.simplify.ts
export type Edge<T = unknown> = { id: string; from: string; to: string; weight: number } & T

/**
 * Compute simplify threshold T per PRD:
 * - default 0.3
 * - auto-raise to 0.4 when nodeCount exceeds threshold or viewport ≤ 480 px
 * @param opts.nodeCount - Number of nodes in the graph
 * @param opts.width - Viewport width in pixels
 * @param opts.defaultT - Base threshold (default 0.3)
 * @param opts.maxNodes - Maximum nodes from engine limits (defaults to 200 if not provided)
 */
export function computeSimplifyThreshold(opts: { nodeCount: number; width: number; defaultT?: number; maxNodes?: number }): number {
  const base = typeof opts.defaultT === 'number' ? opts.defaultT : 0.3
  const maxNodes = opts.maxNodes || 200
  // Raise threshold when graph has > 50% of max nodes
  const complexityThreshold = Math.floor(maxNodes * 0.5)
  const raise = (opts.nodeCount > complexityThreshold) || (opts.width <= 480)
  return raise ? 0.4 : base
}

export function simplifyEdges<T extends { weight: number }>(edges: T[], on: boolean, t: number): T[] {
  return on ? edges.filter((e) => e.weight >= t) : edges
}

export function srSummary(nHidden: number, t: number): string {
  return `Simplify on. ${nHidden} links hidden (threshold ${t.toFixed(1)}).`
}
