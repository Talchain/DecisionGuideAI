/**
 * useFocusCamera — the focus/pulse camera seam (F2 fit, F3 lens, F4 pulse fit).
 *
 * Extracted from ReactFlowGraph for the same reason useMeasureThenLayout and
 * useFitViewOnLayoutVersion were: inside a 2000-line component that needs a
 * live ReactFlow provider, this logic could not be exercised end-to-end, and
 * an adversarial review found three real bugs sitting in the untested seam.
 * Behaviour is unchanged by the extraction itself; the handlers are the ones
 * ReactFlowGraph registered before.
 *
 * The decisions stay pure and pinned elsewhere — computeFocusPlan
 * (focusNeighbourhood), nodesComfortablyVisible + readFocusCamera
 * (cameraComfort), cameraDuration (cameraMotion), the lens-end rule
 * (focusLens). This hook only APPLIES them and owns the registrations.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { cameraDuration } from '../utils/cameraMotion'
import { computeFocusPlan } from '../utils/focusNeighbourhood'
import { readFocusCamera, nodesComfortablyVisible } from '../utils/cameraComfort'
import { createFocusFitSuppressor } from '../utils/focusLens'
import { registerFocusHelpers, registerFitNodes } from '../utils/focusHelpers'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export interface FocusCameraHandlers {
  /** Wire to ReactFlow's `onMoveStart` — ends the focus lens on any reframe. */
  onMoveStart: () => void
  /**
   * The same handler registered for the Results panel, returned for the
   * in-component consumers (Alt+V keyboard cycling, the Provenance hub).
   */
  focusNode: (nodeId: string) => void
}

