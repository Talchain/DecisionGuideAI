/**
 * useEditedSinceRun — N3 (graph-visuals): keep the store's
 * editedSinceRunNodeIds in sync with "current canvas vs latest run snapshot".
 *
 * Mounted once by ReactFlowGraph (like usePathHighlight). Recomputes when the
 * canvas nodes change or a new run lands (runsBus), and writes the id set via
 * setEditedSinceRunNodes (which no-op-skips unchanged sets). BaseNode
 * subscribes to membership and renders the amber corner dot.
 *
 * A fresh run self-clears the dots: the new snapshot equals the current
 * graph, so the diff is empty — no coupling to the freshness verdict needed
 * (the strip stays the single freshness OWNER; this is spatial detail).
 */
import { useEffect, useSyncExternalStore } from 'react'
import { useCanvasStore } from '../store'
import { loadRuns } from '../store/runHistory'
import * as runsBus from '../store/runsBus'
import { diffEditedNodeIds } from '../utils/editedSinceRun'

let runsVersion = 0
const subscribeToRuns = (onStoreChange: () => void) =>
  runsBus.on(() => {
    runsVersion++
    onStoreChange()
  })
const getRunsVersion = () => runsVersion

export function useEditedSinceRun(): void {
  const nodes = useCanvasStore((s) => s.nodes)
  const version = useSyncExternalStore(subscribeToRuns, getRunsVersion)

  useEffect(() => {
    const { setEditedSinceRunNodes } = useCanvasStore.getState()
    // Fail-soft on partial store doubles in specs (same convention as
    // appliedEditPulse's flush guard).
    if (typeof setEditedSinceRunNodes !== 'function') return
    const latest = loadRuns()[0]
    const edited = diffEditedNodeIds(nodes, latest?.graph?.nodes)
    setEditedSinceRunNodes([...edited])
  }, [nodes, version])
}
