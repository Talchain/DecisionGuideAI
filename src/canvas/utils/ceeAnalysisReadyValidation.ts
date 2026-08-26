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
  reason?:
    | 'missing_goal'
    | 'missing_option_nodes'
    | 'node_ids_changed'
    | 'empty_options'
    /** A blocked refusal: identity-bearing, but not a readiness verdict to restore. */
    | 'blocked_refusal'
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

  // ⛔ A BLOCKED REFUSAL IS NOT A RESTORABLE READINESS VERDICT.
  //
  // The check above USED to cover this by accident: a blocked refusal carried
  // `options: []`, so `empty_options` rejected it and nothing was ever
  // restored. CEE now carries model identity on refusals — correctly, because a
  // refusal that cannot name the model is one a user cannot act on — so the
  // payload has non-empty options and this validator ADMITS it.
  //
  // ⭐ THE ARGUMENT IS ALREADY IN THIS CODEBASE, ABOUT ITS SIBLING.
  // `store.ts`'s `setAnalysisRefusalNotice` is deliberately a bare `set` with no
  // sessionStorage write, and says why: doing so "would restore a refusal into a
  // session where no analysis was refused". The refusal's EXPLANATION is
  // withheld from persistence for exactly this reason — so restoring the
  // refusal's PAYLOAD leaves a user holding the evidence of a refusal with no
  // account of it, on a fresh tab where nothing was refused.
  //
  // One seam, three sources: this validator gates the sessionStorage restore,
  // the autosave projection and the graph-load path alike.
  if (ceeAnalysisReady.status === 'blocked') {
    return { isValid: false, reason: 'blocked_refusal' }
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