export function useFocusCamera(): FocusCameraHandlers {
  const { getViewport, setCenter, fitView } = useReactFlow()

  // Brief 36 Fix: stabilise ReactFlow function references via refs so the
  // empty-deps callbacks below stay reference-stable.
  const getViewportRef = useRef(getViewport)
  const setCenterRef = useRef(setCenter)
  const fitViewRef = useRef(fitView)
  getViewportRef.current = getViewport
  setCenterRef.current = setCenter
  fitViewRef.current = fitView

  // F1: reduced-motion guard for every imperative camera move below.
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedMotionRef = useRef(prefersReducedMotion)
  reducedMotionRef.current = prefersReducedMotion

  // F3: lets onMoveStart tell focus's OWN fit (keep the lens) apart from every
  // other camera move, including the app's own zoom/fit buttons, which are
  // user actions that reach ReactFlow programmatically (see focusLens).
  const focusFitSuppressorRef = useRef(createFocusFitSuppressor())

  // Focus node handler (for Alt+V validation cycling and Results panel drivers)
  const handleFocusNode = useCallback((nodeId: string) => {
    const store = useCanvasStore.getState()

    // F2 + F3 (graph-visuals): the whole focus decision is the pure
    // computeFocusPlan (pinned in focusNeighbourhood.spec.ts); this handler
    // only applies it — select → dim → conditionally fit.
    // SAME-FRAME RULE (F2/F4): one camera measurement decides BOTH whether to
    // move and, below, the frame to move into — a gate that measures against
    // the panel-aware frame must not hand off to a fit that frames against the
    // full pane, or an occluded target stays occluded after the camera moves.
    const camera = readFocusCamera(getViewportRef.current)
    const plan = computeFocusPlan(nodeId, store.nodes, store.edges, camera)
    if (!plan) return // fail-closed: id not on the canvas

    // Select node WITHOUT pushing to history (navigation-only, not structural change)
    store.selectNodeWithoutHistory(nodeId)

    // F3: transient focus dim — every node OUTSIDE the neighbourhood dims via
    // the same store field BaseNode's dim classes already consume. Cleared by
    // usePathHighlight on deselect/reselect, by the store boundary when the
    // focused node is removed, by an edge focus, and by onMoveStart on any
    // other camera move.
    store.setFocusDim(nodeId, plan.dimNodeIds)

    // F2: fit the node AND its direct neighbours to a readable zoom (capped
    // so it never disorients), rather than centring at the current zoom —
    // focusing from a zoomed-out view used to land on something you couldn't
    // read. No-churn rule: when the whole neighbourhood is already
    // comfortably visible the camera does NOT move (cameraComfort).
    if (plan.moveCamera) {
      const focusNodes = store.nodes.filter((n) => plan.focusNodeIds.has(n.id))
      // F3: this move is focus's own — it must not clear the dim it just set.
      // Armed here rather than inferred from the move's event, so the app's
      // own camera buttons (also programmatic) still end the lens.
      focusFitSuppressorRef.current.begin()
      fitViewRef.current({
        nodes: focusNodes,
        // Same panel-aware frame the no-churn gate just measured against.
        // Falls back to the old bare-number padding only when the camera is
        // unmeasurable — which is exactly when the gate fails open and fits.
        padding: camera?.padding ?? 0.3,
        maxZoom: 1.2,
        duration: cameraDuration(400, reducedMotionRef.current),
      })
    }
  }, [])

  // Focus edge handler (for Results panel drivers)
  const handleFocusEdge = useCallback((edgeId: string) => {
    const store = useCanvasStore.getState()
    const targetEdge = store.edges.find((e) => e.id === edgeId)
    if (!targetEdge) return

    const sourceNode = store.nodes.find((n) => n.id === targetEdge.source)
    const targetNode = store.nodes.find((n) => n.id === targetEdge.target)
    if (!sourceNode || !targetNode) return

    // Calculate midpoint between source and target
    const midX = (sourceNode.position.x + targetNode.position.x) / 2
    const midY = (sourceNode.position.y + targetNode.position.y) / 2

    // Select edge (not in history, just for visual feedback)
    useCanvasStore.setState({
      edges: store.edges.map((e) => ({ ...e, selected: e.id === edgeId })),
    })

    // F3: focusing an EDGE ends any node focus lens. This pans the camera away
    // from the focused node, and the dim must never survive the frame it was
    // built for. Cleared explicitly rather than left to the setCenter's
    // move-start below, because a setCenter that does not actually move the
    // camera emits no move at all. No-op when no focus dim is active.
    useCanvasStore.getState().clearFocusDim()

    // Center viewport on edge midpoint with smooth animation
    const viewport = getViewportRef.current()
    setCenterRef.current(midX, midY, {
      zoom: viewport.zoom,
      duration: cameraDuration(300, reducedMotionRef.current),
    })
  }, [])

  // Register focus helpers for external use (Results panel)
  useEffect(() => {
    return registerFocusHelpers(handleFocusNode, handleFocusEdge)
  }, [handleFocusNode, handleFocusEdge])

  // F4 (graph-visuals): registered multi-node fit — the applied-edit pulse
  // choke point (appliedEditPulse.flush) routes every feeder here so pulse
  // targets are in view before they flash. Fits every target (zoom capped)
  // with the F1 reduced-motion guard, EXCEPT when all targets are already
  // comfortably visible (cameraComfort's pinned no-churn rule) — an applied
  // edit the user can already see must not yank the camera.
  const handleFitNodes = useCallback((nodeIds: readonly string[]) => {
    const store = useCanvasStore.getState()
    const idSet = new Set(nodeIds)
    const targets = store.nodes.filter((n) => idSet.has(n.id))
    if (targets.length === 0) return
    const camera = readFocusCamera(getViewportRef.current)
    if (
      camera &&
      nodesComfortablyVisible(
        targets,
        camera.viewport,
        camera.paneWidth,
        camera.paneHeight,
        camera.insets,
      )
    ) {
      return
    }
    fitViewRef.current({
      nodes: targets,
      // Same panel-aware frame the no-churn gate above measured against (see
      // the SAME-FRAME RULE on FocusCamera.padding). A bare number here framed
      // against the full pane, so a pulse target under an expanded dock got a
      // camera move that left it under the dock. Bare-number fallback only
      // when unmeasurable — the case where the gate already fails open.
      padding: camera?.padding ?? 0.25,
      maxZoom: 1.5,
      duration: cameraDuration(400, reducedMotionRef.current),
    })
  }, [])
  useEffect(() => {
    return registerFitNodes(handleFitNodes)
  }, [handleFitNodes])

  // F3 (graph-visuals): ANY camera move ends the focus lens — the transient
  // dim must never outlive the frame it was built for — EXCEPT the fit focus
  // itself just ordered.
  //
  // This deliberately does NOT filter on the move's event. ReactFlow passes
  // the gesture for a user drag/wheel and null for a programmatic move, but
  // the app's own zoom/reset/fit buttons pan programmatically too: an
  // `if (event)` test swallows them and strands a stale dim over a reframed
  // camera. The suppressor (armed only around focus's own fit) is the correct
  // discriminator. clearFocusDim is a no-op unless a focus dim is active, so
  // ordinary panning stays free of store churn.
  const handleMoveStart = useCallback(() => {
    if (focusFitSuppressorRef.current.consume()) return
    useCanvasStore.getState().clearFocusDim()
  }, [])

  return { onMoveStart: handleMoveStart, focusNode: handleFocusNode }
}

export default useFocusCamera
