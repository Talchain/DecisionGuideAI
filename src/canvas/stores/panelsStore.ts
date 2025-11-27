/**
 * Panels Store - Manages panel visibility state
 *
 * Extracted from src/canvas/store.ts for better modularity.
 * See docs/STORE_MODULARIZATION_PLAN.md for migration details.
 */
import { create } from 'zustand'
import { loadUIPreferences, saveUIPreference } from '../store/uiPreferences'
import { trackResultsViewed, trackIssuesOpened } from '../utils/sandboxTelemetry'

export interface PanelsState {
  // Panel visibility flags
  showResultsPanel: boolean
  showInspectorPanel: boolean
  showTemplatesPanel: boolean
  templatesPanelInvoker: HTMLElement | null
  showDraftChat: boolean
  showIssuesPanel: boolean
  showProvenanceHub: boolean
  showDocumentsDrawer: boolean
  showComparePanel: boolean
}

export interface PanelsActions {
  // Panel actions
  setShowResultsPanel: (show: boolean) => void
  setShowInspectorPanel: (show: boolean) => void
  openTemplatesPanel: (invoker?: HTMLElement) => void
  closeTemplatesPanel: () => void
  setShowDraftChat: (show: boolean) => void
  setShowIssuesPanel: (show: boolean) => void
  setShowProvenanceHub: (show: boolean) => void
  setShowDocumentsDrawer: (show: boolean) => void
  setShowComparePanel: (show: boolean) => void
  // Internal: reset all panels
  resetPanels: () => void
  // Internal: load saved preferences
  loadPanelPreferences: () => void
}

const initialPanelsState: PanelsState = {
  showResultsPanel: false,
  showInspectorPanel: false,
  showTemplatesPanel: false,
  templatesPanelInvoker: null,
  showDraftChat: false,
  showIssuesPanel: false,
  showProvenanceHub: false,
  showDocumentsDrawer: false,
  showComparePanel: false,
}

export const usePanelsStore = create<PanelsState & PanelsActions>((set, get) => ({
  ...initialPanelsState,

  setShowResultsPanel: (show: boolean) => {
    const prev = get().showResultsPanel
    // Track first open for analytics
    if (show && !prev) {
      trackResultsViewed()
    }
    set({ showResultsPanel: show })
    saveUIPreference('showResultsPanel', show)
  },

  setShowInspectorPanel: (show: boolean) => {
    set({ showInspectorPanel: show })
    saveUIPreference('showInspectorPanel', show)
  },

  openTemplatesPanel: (invoker?: HTMLElement) => {
    set({
      showTemplatesPanel: true,
      templatesPanelInvoker: invoker ?? null,
    })
    saveUIPreference('showTemplatesPanel', true)
  },

  closeTemplatesPanel: () => {
    set({
      showTemplatesPanel: false,
      templatesPanelInvoker: null,
    })
    saveUIPreference('showTemplatesPanel', false)
  },

  setShowDraftChat: (show: boolean) => {
    set({ showDraftChat: show })
    saveUIPreference('showDraftChat', show)
  },

  setShowIssuesPanel: (show: boolean) => {
    const prev = get().showIssuesPanel
    // Track first open for analytics
    if (show && !prev) {
      trackIssuesOpened()
    }
    set({ showIssuesPanel: show })
    saveUIPreference('showIssuesPanel', show)
  },

  setShowProvenanceHub: (show: boolean) => {
    set({ showProvenanceHub: show })
    saveUIPreference('showProvenanceHub', show)
  },

  setShowDocumentsDrawer: (show: boolean) => {
    set({ showDocumentsDrawer: show })
    saveUIPreference('showDocumentsDrawer', show)
  },

  setShowComparePanel: (show: boolean) => {
    set({ showComparePanel: show })
    saveUIPreference('showComparePanel', show)
  },

  resetPanels: () => {
    set(initialPanelsState)
  },

  loadPanelPreferences: () => {
    const prefs = loadUIPreferences()
    set({
      showResultsPanel: prefs.showResultsPanel ?? false,
      showInspectorPanel: prefs.showInspectorPanel ?? false,
      showTemplatesPanel: prefs.showTemplatesPanel ?? false,
      showDraftChat: prefs.showDraftChat ?? false,
      showIssuesPanel: prefs.showIssuesPanel ?? false,
      showProvenanceHub: prefs.showProvenanceHub ?? false,
      showDocumentsDrawer: prefs.showDocumentsDrawer ?? false,
      showComparePanel: prefs.showComparePanel ?? false,
    })
  },
}))

// Selectors for common use cases
export const selectShowResultsPanel = (state: PanelsState) => state.showResultsPanel
export const selectShowInspectorPanel = (state: PanelsState) => state.showInspectorPanel
export const selectShowTemplatesPanel = (state: PanelsState) => state.showTemplatesPanel
export const selectShowIssuesPanel = (state: PanelsState) => state.showIssuesPanel
