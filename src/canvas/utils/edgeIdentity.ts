/**
 * Edge Identity Adapter
 *
 * All edge references in UI components must use this adapter.
 * Provides abstraction layer for future canonical edge_id migration.
 *
 * RULE: Never access edge.id directly in components - use getDisplayEdgeId()
 */

import type { Edge } from '@xyflow/react'
import type { MappedFragileEdge } from '../../lib/mappers/types'
import { THRESHOLDS } from '../../lib/mappers/constants'

/**
 * Returns stable edge identifier for all UI references.
 * Abstraction layer: today uses Edge.id, can switch to canonical edge_id later.
 */
export function getDisplayEdgeId(edge: Edge): string {
  return edge.id
}

/**
 * Build Set of edge IDs from MappedFragileEdge array
 */
export function buildFragileEdgeIdSet(fragileEdges: MappedFragileEdge[]): Set<string> {
  return new Set(fragileEdges.map(fe => fe.edgeId))
}

/**
 * Match an RF edge against a list of fragile edges.
 *
 * PLoT robustness uses canonical edge IDs like "fac_pmf->out_cac" (fromId->toId),
 * while RF edges use React Flow IDs like "e-5". When the string edgeId doesn't
 * match the RF edge.id, fall back to matching on source/target node IDs.
 *
 * Only returns edges above the canonical switch_probability threshold (UI-SEM-013)
 * to stay consistent with isEdgeFragile() in fragileEdgeMatch.ts.
 */
export function findFragileEdge(
  edge: Edge,
  fragileEdges: MappedFragileEdge[]
): MappedFragileEdge | undefined {
  const rfId = edge.id
  // Filter to edges above canonical threshold (UI-SEM-013)
  const aboveThreshold = fragileEdges.filter(
    fe => typeof fe.switchProbability === 'number' && fe.switchProbability > THRESHOLDS.FRAGILE_EDGE_FILTER
  )
  // 1. Try direct edgeId match (future-proof: when PLoT edgeId === RF edge.id)
  const byId = aboveThreshold.find(fe => fe.edgeId === rfId)
  if (byId) return byId
  // 2. Fall back to source + target match
  return aboveThreshold.find(
    fe => fe.fromId === edge.source && fe.toId === edge.target
  )
}

/**
 * Build a lookup that maps RF edge.id to its fragile edge entry, using
 * source+target matching as fallback for PLoT canonical IDs.
 */
export function buildFragileEdgeLookup(
  rfEdges: Edge[],
  fragileEdges: MappedFragileEdge[]
): Map<string, MappedFragileEdge> {
  const map = new Map<string, MappedFragileEdge>()
  for (const edge of rfEdges) {
    const match = findFragileEdge(edge, fragileEdges)
    if (match) map.set(edge.id, match)
  }
  return map
}

/**
 * Build Set of edge IDs from robust edges array
 */
export function buildRobustEdgeIdSet(robustEdges: string[]): Set<string> {
  return new Set(robustEdges)
}

/**
 * Check if an edge is fragile
 */
export function isFragileEdge(edge: Edge, fragileEdgeIds: Set<string>): boolean {
  return fragileEdgeIds.has(getDisplayEdgeId(edge))
}

/**
 * Check if an edge is robust
 */
export function isRobustEdge(edge: Edge, robustEdgeIds: Set<string>): boolean {
  return robustEdgeIds.has(getDisplayEdgeId(edge))
}
