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
export type OutputTab = 'results' | 'compare' | 'diagnostics' | 'journey' | 'olumi'

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
  /** Monotonic version counter for forceActivateOutputTab. Bumped on every
   *  force-activate call so OutputsDock's sync effect fires even when the
   *  tab value didn't change (e.g. global already 'results' but dock had
   *  another tab persisted in localStorage). */
  activeOutputTabVersion: number
  /** D2: Element ID currently hovered in a panel (for canvas highlight) */
  hoveredElementId: string | null
  /** Task C: Which right-side panel is currently open (mutual exclusion) */
  activeRightPanel: RightPanelMode
  /**
   * Cross-panel handoff: the section ID a navigator wants the Model tab to
   * focus + auto-expand on its next render. Cleared by the consumer once it
   * has acted. Null when no navigation is pending.
   */
  pendingModelTabSection: string | null
}

export interface UIStoreActions {
  setActiveOutputTab: (tab: OutputTab) => void
  /** Force OutputsDock to open AND activate the given tab on the next render,
   *  regardless of whether `activeOutputTab` actually changes value. Used by
   *  auto-dock and Dock-back when we cannot rely on a value-diff to trigger
   *  the sync. */
  forceActivateOutputTab: (tab: OutputTab) => void
  setHoveredElementId: (id: string | null) => void
  /** Open a right panel (closes any other). Pass null to close all. */
  openRightPanel: (mode: RightPanelMode) => void
  /** Close the active right panel */
  closeRightPanel: () => void
  /** Request the Model tab to focus + auto-expand a section on next render. */
  requestModelTabSection: (sectionId: string | null) => void
}

export const useUIStore = create<UIStoreState & UIStoreActions>((set) => ({
  activeOutputTab: 'results',
  activeOutputTabVersion: 0,
  hoveredElementId: null,
  activeRightPanel: null,
  pendingModelTabSection: null,

  setActiveOutputTab: (tab) => set({ activeOutputTab: tab }),
  forceActivateOutputTab: (tab) =>
    set((s) => ({ activeOutputTab: tab, activeOutputTabVersion: s.activeOutputTabVersion + 1 })),
  setHoveredElementId: (id) => set({ hoveredElementId: id }),
  openRightPanel: (mode) => set({ activeRightPanel: mode }),
  closeRightPanel: () => set({ activeRightPanel: null }),
  requestModelTabSection: (sectionId) => set({ pendingModelTabSection: sectionId }),
}))

// Selectors
export const selectActiveOutputTab = (s: UIStoreState) => s.activeOutputTab
export const selectHoveredElementId = (s: UIStoreState) => s.hoveredElementId
export const selectActiveRightPanel = (s: UIStoreState) => s.activeRightPanel
