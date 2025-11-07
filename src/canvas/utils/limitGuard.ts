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
 * Shows attempted total to clarify how much over the limit the operation would be
 */
export function formatLimitError(result: LimitCheckResult, nodesToAdd: number = 0, edgesToAdd: number = 0): string {
  if (result.allowed) return ''

  if (result.nodeLimit) {
    const attemptedTotal = result.nodeLimit.current + nodesToAdd
    return `Cannot add ${nodesToAdd} node${nodesToAdd !== 1 ? 's' : ''}: would exceed limit (${attemptedTotal}/${result.nodeLimit.max}). Remove ${attemptedTotal - result.nodeLimit.max} node${attemptedTotal - result.nodeLimit.max !== 1 ? 's' : ''} to continue.`
  }

  if (result.edgeLimit) {
    const attemptedTotal = result.edgeLimit.current + edgesToAdd
    return `Cannot add ${edgesToAdd} edge${edgesToAdd !== 1 ? 's' : ''}: would exceed limit (${attemptedTotal}/${result.edgeLimit.max}). Remove ${attemptedTotal - result.edgeLimit.max} edge${attemptedTotal - result.edgeLimit.max !== 1 ? 's' : ''} to continue.`
  }

  return result.reason || 'Operation would exceed engine limits'
}
