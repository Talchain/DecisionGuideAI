/**
 * Path Finding Utilities for Graph Interaction
 *
 * Provides algorithms for finding paths between nodes in the causal graph.
 * Used for path highlighting when a node is selected.
 *
 * IMPORTANT: Uses two-phase algorithm to handle reconverging graphs correctly.
 * A naive DFS with visited-set would miss edges when paths reconverge.
 */

interface Edge {
  id: string
  source: string
  target: string
}

interface PathFindingOptions {
  maxDepth?: number
}

/**
 * Find all edges on paths from startNodeId to goalNodeId
 *
 * IMPORTANT: Uses two-phase algorithm to handle reconverging graphs correctly.
 * A naive DFS with visited-set would miss edges when paths reconverge.
 *
 * Example: A → B → D → Goal AND A → C → D → Goal
 * Both paths must be fully highlighted, including C → D.
 *
 * Algorithm:
 * Phase 1: Compute which nodes can reach goal (memoised)
 * Phase 2: Collect ALL edges where both endpoints can reach goal
 */
export function findPathsToGoal(
  startNodeId: string,
  goalNodeId: string,
  edges: Edge[],
  options: PathFindingOptions = {}
): string[] {
  const { maxDepth = 10 } = options

  // Edge case: start equals goal
  if (startNodeId === goalNodeId) return []

  // Build adjacency list for efficient traversal
  const outgoingEdges = new Map<string, Edge[]>()
  for (const edge of edges) {
    const existing = outgoingEdges.get(edge.source) ?? []
    existing.push(edge)
    outgoingEdges.set(edge.source, existing)
  }

  // Phase 1: Compute which nodes can reach goal (memoised)
  const canReachGoal = new Map<string, boolean>()
  const computing = new Set<string>() // Cycle detection

  function computeCanReach(nodeId: string, depth: number): boolean {
    // Base cases
    if (nodeId === goalNodeId) return true
    if (depth > maxDepth) return false
    if (canReachGoal.has(nodeId)) return canReachGoal.get(nodeId)!
    if (computing.has(nodeId)) return false // Cycle detected

    computing.add(nodeId)

    const nodeEdges = outgoingEdges.get(nodeId) ?? []
    let canReach = false

    for (const edge of nodeEdges) {
      if (computeCanReach(edge.target, depth + 1)) {
        canReach = true
        // Don't break — need to compute reachability for ALL children
      }
    }

    computing.delete(nodeId)
    canReachGoal.set(nodeId, canReach)
    return canReach
  }

  // Compute reachability starting from start node
  const startCanReach = computeCanReach(startNodeId, 0)
  if (!startCanReach) return []

  // Phase 2: Collect all edges where BOTH source and target can reach goal
  // This ensures reconverging paths are fully captured
  const pathEdges = new Set<string>()

  for (const edge of edges) {
    const sourceCanReach = canReachGoal.get(edge.source) ?? false
    const targetCanReach = edge.target === goalNodeId || (canReachGoal.get(edge.target) ?? false)

    if (sourceCanReach && targetCanReach) {
      pathEdges.add(edge.id)
    }
  }

  return Array.from(pathEdges)
}

/**
 * Find all edges on paths leading INTO goalNodeId (reverse traversal)
 * Used when Goal node is selected to show all contributing paths.
 *
 * IMPORTANT: Uses two-phase algorithm (matching findPathsToGoal) for consistency
 * and correct handling of reconverging graphs.
 *
 * Algorithm:
 * Phase 1: Compute which nodes can reach goal (backward reachability)
 * Phase 2: Collect ALL edges where target is reachable from goal
 */
export function findPathsFromRoots(
  goalNodeId: string,
  edges: Edge[],
  options: PathFindingOptions = {}
): string[] {
  const { maxDepth = 10 } = options

  // Build reverse adjacency list (target → edges)
  const incomingEdges = new Map<string, Edge[]>()
  for (const edge of edges) {
    const existing = incomingEdges.get(edge.target) ?? []
    existing.push(edge)
    incomingEdges.set(edge.target, existing)
  }

  // Phase 1: Compute which nodes can be reached from goal (going backwards)
  const reachableFromGoal = new Map<string, boolean>()
  const computing = new Set<string>() // Cycle detection

  function computeReachable(nodeId: string, depth: number): boolean {
    // Base cases
    if (nodeId === goalNodeId) return true
    if (depth > maxDepth) return false
    if (reachableFromGoal.has(nodeId)) return reachableFromGoal.get(nodeId)!
    if (computing.has(nodeId)) return false // Cycle detected

    computing.add(nodeId)

    // For reverse traversal: a node is reachable if any of its targets are reachable
    // But we're computing "can be reached FROM goal", so we check incoming edges
    // A source node is in the path if its target is reachable
    const nodeEdges = incomingEdges.get(nodeId) ?? []
    let canBeReached = nodeId === goalNodeId

    // Mark this node as reachable since we're traversing from goal
    if (!canBeReached) {
      // This node is reachable if it has an edge to a reachable node
      // But for backward traversal, we're building the set of nodes that lead to goal
      canBeReached = true // We only call this on nodes found via backward traversal
    }

    for (const edge of nodeEdges) {
      computeReachable(edge.source, depth + 1)
    }

    computing.delete(nodeId)
    reachableFromGoal.set(nodeId, canBeReached)
    return canBeReached
  }

  // Start backward traversal from goal
  computeReachable(goalNodeId, 0)

  // Also mark all sources we visited as reachable
  // Re-traverse to ensure all nodes on paths are marked
  const visited = new Set<string>()
  function markReachable(nodeId: string, depth: number): void {
    if (visited.has(nodeId) || depth > maxDepth) return
    visited.add(nodeId)
    reachableFromGoal.set(nodeId, true)

    const nodeEdges = incomingEdges.get(nodeId) ?? []
    for (const edge of nodeEdges) {
      markReachable(edge.source, depth + 1)
    }
  }
  markReachable(goalNodeId, 0)

  // Phase 2: Collect all edges where target is in the reachable set
  const pathEdges = new Set<string>()

  for (const edge of edges) {
    const targetReachable = reachableFromGoal.get(edge.target) ?? false
    const sourceReachable = reachableFromGoal.get(edge.source) ?? false

    // Include edge if both source and target are in the backward-reachable set
    if (targetReachable && sourceReachable) {
      pathEdges.add(edge.id)
    }
  }

  return Array.from(pathEdges)
}

/**
 * Get intervention target node IDs from canonical options source
 *
 * IMPORTANT: Use store.ceeAnalysisReady.options, NOT node.data.interventions
 * Node data may not have interventions populated.
 */
export function getInterventionTargets(
  optionId: string,
  options: { id: string; interventions?: Record<string, number> }[]
): string[] {
  const option = options.find((o) => o.id === optionId)
  if (!option?.interventions) return []
  return Object.keys(option.interventions)
}
