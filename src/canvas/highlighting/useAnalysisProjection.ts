/**
 * useAnalysisProjection — drives the analysisHighlight store slice from the V7
 * evidence disclosure's open/view state (the analysis-graph projection).
 *
 * When the user views the Flip-risks tab, the resolvable fragile edges are
 * marked on the canvas; the Drivers tab marks the resolvable driver nodes.
 * Closing the disclosure, or switching to any other view, clears the marks.
 *
 * Resolution reads the LIVE canvas nodes/edges via getState() at the moment the
 * view changes — it deliberately does NOT subscribe to node/edge changes, so a
 * canvas edit does not re-run resolution on every keystroke. The marks are
 * transient ("while viewed"); a fresh analysis run flows in as new `evidence`,
 * which re-runs the effect.
 *
 * Honesty: only ids that resolve to a real canvas element are marked
 * (see resolveAnalysisTargets). Unmount clears, so no projection outlives the
 * panel.
 */
import { useEffect } from 'react'
import { useCanvasStore } from '../store'
import {
  resolveFragileEdgeIds,
  resolveDriverNodeIds,
  type FlipRiskRef,
} from './resolveAnalysisTargets'

export interface AnalysisProjectionInput {
  /** Which evidence view is active, or null when nothing should project. */
  active: 'flip_risks' | 'drivers' | null
  /** Flip-risk references (consumed only when active === 'flip_risks'). */
  flipRisks: readonly FlipRiskRef[]
  /** Driver canvas focus ids (consumed only when active === 'drivers'). */
  driverFocusIds: readonly (string | undefined)[]
}

export function useAnalysisProjection({
  active,
  flipRisks,
  driverFocusIds,
}: AnalysisProjectionInput): void {
  useEffect(() => {
    const store = useCanvasStore.getState()
    if (active === null) {
      store.clearAnalysisHighlight()
      return
    }
    if (active === 'flip_risks') {
      store.setAnalysisHighlight('flip_risks', {
        edgeIds: resolveFragileEdgeIds(flipRisks, store.edges),
      })
    } else {
      store.setAnalysisHighlight('drivers', {
        nodeIds: resolveDriverNodeIds(driverFocusIds, store.nodes),
      })
    }
    // Cleanup clears on unmount and before every re-run (view change / new run).
    return () => {
      useCanvasStore.getState().clearAnalysisHighlight()
    }
  }, [active, flipRisks, driverFocusIds])
}
