/**
 * Graph hashing utility for deduplication
 *
 * Generates a stable hash for graph state to detect changes
 * and prevent unnecessary refetches.
 */

import type { Node, Edge } from '@xyflow/react'
import { getEdgeKey } from '../domain/edgeUtils'

/**
 * Generate a stable hash for the current graph state.
 *
 * COVERS, exactly: node ids · node `type` · `data.label` · `data.probability` ·
 * `data.confidence` · edge keys · edge `data.confidence` / `weight` / `belief`.
 *
 * ⚠ IT DOES NOT COVER `position`, AND THAT IS DELIBERATE. This docstring
 * previously read *"Includes node IDs, types, labels, positions and edge
 * connections"* — false since at least the current history, and false in the
 * dangerous direction. This hash answers *"has the ANALYTICAL content changed?"*:
 * it is written to `p_hashes.graph_hash` and compared against CEE's own graph
 * hash, so it must describe the model, not the picture. Identity is analytical;
 * geometry is presentation.
 *
 * A reader who trusted the old sentence had two ways to go wrong, and both were
 * live: conclude that moving a node already invalidates an analysis (it does
 * not, and nothing here would tell them otherwise), or "correct" the code to
 * match the comment — which would make every drag re-hash the model, fork this
 * definition from CEE's, and make every scenario read as changed. A stale
 * comment that invites a harmful fix is worse than no comment.
 *
 * The authority for *"is the autosave dirty?"* is a DIFFERENT hash with a
 * different answer — `useAutosave.computeGraphHash` — and it SHOULD see
 * geometry, because a node move must be persisted to the layout sidecar. The
 * authority for *"does this change invalidate an analysis?"* is
 * `domain/analyticalChange.ts`, whose registry classifies `position` as
 * cosmetic. Three questions, three owners; do not collapse them.
 *
 * Used for:
 * - Deduplicating graph readiness fetches
 * - Detecting actual graph changes vs UI-only changes
 */
export function generateGraphHash(nodes: Node[], edges: Edge[]): string {
  // Sort for stability
  const sortedNodeIds = nodes.map(n => n.id).sort()
  const sortedEdgeIds = edges.map(e => getEdgeKey(e)).sort()

  // Include node data that affects analysis
  const nodeData = nodes.map(n => {
    const data = n.data as Record<string, unknown> | undefined
    return `${n.id}:${n.type || ''}:${data?.label || ''}:${data?.probability ?? ''}:${data?.confidence ?? ''}`
  }).sort().join('|')

  // Include edge data that affects analysis
  const edgeData = edges.map(e => {
    const data = e.data as Record<string, unknown> | undefined
    return `${getEdgeKey(e)}:${data?.confidence ?? ''}:${data?.weight ?? ''}:${data?.belief ?? ''}`
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
