import { useEffect } from 'react'
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

  useEffect(() => {
    const decision = evaluateMeasurementGate({
      pendingLayout,
      layoutInProgress,
      nodesInitialized,
      storeNodes,
      allUnlockedNodesMeasured: allUnlockedNodesMeasured(storeNodes, nodeLookup),
    })

    if (decision === 'idle' || decision === 'blocked') return

    const capturedId = layoutRequestId

    if (decision === 'run-now') {
      handleLayoutWithRecovery(() =>
        applyLayout({ skipHistory: true, requestId: capturedId }),
      )
      return
    }

    // 'wait-with-fallback' — bounded measurement-failure safety fallback.
    const timer = setTimeout(() => {
      if (import.meta.env.DEV) {
        console.warn(
          '[layout] proceeding with fallback heights — some nodes not yet measured',
        )
      }
      handleLayoutWithRecovery(() =>
        applyLayout({ skipHistory: true, requestId: capturedId }),
      )
    }, LAYOUT_MEASUREMENT_FALLBACK_MS)
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
