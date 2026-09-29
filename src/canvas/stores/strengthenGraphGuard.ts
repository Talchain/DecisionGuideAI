/**
 * ⭐ D1 — the canvas side of `strengthenStore`'s foreign-target guard (DL #72 5894237381).
 *
 * Installs the graph context the store judges phase-3 targets against, and re-runs `pruneForeignTargets` whenever the
 * graph or the decision on screen changes, so a record persisted under this decision for another model's element is
 * cleaned as soon as this decision's graph is loaded (the cold-reload half of R3-B's served counterexample, 5894061171).
 * Installed and uninstalled by the canvas mount effect that rehydrates guidance.
 */
import { useCanvasStore } from '../store'
import { resolveModelTarget } from '../utils/focusHelpers'
import { setStrengthenGraphContext, useStrengthenStore } from './strengthenStore'

export function installStrengthenGraphGuard(): () => void {
  setStrengthenGraphContext(() => {
    const s = useCanvasStore.getState()
    return {
      scenarioId: s.currentScenarioId ?? null,
      graphReady: s.nodes.length > 0,
      targetExists: (targetId: string) => resolveModelTarget(targetId, s.nodes, s.edges as never) !== null,
    }
  })
  useStrengthenStore.getState().pruneForeignTargets()
  const unsubscribe = useCanvasStore.subscribe((state, prev) => {
    if (state.nodes === prev.nodes && state.edges === prev.edges && state.currentScenarioId === prev.currentScenarioId) return
    useStrengthenStore.getState().pruneForeignTargets()
  })
  return () => {
    unsubscribe()
    setStrengthenGraphContext(null)
  }
}
