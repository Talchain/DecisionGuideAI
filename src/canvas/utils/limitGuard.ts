/**
 * Centralized Limit Enforcement (Sprint 2)
 *
 * Provides unified limit checking for all node/edge insertion paths:
 * - Toolbar "Add Node" button
 * - Blueprint insertion
 * - Template insertion
 * - Programmatic adds
 *
 * Ensures consistent enforcement and user feedback.
 */

import type { LimitsV1 } from '../../adapters/plot/types'

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  nodeLimit?: { current: number; max: number }
  edgeLimit?: { current: number; max: number }
}

/**
 * Check if adding nodes/edges would exceed engine limits
 */
export function checkLimits(
  currentNodeCount: number,
  currentEdgeCount: number,
  nodesToAdd: number,
  edgesToAdd: number,
  limits: LimitsV1 | null
): LimitCheckResult {
  // If no limits available, allow (graceful degradation)
  if (!limits) {
    return { allowed: true }
  }

  // Check node limit
  const newNodeCount = currentNodeCount + nodesToAdd
  if (newNodeCount > limits.nodes.max) {
    return {
      allowed: false,
      reason: `Adding ${nodesToAdd} node${nodesToAdd !== 1 ? 's' : ''} would exceed limit (${newNodeCount}/${limits.nodes.max})`,
      nodeLimit: { current: currentNodeCount, max: limits.nodes.max }
    }
  }

  // Check edge limit
  const newEdgeCount = currentEdgeCount + edgesToAdd
  if (newEdgeCount > limits.edges.max) {
    return {
      allowed: false,
      reason: `Adding ${edgesToAdd} edge${edgesToAdd !== 1 ? 's' : ''} would exceed limit (${newEdgeCount}/${limits.edges.max})`,
      edgeLimit: { current: currentEdgeCount, max: limits.edges.max }
    }
  }

  return { allowed: true }
}

/**
 * Format limit check failure message for user
 */
export function formatLimitError(result: LimitCheckResult): string {
  if (result.allowed) return ''

  if (result.nodeLimit) {
    return `Node limit reached (${result.nodeLimit.current}/${result.nodeLimit.max}). Remove nodes to continue.`
  }

  if (result.edgeLimit) {
    return `Edge limit reached (${result.edgeLimit.current}/${result.edgeLimit.max}). Remove edges to continue.`
  }

  return result.reason || 'Operation would exceed engine limits'
}
