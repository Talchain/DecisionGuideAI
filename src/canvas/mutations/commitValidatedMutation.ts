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
          markFreshnessDirty()
        } else {
          // PLoT validated but didn't return full graph — apply locally
          if (applyLocally(localApply)) markFreshnessDirty()
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
  if (applyLocally(localApply)) markFreshnessDirty()
  return { success: true }
}

/**
 * Run `localApply` and report whether it moved the graph.
 *
 * Every context-menu mutation that lands is a user model edit, so it dirties the
 * freshness overlay — including `localApply` paths that bare-setState (e.g.
 * insert-factor-between); the mark is idempotent for store actions that already
 * dirty. ⛔ But a store action can REFUSE inside `localApply` and return before
 * touching the graph: the fail-closed structural-delete gate (reason
 * `no_server_graph_hash`) does, and says "Nothing was removed". Marking then
 * would downgrade a retained `fresh` verdict to "cannot confirm" after a gesture
 * whose own toast says nothing changed — and only a NEW analysis clears it.
 * Every store graph write replaces `nodes` and/or `edges`, so identity is the test.
 */
function applyLocally(localApply: () => void): boolean {
  const { nodes, edges } = useCanvasStore.getState()
  localApply()
  const after = useCanvasStore.getState()
  return after.nodes !== nodes || after.edges !== edges
}

/** Mark the freshness overlay dirty (optional-chained for partial test store doubles). */
function markFreshnessDirty(): void {
  useCanvasStore.getState().markAnalysisFreshnessDirty?.()
}
