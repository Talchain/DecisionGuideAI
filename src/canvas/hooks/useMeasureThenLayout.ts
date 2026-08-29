import { useEffect, useRef } from 'react'
import { useNodesInitialized, useStore as useReactFlowStore } from '@xyflow/react'
import { useCanvasStore } from '../store'
import {
  evaluateMeasurementGate,
  allUnlockedNodesMeasured,
} from '../utils/measureLayoutGate'
import { LAYOUT_MEASUREMENT_FALLBACK_MS } from '../utils/nodeLayoutConstants'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'

/**
 * Measure-then-layout effect (D2 of the layout-stabilisation brief).
 *
 * Gating logic lives in `evaluateMeasurementGate` (pure, unit-tested in
 * measureLayoutGate.spec.ts). This hook glues the decision to
 * setTimeout / applyLayout / cleanup. The captured layoutRequestId is
 * passed to applyLayout, which silently drops the call if the store has
 * moved past it — a fast second draft arriving before the first laid
 * out is correctly superseded.
 *
 * Auto-triggered failures route through handleLayoutWithRecovery so the
 * existing layoutProgressStore + retry-banner UX surfaces them, matching
 * how manual triggers (toolbar, command palette) already report failures.
 *
 * 2026-05-14 P0 fix: the fallback timer uses a **deadline ref** so it
 * survives effect re-runs. The previous fresh-timer-per-effect pattern was
 * starved in real browser environments where React Flow re-emits
 * `nodeLookup` (forcing this effect to re-run) faster than the fallback
 * timeout — every cleanup cancelled the pending timer before it could fire,
 * so layout never ran on a fresh V5 inline draft. The deadline is set once
 * when the gate first reports `'wait-with-fallback'` and cleared when it
 * leaves that state; subsequent effect re-runs schedule a timer for the
 * *remaining* time relative to that deadline rather than restarting it.
 *
 * Must be called inside a ReactFlowProvider (uses React Flow hooks).
 */
export function useMeasureThenLayout(): void {
  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const layoutRequestId = useCanvasStore((s) => s.layoutRequestId)
  const storeNodes = useCanvasStore((s) => s.nodes)
  const applyLayout = useCanvasStore((s) => s.applyLayout)
  const nodesInitialized = useNodesInitialized()
  const nodeLookup = useReactFlowStore((s) => s.nodeLookup)

  // Deadline (ms since epoch) for the fallback timer; survives effect re-runs.
  const fallbackDeadlineRef = useRef<number | null>(null)

  // True while a committed layout is known to have been computed against
  // DEFAULT_NODE_HEIGHT for at least one node. Cleared by the corrective pass
  // below, and by any later layout that ran with complete measurement.
  const laidOutWithFallbackRef = useRef(false)

  useEffect(() => {
    const measured = allUnlockedNodesMeasured(storeNodes, nodeLookup)

    const decision = evaluateMeasurementGate({
      pendingLayout,
      layoutInProgress,
      nodesInitialized,
      storeNodes,
      allUnlockedNodesMeasured: measured,
    })

    // ⭐ THE FALLBACK LAYOUT IS NOT THE FINAL ANSWER.
    //
    // When the fallback timer fires, `layoutGraph` runs against
    // DEFAULT_NODE_HEIGHT for every unmeasured node. It sizes each canonical
    // row as (tallest card in the row + layerSpacing), so a uniform fallback
    // height produces a uniform row band, and every card taller than that band
    // overlaps the row beneath it. Before this correction that state was
    // TERMINAL: nothing re-ran layout when the real heights landed a moment
    // later, so the graph stayed overlapped until the user found Auto-arrange.
    //
    // The moment measurement completes, lay out once more against real heights.
    // Guarded on `!pendingLayout` because a pending request means the ordinary
    // path below is already about to lay out with those same measurements — the
    // flag is cleared there rather than corrected here, so the two cannot both
    // fire for one arrival.
    if (
      laidOutWithFallbackRef.current &&
      measured &&
      !layoutInProgress &&
      !pendingLayout
    ) {
      laidOutWithFallbackRef.current = false
      handleLayoutWithRecovery(() => applyLayout({ skipHistory: true }))
      return
    }

    if (decision === 'idle' || decision === 'blocked') {
      fallbackDeadlineRef.current = null
      return
    }

    const capturedId = layoutRequestId

    if (decision === 'run-now') {
      fallbackDeadlineRef.current = null
      // This layout has real heights, so there is nothing left to correct.
      laidOutWithFallbackRef.current = false
      handleLayoutWithRecovery(() =>
        applyLayout({ skipHistory: true, requestId: capturedId }),
      )
      return
    }

    // 'wait-with-fallback' — deadline-based safety fallback that survives
    // effect re-renders.
    if (fallbackDeadlineRef.current === null) {
      fallbackDeadlineRef.current = Date.now() + LAYOUT_MEASUREMENT_FALLBACK_MS
    }
    const remaining = Math.max(0, fallbackDeadlineRef.current - Date.now())
    const timer = setTimeout(() => {
      // Deliberately NOT DEV-gated. This warning marks a layout computed
      // against DEFAULT_NODE_HEIGHT, which is the state that produced the
      // shipped canvas overlap. It was DEV-only, so production was silent
      // about a permanently broken layout — which is how it survived to a
      // deployed build. The corrective pass below should follow it; a
      // fallback warning with no correction after it is the signal to chase.
      console.warn(
        '[layout] proceeding with fallback heights — some nodes not yet measured',
      )
      fallbackDeadlineRef.current = null
      // Committed against fallback heights — mark it for correction.
      laidOutWithFallbackRef.current = true
      handleLayoutWithRecovery(() =>
        applyLayout({ skipHistory: true, requestId: capturedId }),
      )
    }, remaining)
    return () => clearTimeout(timer)
  }, [
    pendingLayout,
    layoutInProgress,
    layoutRequestId,
    nodesInitialized,
    nodeLookup,
    storeNodes,
    applyLayout,
  ])
}
