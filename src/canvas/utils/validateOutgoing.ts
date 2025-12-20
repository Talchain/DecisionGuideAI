/**
 * Shared validation utility for outgoing probability validation
 *
 * Rules:
 * - ONLY validates decision→option edges (probability distribution semantics)
 * - Other edge types (factor→option, risk→outcome) are NOT validated here
 * - A decision node is invalid if it has ≥2 outgoing edges to options with non-zero confidence
 *   and the sum of those non-zero confidences ≠ 100% ± tolerance
 * - Pristine nodes (all zeros, never edited) are NOT invalid
 * - Template-loaded non-zero probabilities are considered "touched"
 */

import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../domain/nodes'
import type { EdgeData } from '../domain/edges'

export interface ValidationOptions {
  tolerance?: number  // Percentage tolerance (default 1%)
  requireTouched?: boolean  // Skip validation for untouched nodes (default true)
}

export interface InvalidNodeInfo {
  nodeId: string
  nodeLabel: string
  sum: number
  expected: number
  edgeCount: number
  nonZeroEdgeCount: number
}

/**
 * Check if a single node's outgoing probabilities are valid
 * Only validates decision→option edges (probability distribution semantics)
 */
export function isNodeProbabilitiesValid(
  nodeId: string,
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  touchedNodeIds: Set<string>,
  options: ValidationOptions = {}
): boolean {
  const { tolerance = 0.01, requireTouched = true } = options

  // Find the node to check its kind
  const node = nodes.find(n => n.id === nodeId)

  // Only validate decision nodes - other node types don't have probability distribution semantics
  if (node?.data?.kind !== 'decision') {
    return true
  }

  // Build node lookup for target node checks
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Get outgoing edges to option nodes only (decision→option edges)
  const outgoingEdges = edges.filter(e => {
    if (e.source !== nodeId) return false
    const targetNode = nodeMap.get(e.target)
    return targetNode?.data?.kind === 'option'
  })

  // Only validate nodes with 2+ outgoing edges to options
  if (outgoingEdges.length < 2) {
    return true
  }

  // Filter to non-zero confidence edges
  const nonZeroEdges = outgoingEdges.filter(e => (e.data?.confidence ?? 0) > 0)

  // If all edges are zero and node is untouched, it's valid (pristine state)
  if (nonZeroEdges.length === 0 && requireTouched && !touchedNodeIds.has(nodeId)) {
    return true
  }

  // If we have non-zero edges, validate the sum
  if (nonZeroEdges.length >= 2) {
    const sum = nonZeroEdges.reduce((acc, e) => acc + (e.data?.confidence ?? 0), 0)
    return Math.abs(sum - 1.0) <= tolerance
  }

  // If we have 0-1 non-zero edges but node is touched, it might be incomplete
  // but we don't flag it as "invalid" per se (user is still editing)
  return true
}

/**
 * Get all invalid nodes in the canvas
 * Returns ordered list of invalid node info
 * Only validates decision→option edges (probability distribution semantics)
 */
export function getInvalidNodes(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  touchedNodeIds: Set<string>,
  options: ValidationOptions = {}
): InvalidNodeInfo[] {
  const { tolerance = 0.01, requireTouched = true } = options
  const invalidNodes: InvalidNodeInfo[] = []

  // Build node lookup for efficient target node checks
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Only check decision nodes - other node types don't have probability distribution semantics
  const decisionNodes = nodes.filter(n => n.data?.kind === 'decision')

  decisionNodes.forEach(node => {
    // Get outgoing edges to option nodes only (decision→option edges)
    const outgoingEdges = edges.filter(e => {
      if (e.source !== node.id) return false
      const targetNode = nodeMap.get(e.target)
      return targetNode?.data?.kind === 'option'
    })

    // Only validate nodes with 2+ outgoing edges to options
    if (outgoingEdges.length < 2) {
      return
    }

    // Filter to non-zero confidence edges
    const nonZeroEdges = outgoingEdges.filter(e => (e.data?.confidence ?? 0) > 0)

    // If all edges are zero and node is untouched, skip (pristine state)
    if (nonZeroEdges.length === 0 && requireTouched && !touchedNodeIds.has(node.id)) {
      return
    }

    // If we have 2+ non-zero edges, validate the sum
    if (nonZeroEdges.length >= 2) {
      const sum = nonZeroEdges.reduce((acc, e) => acc + (e.data?.confidence ?? 0), 0)

      if (Math.abs(sum - 1.0) > tolerance) {
        invalidNodes.push({
          nodeId: node.id,
          nodeLabel: node.data?.label || node.id,
          sum,
          expected: 1.0,
          edgeCount: outgoingEdges.length,
          nonZeroEdgeCount: nonZeroEdges.length
        })
      }
    }
  })

  return invalidNodes
}

/**
 * Get the next invalid node for cycling (Alt+V)
 */
export function getNextInvalidNode(
  nodes: Node<NodeData>[],
  edges: Edge<EdgeData>[],
  touchedNodeIds: Set<string>,
  currentNodeId?: string,
  options: ValidationOptions = {}
): InvalidNodeInfo | null {
  const invalidNodes = getInvalidNodes(nodes, edges, touchedNodeIds, options)

  if (invalidNodes.length === 0) {
    return null
  }

  // If no current node, return first invalid
  if (!currentNodeId) {
    return invalidNodes[0]
  }

  // Find current node in invalid list
  const currentIndex = invalidNodes.findIndex(n => n.nodeId === currentNodeId)

  // If current node not in invalid list, return first invalid
  if (currentIndex === -1) {
    return invalidNodes[0]
  }

  // Return next invalid node (wrap around)
  const nextIndex = (currentIndex + 1) % invalidNodes.length
  return invalidNodes[nextIndex]
}
