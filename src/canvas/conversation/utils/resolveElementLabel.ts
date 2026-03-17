/**
 * resolveElementLabel -- resolve the human-readable label for a node or edge.
 *
 * Used by Track 2 to populate `target_label` in `direct_edit` scenario events.
 * Returns undefined if the element is not found or has no label.
 */

import type { Node, Edge } from '@xyflow/react'

/**
 * Look up a node or edge label from the current graph state.
 * For edges, returns "Source label -> Target label" format.
 */
export function resolveElementLabel(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): string | undefined {
  // Check nodes first
  const node = nodes.find((n) => n.id === targetId)
  if (node?.data?.label && typeof node.data.label === 'string') {
    return node.data.label
  }

  // Check edges — compose from source/target labels
  const edge = edges.find((e) => e.id === targetId)
  if (edge) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    const srcLabel = sourceNode?.data?.label
    const tgtLabel = targetNode?.data?.label
    if (typeof srcLabel === 'string' && typeof tgtLabel === 'string') {
      return `${srcLabel} -> ${tgtLabel}`
    }
  }

  return undefined
}
