/**
 * Graph Health Store - Manages graph validation and repair state
 *
 * Extracted from src/canvas/store.ts for better modularity.
 * See docs/STORE_MODULARIZATION_PLAN.md for migration details.
 */
import { create } from 'zustand'
import type { GraphHealth, NeedleMover } from '../validation/types'

export interface GraphHealthState {
  // M4: Graph Health & Repair
  graphHealth: GraphHealth | null
  needleMovers: NeedleMover[]
  // Phase 3: Interaction enhancements (Set for O(1) lookup)
  highlightedNodes: Set<string>
}

export interface GraphHealthActions {
  // Validation actions
  setGraphHealth: (health: GraphHealth | null) => void
  setNeedleMovers: (movers: NeedleMover[]) => void
  // Highlight actions
  setHighlightedNodes: (ids: string[]) => void
  clearHighlightedNodes: () => void
  // Reset
  resetGraphHealth: () => void
}

const initialGraphHealthState: GraphHealthState = {
  graphHealth: null,
  needleMovers: [],
  highlightedNodes: new Set(),
}

export const useGraphHealthStore = create<GraphHealthState & GraphHealthActions>((set) => ({
  ...initialGraphHealthState,

  setGraphHealth: (health) => {
    set({ graphHealth: health })
  },

  setNeedleMovers: (movers) => {
    set({ needleMovers: movers })
  },

  setHighlightedNodes: (ids) => {
    set({ highlightedNodes: new Set(ids) })
  },

  clearHighlightedNodes: () => {
    set({ highlightedNodes: new Set() })
  },

  resetGraphHealth: () => {
    set(initialGraphHealthState)
  },
}))

// Selectors
export const selectGraphHealth = (state: GraphHealthState) => state.graphHealth
export const selectNeedleMovers = (state: GraphHealthState) => state.needleMovers
export const selectHighlightedNodes = (state: GraphHealthState) => state.highlightedNodes
export const selectHasIssues = (state: GraphHealthState) =>
  state.graphHealth !== null && state.graphHealth.issues.length > 0
