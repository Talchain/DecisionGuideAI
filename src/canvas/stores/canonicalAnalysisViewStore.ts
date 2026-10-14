import { create } from 'zustand'
import type { CanonicalAnalysisView } from '../runView/canonicalAnalysisView'

export const useCanonicalAnalysisViewStore = create<{
  scenarioId: string | null
  view: CanonicalAnalysisView | null
  adopt: (scenarioId: string, view: CanonicalAnalysisView | null) => void
}>(set => ({ scenarioId: null, view: null, adopt: (scenarioId, view) => set({ scenarioId, view }) }))

// Scenario scoping is at READ/TURN adoption and consumption: useResultsSectionData takes the view only when its scenarioId is the current one.
// No store subscription here — a module-load subscribe broke every spec that mocks useCanvasStore (#2709 CI).
