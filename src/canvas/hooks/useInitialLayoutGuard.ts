import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'
import { getGraphIdentityKey, graphNeedsInitialLayout } from '../utils/graphNeedsInitialLayout'

/**
 * Safety-net: if an existing scenario hydrates into the canvas with all
 * unlocked nodes stacked at (or near) the origin, request a layout pass.
 *
 * This runs alongside the measure-then-layout effect in ReactFlowGraph.
 * Load paths (`loadScenario`, `hydrateGraphSlice`, `importCanvas`, …) do
 * not all call `setPendingLayout(true)`, so a persisted graph with
 * `{x:0,y:0}` positions can land in the store without ever entering the
 * measurement pipeline. This hook detects that and triggers layout once
 * per graph identity.
 *
 * Failure-aware semantics (2026-05-14 P0 fix):
 *   - **`inFlightKeyRef`** records the key the guard most recently fired
 *     for, while a layout attempt is in flight.
 *   - **`completedKeysRef`** records keys whose layout actually succeeded
 *     (observed via `layoutVersion` increment while in-flight).
 *   - **`failedKeysRef`** records keys whose layout failed (observed via
 *     the recovery store flipping to 'error' while in-flight). The user's
 *     explicit Retry click — exposed by `useLayoutProgressStore.retry` —
 *     is the only path that can re-attempt a failed key; the guard does
 *     not auto-loop on it (which would spin forever on a graph the layout
 *     engine genuinely cannot lay out).
 *   - A graph that evaluated as meaningful and later becomes stacked
 *     (positions overwritten to {0,0} somehow) still gets one auto-fire,
 *     because its key never entered any of the three sets.
 *
 * Key properties retained from the original design:
 *   - Detection is position-spread based, not source-path based, so it
 *     works for every load path without changes to the store.
 *   - Graphs with meaningful saved positions are not disturbed.
 *   - Locked nodes are ignored by the spread check and are preserved by
 *     `layoutGraph` itself.
 *   - Identity key includes a structural hash of node + edge ids, so a
 *     scenario whose graph structure changes is re-evaluated even if its
 *     scenario id is unchanged.
 *   - Never calls `applyLayout` directly — only
 *     `setPendingLayout(true, { isFirstLoad: true })`. The existing
 *     measurement pipeline owns the actual layout run. The
 *     `isFirstLoad: true` flag is one of the two first-load entry points
 *     (the other being `applyDraftResult`) that signal layoutGraph to
 *     subtract ANALYSIS_PANEL_WIDTH from the canvas on this first
 *     auto-arrange. See LayoutOptions in `src/canvas/utils/layout.ts`.
 */
export function useInitialLayoutGuard(): void {
  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const setPendingLayout = useCanvasStore((s) => s.setPendingLayout)
  const recoveryStatus = useLayoutProgressStore((s) => s.status)

  const inFlightKeyRef = useRef<string | null>(null)
  const completedKeysRef = useRef<Set<string>>(new Set())
  const failedKeysRef = useRef<Set<string>>(new Set())
  const lastObservedLayoutVersionRef = useRef<number>(0)

  // Promote in-flight → completed when layoutVersion increments past the
  // value we observed when the guard fired. `layoutVersion` is monotonic
  // and only bumps inside `applyLayout`'s success branch.
  useEffect(() => {
    if (layoutVersion <= lastObservedLayoutVersionRef.current) {
      lastObservedLayoutVersionRef.current = layoutVersion
      return
    }

    if (inFlightKeyRef.current !== null) {
      const key = inFlightKeyRef.current
      completedKeysRef.current.add(key)
      // A previously-failed key that succeeds via the explicit Retry path
      // should leave the failed set so it cannot be confused with stuck.
      failedKeysRef.current.delete(key)
      inFlightKeyRef.current = null
    } else {
      const currentKey = getGraphIdentityKey(currentScenarioId, nodes, edges)
      if (failedKeysRef.current.has(currentKey)) {
        failedKeysRef.current.delete(currentKey)
        completedKeysRef.current.add(currentKey)
      }
    }

    lastObservedLayoutVersionRef.current = layoutVersion
  }, [layoutVersion, currentScenarioId, nodes, edges])

  // Move in-flight → failed when the recovery store reports an error
  // while we have a fire outstanding.
  useEffect(() => {
    if (recoveryStatus !== 'error') return
    if (inFlightKeyRef.current === null) return
    const key = inFlightKeyRef.current
    failedKeysRef.current.add(key)
    inFlightKeyRef.current = null
  }, [recoveryStatus])

  useEffect(() => {
    if (pendingLayout || layoutInProgress) return
    if (nodes.length === 0) return

    const key = getGraphIdentityKey(currentScenarioId, nodes, edges)
    if (inFlightKeyRef.current === key) return
    if (completedKeysRef.current.has(key)) return
    if (failedKeysRef.current.has(key)) return

    if (graphNeedsInitialLayout(nodes)) {
      inFlightKeyRef.current = key
      lastObservedLayoutVersionRef.current = layoutVersion
      // `isFirstLoad: true` — this guard fires when a persisted/stacked
      // graph hydrates without going through the normal measurement
      // pipeline. The analysis panel is open by default and the user
      // hasn't interacted yet, so layoutGraph subtracts
      // ANALYSIS_PANEL_WIDTH from the available canvas for this first
      // auto-arrange.
      setPendingLayout(true, { isFirstLoad: true })
    }
  }, [
    pendingLayout,
    layoutInProgress,
    layoutVersion,
    currentScenarioId,
    nodes,
    edges,
    setPendingLayout,
  ])
}
