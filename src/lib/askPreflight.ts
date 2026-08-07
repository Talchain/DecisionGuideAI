/**
 * Ask Preflight Check
 *
 * CEE enforces MAX 12 nodes / 20 edges for /assist/v1/ask.
 * Exceeding this returns 400 CEE_ASK_INVALID_GRAPH.
 *
 * Run preflight check AFTER building graph snapshot (not on raw canvas arrays)
 * to ensure the transformed graph meets CEE limits.
 */

// =============================================================================
// Constants
// =============================================================================

export const ASK_LIMITS = {
  MAX_NODES: 50,
  MAX_EDGES: 40,
} as const

// =============================================================================
// Types
// =============================================================================

export interface PreflightResult {
  allowed: boolean
  reason?: string
  nodeCount: number
  edgeCount: number
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Check if graph snapshot meets CEE limits for /assist/v1/ask
 *
 * @param nodes - Graph nodes (from snapshot, not raw canvas)
 * @param edges - Graph edges (from snapshot, not raw canvas)
 * @returns PreflightResult indicating if request is allowed
 *
 * @example
 * const graphSnapshot = prepareGraphSnapshot(canvasNodes, canvasEdges)
 * const preflight = checkAskPreflight(graphSnapshot.nodes, graphSnapshot.edges)
 * if (!preflight.allowed) {
 *   showError(preflight.reason)
 *   return
 * }
 */
export function checkAskPreflight(nodes: unknown[], edges: unknown[]): PreflightResult {
  const nodeCount = nodes.length
  const edgeCount = edges.length

  if (nodeCount > ASK_LIMITS.MAX_NODES) {
    return {
      allowed: false,
      reason: `Ask is limited to ${ASK_LIMITS.MAX_NODES} nodes. Your model has ${nodeCount}. Please select a smaller section or simplify the model.`,
      nodeCount,
      edgeCount,
    }
  }

  if (edgeCount > ASK_LIMITS.MAX_EDGES) {
    return {
      allowed: false,
      reason: `Ask is limited to ${ASK_LIMITS.MAX_EDGES} edges. Your model has ${edgeCount}. Please select a smaller section or simplify the model.`,
      nodeCount,
      edgeCount,
    }
  }

  return { allowed: true, nodeCount, edgeCount }
}

/**
 * Quick check if graph is within limits
 */
export function isWithinAskLimits(nodeCount: number, edgeCount: number): boolean {
  return nodeCount <= ASK_LIMITS.MAX_NODES && edgeCount <= ASK_LIMITS.MAX_EDGES
}

/**
 * Get human-readable limit status
 */
export function getAskLimitStatus(nodeCount: number, edgeCount: number): string {
  const nodeStatus = `${nodeCount}/${ASK_LIMITS.MAX_NODES} nodes`
  const edgeStatus = `${edgeCount}/${ASK_LIMITS.MAX_EDGES} edges`

  if (nodeCount > ASK_LIMITS.MAX_NODES || edgeCount > ASK_LIMITS.MAX_EDGES) {
    return `Over limit: ${nodeStatus}, ${edgeStatus}`
  }

  return `${nodeStatus}, ${edgeStatus}`
}
