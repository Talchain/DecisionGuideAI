import { create } from 'zustand'
import { useCanvasStore } from '../store'
import type { CanonicalAnalysisView } from '../runView/canonicalAnalysisView'

export const useCanonicalAnalysisViewStore = create<{
  scenarioId: string | null
  view: CanonicalAnalysisView | null
  adopt: (scenarioId: string, view: CanonicalAnalysisView | null) => void
}>(set => ({ scenarioId: null, view: null, adopt: (scenarioId, view) => set({ scenarioId, view }) }))

// READ-derived authority must not survive leaving its scenario, including a new empty canvas.
useCanvasStore.subscribe((state, previous) => {
  if (state.currentScenarioId !== previous.currentScenarioId
    && useCanonicalAnalysisViewStore.getState().scenarioId !== state.currentScenarioId) {
    useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
  }
})
