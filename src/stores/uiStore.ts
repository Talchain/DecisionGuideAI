/**
 * UI Store — Cross-component UI state (Zustand)
 *
 * E1: Enables programmatic tab switching from results components
 * (tornado chart, driver rows) to the Model tab.
 *
 * D2: Hover highlight state for bidirectional canvas-panel linking.
 */
import { create } from 'zustand'

/** Must match OutputsDockTab in OutputsDock.tsx exactly */
export type OutputTab = 'results' | 'compare' | 'diagnostics' | 'journey'

export interface UIStoreState {
  /** Current active tab in the OutputsDock (synced bidirectionally) */
  activeOutputTab: OutputTab
  /** D2: Element ID currently hovered in a panel (for canvas highlight) */
  hoveredElementId: string | null
}

export interface UIStoreActions {
  setActiveOutputTab: (tab: OutputTab) => void
  setHoveredElementId: (id: string | null) => void
}

export const useUIStore = create<UIStoreState & UIStoreActions>((set) => ({
  activeOutputTab: 'results',
  hoveredElementId: null,

  setActiveOutputTab: (tab) => set({ activeOutputTab: tab }),
  setHoveredElementId: (id) => set({ hoveredElementId: id }),
}))

// Selectors
export const selectActiveOutputTab = (s: UIStoreState) => s.activeOutputTab
export const selectHoveredElementId = (s: UIStoreState) => s.hoveredElementId
