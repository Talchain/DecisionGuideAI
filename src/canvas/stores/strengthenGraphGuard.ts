/**
 * ⭐ D1 — the canvas side of `strengthenStore`'s foreign-target guard (DL #72 5894237381).
 *
 * Installs the graph context the store judges phase-3 targets against, and re-runs `pruneForeignTargets` whenever the
 * graph or the decision on screen changes, so a record persisted under this decision for another model's element is
 * cleaned as soon as this decision's graph is loaded (the cold-reload half of R3-B's served counterexample, 5894061171).
 * Installed and uninstalled by the canvas mount effect that rehydrates guidance.
 *
 * ⚠ "THE GRAPH ON SCREEN IS THIS DECISION'S" IS TRACKED, NOT ASSUMED (PR Review on #2317, 5894785604). A switch can
 * be ID-FIRST: `currentScenarioId` moves to the new decision while the OLD model's nodes are still on the canvas, and
 * the new graph arrives later. Judging then would read the old nodes as the new decision's graph. So a decision is
 * judged only once a graph has ARRIVED since it became current (the id and a new node list in one update, or a node
 * list after the id), and never while its boot read is still in flight (`useBootGraphReadStore`: `reading`).
 *
 * ⚠ AND EXISTENCE IS EXACT: `resolveModelTarget(…, { endpointFallback: false })`. A link is not on this canvas because
 * one of its ends is — the focus fallback is for taking a reader somewhere, not for answering "does it exist".
 */
import { useCanvasStore } from '../store'
import { useBootGraphReadStore } from '../hydrate/bootGraphRead'
import { resolveModelTarget } from '../utils/focusHelpers'
import { setStrengthenGraphContext, useStrengthenStore } from './strengthenStore'

export function installStrengthenGraphGuard(): () => void {
  const initial = useCanvasStore.getState()
  // The graph on screen at mount is the current decision's (the boot restored it for that decision).
  let loadedFor: string | null = initial.nodes.length > 0 ? (initial.currentScenarioId ?? null) : null

  setStrengthenGraphContext(() => {
    const s = useCanvasStore.getState()
    const scenarioId = s.currentScenarioId ?? null
    const readInFlight = scenarioId !== null &&
      useBootGraphReadStore.getState().byScenario[scenarioId]?.state === 'reading'
    return {
      scenarioId,
      graphReady: s.nodes.length > 0 && loadedFor === scenarioId && !readInFlight,
      targetExists: (targetId: string) =>
        resolveModelTarget(targetId, s.nodes, s.edges as never, { endpointFallback: false }) !== null,
    }
  })
  useStrengthenStore.getState().pruneForeignTargets()

  const unsubscribe = useCanvasStore.subscribe((state, prev) => {
    const scenarioMoved = state.currentScenarioId !== prev.currentScenarioId
    const graphMoved = state.nodes !== prev.nodes || state.edges !== prev.edges
    if (!scenarioMoved && !graphMoved) return
    if (scenarioMoved) {
      // ID-first switch: the old graph is still on screen, so the new decision is not judged until its graph arrives.
      loadedFor = graphMoved && state.nodes.length > 0 ? (state.currentScenarioId ?? null) : null
    } else if (loadedFor === null && state.nodes.length > 0) {
      loadedFor = state.currentScenarioId ?? null
    }
    useStrengthenStore.getState().pruneForeignTargets()
  })
  // A boot read settling lifts the `reading` gate on a graph that has already arrived, so re-judge then too.
  const unsubscribeRead = useBootGraphReadStore.subscribe(() => useStrengthenStore.getState().pruneForeignTargets())
  return () => {
    unsubscribe()
    unsubscribeRead()
    setStrengthenGraphContext(null)
  }
}
