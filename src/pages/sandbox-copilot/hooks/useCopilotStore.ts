import { create } from 'zustand'

export type JourneyStage =
  | 'empty'
  | 'building'
  | 'inspector'
  | 'pre-run-blocked'
  | 'pre-run-ready'
  | 'post-run'
  | 'compare'

interface CopilotStore {
  journeyStage: JourneyStage
  panelExpanded: boolean
  selectedElement: string | null
  compareMode: boolean

  setJourneyStage: (stage: JourneyStage) => void
  togglePanel: () => void
  selectElement: (id: string | null) => void
  setCompareMode: (enabled: boolean) => void
}

export const useCopilotStore = create<CopilotStore>((set) => ({
  journeyStage: 'empty',
  panelExpanded: true,
  selectedElement: null,
  compareMode: false,

  setJourneyStage: (stage) => set({ journeyStage: stage }),
  togglePanel: () => set((state) => ({ panelExpanded: !state.panelExpanded })),
  selectElement: (id) => set({ selectedElement: id }),
  setCompareMode: (enabled) => set({ compareMode: enabled }),
}))
