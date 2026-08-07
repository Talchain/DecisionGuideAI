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
 * Register focus implementations (called by ReactFlowGraph on mount).
 *
 * Returns an ownership-guarded unregister: it only clears the impls if this
 * registration is still the active one, so a remount's stale cleanup can
 * never null a newer registration (same lifecycle rule as
 * canonicalRunRegistry and guidanceStore's conversation callbacks).
 */
export function registerFocusHelpers(
  focusNode: FocusNodeFn,
  focusEdge: FocusEdgeFn
): () => void {
  focusNodeImpl = focusNode
  focusEdgeImpl = focusEdge
  return () => {
    if (focusNodeImpl === focusNode) {
      focusNodeImpl = null
      focusEdgeImpl = null
    }
  }
}

type FitNodesFn = (nodeIds: readonly string[]) => void
let fitNodesImpl: FitNodesFn | null = null

/**
 * Register the multi-node fit (F4 — called by ReactFlowGraph on mount).
 * Same ownership-guarded unregister rule as registerFocusHelpers.
 */
export function registerFitNodes(fitNodes: FitNodesFn): () => void {
  fitNodesImpl = fitNodes
  return () => {
    if (fitNodesImpl === fitNodes) fitNodesImpl = null
  }
}

/**
 * F4 (graph-visuals, Paul-ratified): fit the viewport so EVERY given node
 * is visible — called by the applied-edit pulse choke point
 * (appliedEditPulse's flush) so off-screen targets are brought into view
 * before they pulse, for every feeder (applyPatch, applyV5State, the
 * What-changed chip). The registered implementation (ReactFlowGraph)
 * applies the cameraComfort no-churn rule — no camera move when every
 * target is already comfortably visible — and honours
 * prefers-reduced-motion (F1). Selection/inspector hijack stays banned.
 * Fail-closed: returns false (no-op) when the canvas is not mounted.
 */
export function fitNodesOnCanvas(nodeIds: readonly string[]): boolean {
  if (!fitNodesImpl || nodeIds.length === 0) return false
  fitNodesImpl(nodeIds)
  return true
}

/**
 * Unregister focus implementations unconditionally.
 * @deprecated Use the unregister function returned by registerFocusHelpers —
 * this unconditional clear can null a newer host's registration.
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

/**
 * Parity P1 (audit: broken-function) — universal model-target resolver.
 *
 * Guidance items and Strengthen recommendations carry ids that may be a
 * canvas node id, a canvas edge id, OR a PLoT edge id (often the synthetic
 * `${source}->${target}` form) that no canvas element carries verbatim.
 * focusExistingTarget(id, 'node') silently no-ops on those — the audit's
 * "Focus on canvas does nothing" class of dead buttons.
 *
 * Resolution order (fail-closed, returns false when nothing focusable):
 *  1. exact canvas node id
 *  2. exact canvas edge id
 *  3. arrow-form edge id: resolve endpoints to the real canvas edge,
 *     else fall back to whichever endpoint node exists
 *  4. producer edge id stashed on edge.data (edge_id / plot_edge_id)
 */
export function focusModelTarget(targetId: string): boolean {
  if (!targetId) return false
  const { nodes, edges } = useCanvasStore.getState()
  if (nodes.some((n) => n.id === targetId)) {
    focusByTarget(targetId, 'node')
    return true
  }
  if (edges.some((e) => e.id === targetId)) {
    focusByTarget(targetId, 'edge')
    return true
  }
  const parts = targetId.split(/->|\u2192/)
  if (parts.length === 2) {
    const [from, to] = parts.map((x) => x.trim())
    const edge = edges.find((e) => e.source === from && e.target === to)
    if (edge) {
      focusByTarget(edge.id, 'edge')
      return true
    }
    const endpoint = [from, to].find((id) => nodes.some((n) => n.id === id))
    if (endpoint) {
      focusByTarget(endpoint, 'node')
      return true
    }
  }
  const byData = edges.find((e) => {
    const d = e.data as Record<string, unknown> | undefined
    return d?.edge_id === targetId || d?.plot_edge_id === targetId
  })
  if (byData) {
    focusByTarget(byData.id, 'edge')
    return true
  }
  return false
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
