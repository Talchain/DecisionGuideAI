/**
 * Extract target node/edge IDs from a set of patch operations.
 *
 * Used by the auto-clear mechanism to remove GuidanceItems that reference
 * elements modified by an accepted patch.
 */

import type { PatchOperation } from '../types'

const NODE_OPS = new Set(['add_node', 'remove_node', 'update_node'])
const EDGE_OPS = new Set(['add_edge', 'remove_edge', 'update_edge'])

export interface ExtractedTargetIds {
  nodeIds: string[]
  edgeIds: string[]
}

export function extractTargetIdsFromPatch(operations: PatchOperation[]): ExtractedTargetIds {
  const nodeIds: string[] = []
  const edgeIds: string[] = []

  for (const op of operations) {
    if (!op.target_id) continue
    if (NODE_OPS.has(op.op)) {
      nodeIds.push(op.target_id)
    } else if (EDGE_OPS.has(op.op)) {
      edgeIds.push(op.target_id)
    }
  }

  return { nodeIds, edgeIds }
}
