/**
 * Graph hashing utility for deduplication
 *
 * Generates a stable hash for graph state to detect changes
 * and prevent unnecessary refetches.
 */

import type { Node, Edge } from '@xyflow/react'

/**
 * Generate a stable hash for the current graph state
 * Includes node IDs, types, labels, positions and edge connections
 *
 * Used for:
 * - Deduplicating graph readiness fetches
 * - Detecting actual graph changes vs UI-only changes
 */
export function generateGraphHash(nodes: Node[], edges: Edge[]): string {
  // Sort for stability
  const sortedNodeIds = nodes.map(n => n.id).sort()
  const sortedEdgeIds = edges.map(e => `${e.source}->${e.target}`).sort()

  // Include node data that affects analysis
  const nodeData = nodes.map(n => {
    const data = n.data as Record<string, unknown> | undefined
    return `${n.id}:${n.type || ''}:${data?.label || ''}:${data?.probability ?? ''}:${data?.confidence ?? ''}`
  }).sort().join('|')

  // Include edge data that affects analysis
  const edgeData = edges.map(e => {
    const data = e.data as Record<string, unknown> | undefined
    return `${e.source}->${e.target}:${data?.confidence ?? ''}:${data?.weight ?? ''}:${data?.belief ?? ''}`
  }).sort().join('|')

  return `n:${sortedNodeIds.join(',')}|e:${sortedEdgeIds.join(',')}|nd:${nodeData}|ed:${edgeData}`
}

/**
 * Quick structural hash - only checks node/edge counts and IDs
 * Use when you only care about structural changes, not data changes
 */
export function generateStructuralHash(nodes: Node[], edges: Edge[]): string {
  const nodeIds = nodes.map(n => n.id).sort().join(',')
  const edgeIds = edges.map(e => `${e.source}-${e.target}`).sort().join(',')
  return `${nodeIds}|${edgeIds}`
}
