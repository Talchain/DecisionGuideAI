/**
 * UI Store — Cross-component UI state (Zustand)
 *
 * E1: Enables programmatic tab switching from results components
 * (tornado chart, driver rows) to the Model tab.
 *
 * D2: Hover highlight state for bidirectional canvas-panel linking.
 *
 * Task C: Right-panel orchestration — only one right-side panel is visible
 * at a time. Opening a panel auto-closes any other open panel.
 */
import { create } from 'zustand'

/** Must match OutputsDockTab in OutputsDock.tsx exactly */
export type OutputTab = 'results' | 'compare' | 'diagnostics' | 'journey'

/**
 * Right-panel modes. Only one right-side panel can be open at a time.
 * - 'results': OutputsDock (analysis, compare, model tabs)
 * - 'provenance': ProvenanceHubTab
 * - 'clarifier': AI Clarifier chat
 * - null: no right panel open
 */
export type RightPanelMode = 'results' | 'provenance' | 'clarifier' | null

export interface UIStoreState {
  /** Current active tab in the OutputsDock (synced bidirectionally) */
  activeOutputTab: OutputTab
  /** D2: Element ID currently hovered in a panel (for canvas highlight) */
  hoveredElementId: string | null
  /** Task C: Which right-side panel is currently open (mutual exclusion) */
  activeRightPanel: RightPanelMode
}

export interface UIStoreActions {
  setActiveOutputTab: (tab: OutputTab) => void
  setHoveredElementId: (id: string | null) => void
  /** Open a right panel (closes any other). Pass null to close all. */
  openRightPanel: (mode: RightPanelMode) => void
  /** Close the active right panel */
  closeRightPanel: () => void
}

export const useUIStore = create<UIStoreState & UIStoreActions>((set) => ({
  activeOutputTab: 'results',
  hoveredElementId: null,
  activeRightPanel: null,

  setActiveOutputTab: (tab) => set({ activeOutputTab: tab }),
  setHoveredElementId: (id) => set({ hoveredElementId: id }),
  openRightPanel: (mode) => set({ activeRightPanel: mode }),
  closeRightPanel: () => set({ activeRightPanel: null }),
}))

// Selectors
export const selectActiveOutputTab = (s: UIStoreState) => s.activeOutputTab
export const selectHoveredElementId = (s: UIStoreState) => s.hoveredElementId
export const selectActiveRightPanel = (s: UIStoreState) => s.activeRightPanel
