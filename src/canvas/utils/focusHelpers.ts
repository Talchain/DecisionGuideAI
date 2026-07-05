/**
 * Canvas focus helpers
 *
 * Provides focusNodeById, focusEdgeById, and focusEdgeByEndpoints for external
 * components (like ResultsPanel) to programmatically focus and center canvas elements.
 *
 * Uses a singleton pattern to allow ResultsPanel to call focus without tight coupling.
 */

import { useCanvasStore } from '../store'

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

/**
 * V14: Focus an edge by looking up its real ReactFlow ID from source/target endpoints.
 * Falls back to focusing the node at fallbackNodeId if no matching edge is found.
 *
 * Edge IDs in the canvas are auto-generated (e.g. "e1", "e2") and do NOT match
 * PLoT edge IDs. This function looks up the actual edge by source+target.
 */
export function focusEdgeByEndpoints(
  fromId: string,
  toId: string,
  fallbackNodeId: string
): void {
  const { edges } = useCanvasStore.getState()
  const edge = edges.find(e => e.source === fromId && e.target === toId)
  if (edge) {
    focusEdgeById(edge.id)
  } else {
    focusNodeById(fallbackNodeId)
  }
}

/**
 * M1 Coaching: Target type for deterministic focus resolution
 */
export type FocusTargetType = 'node' | 'edge' | 'factor' | 'option'

/**
 * M1 Coaching: Unified focus handler with deterministic target resolution
 *
 * Resolves target based on type:
 * - node: focusNodeById directly
 * - edge: focusEdgeById directly
 * - factor: treats factor_id as node_id (factors are nodes on canvas)
 * - option: treats option_id as node_id (options are nodes on canvas)
 *
 * Falls back to focusNodeById when type is unknown.
 */
/**
 * Fail-closed focus: verifies the target still exists on the canvas before
 * focusing. Returns false (and does nothing) for stale/unknown ids — result
 * payloads and guidance items can reference elements that were deleted or
 * belong to a recovered session with different ids (live audit finding).
 * Callers should treat `false` as "hide or disable the affordance", never
 * as an error.
 */
export function focusExistingTarget(
  targetId: string,
  targetType?: FocusTargetType
): boolean {
  if (!targetId) return false
  const { nodes, edges } = useCanvasStore.getState()
  const exists = targetType === 'edge'
    ? edges.some((e) => e.id === targetId)
    : nodes.some((n) => n.id === targetId)
  if (!exists) return false
  focusByTarget(targetId, targetType)
  return true
}

export function focusByTarget(
  targetId: string,
  targetType?: FocusTargetType
): void {
  if (!targetId) {
    console.warn('[focusHelpers] focusByTarget called with empty targetId')
    return
  }

  switch (targetType) {
    case 'edge':
      focusEdgeById(targetId)
      break
    case 'node':
    case 'factor':
    case 'option':
    case undefined:
      // All non-edge targets are nodes on the canvas
      focusNodeById(targetId)
      break
    default:
      // Warn about unknown target type but still attempt focus as node
      console.warn(`[focusHelpers] Unknown targetType "${targetType}", defaulting to node focus`)
      focusNodeById(targetId)
      break
  }
}
