/**
 * Validation logic for ceeAnalysisReady persistence across page refreshes and scenario loads.
 *
 * Ensures that restored ceeAnalysisReady data is still valid for the current graph state,
 * preventing stale analysis metadata from being used after graph modifications.
 */

import type { CEEAnalysisReady } from '../../adapters/cee/types'
import type { Node } from '@xyflow/react'

export interface ValidationResult {
  isValid: boolean
  reason?: 'missing_goal' | 'missing_option_nodes' | 'node_ids_changed' | 'empty_options'
  details?: string
}

/**
 * Validate if ceeAnalysisReady is still valid for current graph.
 *
 * Checks:
 * - Options array exists and not empty
 * - Goal node still exists in graph
 * - All option nodes still exist in graph
 * - Graph structure hasn't changed significantly (if node ID snapshot provided)
 *
 * @param ceeAnalysisReady - The CEE analysis ready payload to validate
 * @param ceeAnalysisReadyNodeIds - Optional snapshot of node IDs when ceeAnalysisReady was created
 * @param currentNodes - Current graph nodes
 * @returns Validation result with isValid boolean and optional reason/details
 */
export function validateCeeAnalysisReady(
  ceeAnalysisReady: CEEAnalysisReady | null,
  ceeAnalysisReadyNodeIds: string[] | null,
  currentNodes: Node[]
): ValidationResult {
  if (!ceeAnalysisReady || !ceeAnalysisReady.options?.length) {
    return { isValid: false, reason: 'empty_options' }
  }

  // Check goal node exists
  const goalExists = currentNodes.some((n) => n.id === ceeAnalysisReady.goal_node_id)
  if (!goalExists) {
    return {
      isValid: false,
      reason: 'missing_goal',
      details: `Goal node ${ceeAnalysisReady.goal_node_id} not found`,
    }
  }

  // Check all option nodes exist
  for (const option of ceeAnalysisReady.options) {
    const optionExists = currentNodes.some((n) => n.id === option.id)
    if (!optionExists) {
      return {
        isValid: false,
        reason: 'missing_option_nodes',
        details: `Option node ${option.id} not found`,
      }
    }
  }

  // Check graph structure hasn't changed significantly
  if (ceeAnalysisReadyNodeIds?.length) {
    const currentNodeIds = currentNodes.map((n) => n.id)
    const removedCount = ceeAnalysisReadyNodeIds.filter((id) => !currentNodeIds.includes(id)).length
    const removalRatio = removedCount / ceeAnalysisReadyNodeIds.length

    // Reject if >30% of nodes removed (significant structural change)
    if (removalRatio > 0.3) {
      return {
        isValid: false,
        reason: 'node_ids_changed',
        details: `${removedCount} nodes removed (${Math.round(removalRatio * 100)}% change)`,
      }
    }
  }

  return { isValid: true }
}
