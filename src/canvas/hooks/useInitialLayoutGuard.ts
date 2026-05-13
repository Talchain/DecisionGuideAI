import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
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
 * Key properties:
 *  - Detection is position-spread based, not source-path based, so it
 *    works for every load path without changes to the store.
 *  - Graphs with meaningful saved positions are not disturbed.
 *  - Locked nodes are ignored by the spread check and are preserved by
 *    `layoutGraph` itself.
 *  - Identity key includes a structural hash of node + edge ids, so a
 *    scenario whose graph structure changes is re-evaluated even if its
 *    scenario id is unchanged.
 *  - Only keys for which the guard has actually fired are remembered.
 *    A graph that evaluates as meaningful today can still trigger the
 *    guard later if its positions become stacked.
 *  - Never calls `applyLayout` directly — only `setPendingLayout(true)`.
 *    The existing measurement pipeline owns the actual layout run.
 */
export function useInitialLayoutGuard(): void {
  const pendingLayout = useCanvasStore((s) => s.pendingLayout)
  const layoutInProgress = useCanvasStore((s) => s.layoutInProgress)
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const setPendingLayout = useCanvasStore((s) => s.setPendingLayout)

  const firedKeysRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (pendingLayout || layoutInProgress) return
    if (nodes.length === 0) return

    const key = getGraphIdentityKey(currentScenarioId, nodes, edges)
    if (firedKeysRef.current.has(key)) return

    if (graphNeedsInitialLayout(nodes)) {
      firedKeysRef.current.add(key)
      setPendingLayout(true)
    }
  }, [pendingLayout, layoutInProgress, currentScenarioId, nodes, edges, setPendingLayout])
}
