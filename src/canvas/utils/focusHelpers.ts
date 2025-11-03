/**
 * Canvas focus helpers
 *
 * Provides focusNodeById and focusEdgeById for external components (like ResultsPanel)
 * to programmatically focus and center canvas elements.
 *
 * Uses a singleton pattern to allow ResultsPanel to call focus without tight coupling.
 */

type FocusNodeFn = (nodeId: string) => void
type FocusEdgeFn = (edgeId: string) => void

let focusNodeImpl: FocusNodeFn | null = null
let focusEdgeImpl: FocusEdgeFn | null = null

/**
 * Register focus implementations (called by ReactFlowGraph on mount)
 */
export function registerFocusHelpers(
  focusNode: FocusNodeFn,
  focusEdge: FocusEdgeFn
) {
  focusNodeImpl = focusNode
  focusEdgeImpl = focusEdge
}

/**
 * Unregister focus implementations (called by ReactFlowGraph on unmount)
 */
export function unregisterFocusHelpers() {
  focusNodeImpl = null
  focusEdgeImpl = null
}

/**
 * Focus and center a node by ID
 * Selects node, centers viewport, applies brief glow
 * Does NOT mutate graph structure
 */
export function focusNodeById(nodeId: string): void {
  if (!focusNodeImpl) {
    console.warn('[focusHelpers] focusNodeById called before ReactFlow mounted')
    return
  }
  focusNodeImpl(nodeId)
}

/**
 * Focus and center an edge by ID
 * Selects edge, centers viewport on midpoint
 * Does NOT mutate graph structure
 */
export function focusEdgeById(edgeId: string): void {
  if (!focusEdgeImpl) {
    console.warn('[focusHelpers] focusEdgeById called before ReactFlow mounted')
    return
  }
  focusEdgeImpl(edgeId)
}
