import { useCanvasStore } from '../store'

// appliedEditPulse — seamlessness R2: when the AI's graph edits land on the
// canvas (accepted patch, auto-applied patch, or V5 server-applied patch),
// the canvas acknowledges it immediately with the SAME 2s highlight ring the
// "Reveal changes" button uses — no click required.
//
// Contract:
// - Coalescing: multiple patches can apply in one turn (the auto-apply loop
//   iterates blocks). setHighlightedNodes REPLACES the set, so naive
//   per-patch pulses clobber each other and earlier clear-timers wipe later
//   highlights. Calls within the coalesce window merge into ONE pulse over
//   the union of targets, with a single clear timer.
// - Fail-closed: ids are filtered against the canvas store at flush time;
//   ids not on the canvas (e.g. removals) never pulse. An all-stale flush
//   writes nothing (never clobbers an existing highlight with emptiness).
// - Pulse only: no selection, no inspector, no viewport pan — the AI must
//   not hijack what the user is doing. The ring itself is static (BaseNode
//   ring-4 / StyledEdge stroke), so it is inherently reduced-motion-safe.

export const PULSE_COALESCE_MS = 100
export const PULSE_DURATION_MS = 2000

export interface PulseTargets {
  nodeIds?: string[]
  edgeIds?: string[]
}

let pendingNodeIds = new Set<string>()
let pendingEdgeIds = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let clearTimer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  flushTimer = null
  const { nodes, edges, setHighlightedNodes, setHighlightedEdges } =
    useCanvasStore.getState()
  // Fail-soft on partial store doubles (same convention as the apply path's
  // optional-chained markAnalysisFreshnessDirty): specs that mock the store
  // without the highlight setters must not crash when a leaked coalesce
  // timer fires after their test body.
  if (
    typeof setHighlightedNodes !== 'function' ||
    typeof setHighlightedEdges !== 'function' ||
    !Array.isArray(nodes) ||
    !Array.isArray(edges)
  ) {
    pendingNodeIds = new Set()
    pendingEdgeIds = new Set()
    return
  }
  const nodeIds = [...pendingNodeIds].filter((id) => nodes.some((n) => n.id === id))
  const edgeIds = [...pendingEdgeIds].filter((id) => edges.some((e) => e.id === id))
  pendingNodeIds = new Set()
  pendingEdgeIds = new Set()
  if (nodeIds.length === 0 && edgeIds.length === 0) return

  setHighlightedNodes(nodeIds)
  setHighlightedEdges(edgeIds)
  if (clearTimer !== null) clearTimeout(clearTimer)
  clearTimer = setTimeout(() => {
    clearTimer = null
    const store = useCanvasStore.getState()
    store.setHighlightedNodes([])
    store.setHighlightedEdges([])
  }, PULSE_DURATION_MS)
}

export function pulseAppliedTargets(targets: PulseTargets): void {
  for (const id of targets.nodeIds ?? []) pendingNodeIds.add(id)
  for (const id of targets.edgeIds ?? []) pendingEdgeIds.add(id)
  if (flushTimer === null) {
    flushTimer = setTimeout(flush, PULSE_COALESCE_MS)
  }
}

/** Test-only: cancel pending timers and clear the coalesce buffers. */
export function __resetAppliedEditPulseForTests(): void {
  if (flushTimer !== null) clearTimeout(flushTimer)
  if (clearTimer !== null) clearTimeout(clearTimer)
  flushTimer = null
  clearTimer = null
  pendingNodeIds = new Set()
  pendingEdgeIds = new Set()
}
