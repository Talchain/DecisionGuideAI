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
