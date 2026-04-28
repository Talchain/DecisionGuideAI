/**
 * Shared edge utilities — canonical edge identity and structural edge detection.
 *
 * Hard rule 4: single shared utility for edge_key and structural-edge detection.
 * All ad-hoc edge identity or structural checks must use these functions.
 */

import type { Edge } from '@xyflow/react'
import type { EdgeData } from './edges'

/**
 * Canonical directional edge key for deduplication and lookup.
 * Format: "source->target"
 */
export function getEdgeKey(edge: { source: string; target: string }): string {
  return `${edge.source}->${edge.target}`
}

/**
 * Determine whether an edge is structural (decision->option).
 *
 * Structural edges are organisational — they connect a decision to its options
 * and are not causal relationships. They get a reduced context menu (no weight
 * editing, no challenge, no mark-as-assumption).
 *
 * Detection conditions (either triggers true):
 * (a) Source node kind is 'decision' AND target node kind is 'option'
 * (b) Canonical strength signature: mean === 1.0, std === 0.01, exists_probability === 1.0
 */
export function isStructuralEdge(
  edge: Edge<EdgeData>,
  getNodeKind: (nodeId: string) => string | undefined,
): boolean {
  // Condition (a): decision -> option by node kinds
  const sourceKind = getNodeKind(edge.source)
  const targetKind = getNodeKind(edge.target)
  if (sourceKind === 'decision' && targetKind === 'option') return true

  // Condition (b): canonical strength signature
  const d = edge.data
  if (d) {
    const weight = typeof d.weight === 'number' ? d.weight : undefined
    const std = typeof d.strengthStd === 'number' ? d.strengthStd : undefined
    const existsProb =
      typeof d.beliefExists === 'number'
        ? d.beliefExists
        : typeof d.confidence === 'number'
          ? d.confidence
          : undefined
    if (weight === 1.0 && std === 0.01 && existsProb === 1.0) return true
  }

  return false
}

/**
 * Find all edges connected to a set of node IDs.
 * Returns edges where source OR target is in the set.
 */
export function findConnectedEdges(
  nodeIds: Set<string>,
  edges: Edge<EdgeData>[],
): Edge<EdgeData>[] {
  return edges.filter((e) => nodeIds.has(e.source) || nodeIds.has(e.target))
}

/**
 * Causal edges = all edges minus those connecting decision/option nodes
 * (which are organisational wiring, not causal claims).
 *
 * Used by ModelTabBody to filter the audit list and by PreAnalysisPanel's
 * "See all N relationships" link to compute N. Centralised here so the two
 * surfaces cannot drift on what counts as causal. Reads node kind from
 * `node.type ?? node.data.kind ?? node.data.type` to match the existing
 * detection rule in ModelTabBody:333.
 */
export function getCausalEdges(
  nodes: { id: string; type?: string; data?: unknown }[],
  edges: Edge<EdgeData>[],
): Edge<EdgeData>[] {
  const decisionOptionIds = new Set<string>()
  for (const n of nodes) {
    const data = n.data as { kind?: unknown; type?: unknown } | undefined
    const kind = (n.type ?? data?.kind ?? data?.type) as string | undefined
    if (kind === 'decision' || kind === 'option') decisionOptionIds.add(n.id)
  }
  return edges.filter(
    (e) => !decisionOptionIds.has(e.source) && !decisionOptionIds.has(e.target),
  )
}
