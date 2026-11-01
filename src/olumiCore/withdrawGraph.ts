import { useCanvasStore } from '../canvas/store'
import { clearAutosave } from '../canvas/store/scenarios'

/**
 * Let go of the model on the canvas, because olumi-core holds none for this scenario (a first draft was set aside with "Not now").
 *
 * What is removed is exactly the graph and the autosave a reload would recover ("Recovered unsaved changes"): the scenario, the
 * thread and everything else the person has are left alone. The write is NOT a person editing: it is raised under the store's
 * external-mutation window in the same `set()`, as the estate's other withdrawals of a graph are (a streamed preview taken back).
 */
export function withdrawGraphFromCanvas(): void {
  useCanvasStore.setState((s) => ({
    nodes: [], edges: [], lastAuthoritativeGraph: null,
    _externalMutationActive: s._externalMutationActive + 1,
  }))
  useCanvasStore.setState((s) => ({ _externalMutationActive: Math.max(0, s._externalMutationActive - 1) }))
  clearAutosave()
}
