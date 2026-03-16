/**
 * Compute the set of active nodes and edges for Option Isolation lens mode.
 *
 * Given a selected option, computes the full structural path:
 * decision node → option node → intervention targets → all downstream nodes → goal
 *
 * This is a pure utility with no store or React dependencies.
 */

import { getInterventionTargets } from './pathFinding'

interface GraphNode {
  id: string
  type?: string
}

interface GraphEdge {
  id: string
  source: string
  target: string
}

interface CeeOption {
  id: string
  interventions?: Record<string, number>
}

export interface OptionPathsResult {
  activeNodeIds: Set<string>
  activeEdgeKeys: Set<string>
}

/**
 * BFS forward traversal: collect all nodes reachable from a set of start nodes.
 * Follows edge direction (source → target).
 */
function getReachableNodeIds(
  startNodeIds: string[],
  edges: GraphEdge[],
): Set<string> {
  // Build adjacency list
  const outgoing = new Map<string, GraphEdge[]>()
  for (const edge of edges) {
    const existing = outgoing.get(edge.source) ?? []
    existing.push(edge)
    outgoing.set(edge.source, existing)
  }

  const reachable = new Set<string>()
  const queue = [...startNodeIds]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (reachable.has(current)) continue
    reachable.add(current)

    const children = outgoing.get(current) ?? []
    for (const edge of children) {
      if (!reachable.has(edge.target)) {
        queue.push(edge.target)
      }
    }
  }

  return reachable
}

/**
 * Compute active node and edge sets for the Option Isolation lens.
 *
 * Algorithm:
 * 1. Find the decision node that parents the selected option
 * 2. Include decision node + option node
 * 3. Get intervention targets from ceeOptions
 * 4. Include decision→option and option→target edges
 * 5. BFS downstream from intervention targets collecting all reachable nodes
 * 6. Collect all edges where both source and target are in the active set
 */
export function computeOptionPaths(
  nodes: GraphNode[],
  edges: GraphEdge[],
  optionId: string,
  ceeOptions: CeeOption[],
): OptionPathsResult {
  const activeNodeIds = new Set<string>()
  const activeEdgeKeys = new Set<string>()

  // 1. Find the decision node that parents the selected option
  const parentEdge = edges.find(e => e.target === optionId)
  if (parentEdge) {
    activeNodeIds.add(parentEdge.source) // decision node
    activeEdgeKeys.add(parentEdge.id)    // decision → option edge
  }

  // 2. Include the option node itself
  activeNodeIds.add(optionId)

  // 3. Get intervention targets
  const interventionTargetIds = getInterventionTargets(optionId, ceeOptions)

  // 4. Add option → target edges
  for (const targetId of interventionTargetIds) {
    const optionToTarget = edges.find(
      e => e.source === optionId && e.target === targetId
    )
    if (optionToTarget) {
      activeEdgeKeys.add(optionToTarget.id)
    }
    activeNodeIds.add(targetId)
  }

  // 5. BFS downstream from intervention targets
  const downstreamNodes = getReachableNodeIds(interventionTargetIds, edges)
  for (const nodeId of downstreamNodes) {
    activeNodeIds.add(nodeId)
  }

  // 6. Collect all edges where both source and target are active
  for (const edge of edges) {
    if (activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)) {
      activeEdgeKeys.add(edge.id)
    }
  }

  // Also include constraint nodes connected to any active node
  // (constraints have edges to/from active nodes)
  const nodeTypeMap = new Map(nodes.map(n => [n.id, n.type]))
  for (const edge of edges) {
    const sourceType = nodeTypeMap.get(edge.source)
    const targetType = nodeTypeMap.get(edge.target)

    if (sourceType === 'constraint' && activeNodeIds.has(edge.target)) {
      activeNodeIds.add(edge.source)
      activeEdgeKeys.add(edge.id)
    }
    if (targetType === 'constraint' && activeNodeIds.has(edge.source)) {
      activeNodeIds.add(edge.target)
      activeEdgeKeys.add(edge.id)
    }
  }

  return { activeNodeIds, activeEdgeKeys }
}
