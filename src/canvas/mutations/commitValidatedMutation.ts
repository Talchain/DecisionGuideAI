/**
 * Single canonical validated-mutation commit path (Hard rule 2).
 *
 * All context menu graph mutations flow through this function.
 * It attempts PLoT validate-patch first (matching ConversationPanel.tsx:173 pattern),
 * falls back to local Zustand mutation when the endpoint is unavailable.
 *
 * When PLoT validate-patch ships on the adapter, this automatically routes
 * through it — no code changes needed.
 */

import { useCanvasStore } from '../store'
import type { PatchOperation } from '../conversation/types'

export interface MutationResult {
  success: boolean
  error?: string
}

type ShowToastFn = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

/**
 * Commit a graph mutation through the canonical path.
 *
 * @param operations  Patch ops describing the mutation (for PLoT validate-patch)
 * @param localApply  Fallback function that applies the mutation directly to the Zustand store
 * @param showToast   Toast function for error reporting
 */
export async function commitValidatedMutation(
  operations: PatchOperation[],
  localApply: () => void,
  showToast?: ShowToastFn,
): Promise<MutationResult> {
  // Phase 1: Try PLoT validate-patch if available on the adapter
  try {
    const { plot } = await import('../../adapters/plot')
    const adapter = plot as any
    if (adapter?.validatePatch && typeof adapter.validatePatch === 'function') {
      const state = useCanvasStore.getState()
      const result = await adapter.validatePatch({
        graph: { nodes: state.nodes, edges: state.edges },
        operations,
      })

      if (result.valid) {
        const validatedGraph = result.graph ?? result.validated_graph
        if (validatedGraph?.nodes && validatedGraph?.edges) {
          state.pushHistory()
          useCanvasStore.setState({
            nodes: validatedGraph.nodes,
            edges: validatedGraph.edges,
          })
        } else {
          // PLoT validated but didn't return full graph — apply locally
          localApply()
        }
        return { success: true }
      } else {
        // PLoT rejected the mutation
        const message = result.message ?? 'Mutation validation failed'
        showToast?.(message, 'error')
        return { success: false, error: message }
      }
    }
  } catch {
    // Adapter not available or network error — fall through to local path
  }

  // Phase 2: Local application (current behaviour for all mutations)
  localApply()
  return { success: true }
}
