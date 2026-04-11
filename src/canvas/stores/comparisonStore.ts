/**
 * Comparison Store — passive comparison state extracted from useCanvasStore.
 *
 * Owns: comparisonMode, selectedSnapshotsForComparison, currentDecisionRationale,
 * and the simple setters for each.
 *
 * Not owned (remains in useCanvasStore): enterComparisonMode, exitComparisonMode.
 * Those actions write lens atomically alongside comparisonMode. They call
 * useComparisonStore.getState().setComparisonMode() to update this store
 * from the canvas-store orchestrator direction, which is permitted.
 *
 * Do NOT import useCanvasStore from this file. That direction is forbidden by
 * the circular-dependency hard-fail rule in the C3/C4 plan.
 */
import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import type { DecisionRationale, ComparisonResult } from '../snapshots/types'

export interface ComparisonModeState {
  active: boolean
  scenarios: Array<{ nodes: Node[]; edges: Edge<EdgeData>[]; label: string; optionId?: string }>
  labels: string[]
  selectedIndices?: [number, number]
  hasMoreOptions?: boolean
  allOptionsCount?: number
  comparison: ComparisonResult | null
  apiResponse?: {
    base_scenario?: { id: string; name: string; outcome_predictions: Record<string, number> }
    alternative_scenarios?: Array<{ id: string; name: string; outcome_predictions: Record<string, number> }>
    option_comparison?: Array<{ option_id: string; option_label: string; outcome?: { mean: number; p10: number; p50: number; p90: number }; expected_outcome?: number; win_probability?: number }>
    analysis_status?: string
  } | null
}

export interface ComparisonState {
  comparisonMode: ComparisonModeState
  selectedSnapshotsForComparison: string[]
  currentDecisionRationale: DecisionRationale | null
}

export interface ComparisonActions {
  /** Replace the full comparisonMode object. Used by canvas-store enter/exit orchestrators. */
  setComparisonMode: (mode: ComparisonModeState) => void
  /** Update only the selected-indices field inside comparisonMode. */
  setComparisonSelectedIndices: (indices: [number, number]) => void
  /** Set the snapshot ID selection, deduped and capped to the two most recent. No-op on same input. */
  setSelectedSnapshotsForComparison: (snapshotIds: string[]) => void
  /** Set the current decision rationale. */
  setDecisionRationale: (rationale: DecisionRationale | null) => void
  /** Reset every field to initial values. Called from canvas-store resetCanvas and loadScenario. */
  resetComparison: () => void
}

const initialComparisonMode: ComparisonModeState = {
  active: false,
  scenarios: [],
  labels: [],
  selectedIndices: [0, 1],
  hasMoreOptions: false,
  allOptionsCount: 0,
  comparison: null,
  apiResponse: null,
}

const initialComparisonState: ComparisonState = {
  comparisonMode: initialComparisonMode,
  selectedSnapshotsForComparison: [],
  currentDecisionRationale: null,
}

export const useComparisonStore = create<ComparisonState & ComparisonActions>((set, get) => ({
  ...initialComparisonState,

  setComparisonMode: (mode) => {
    set({ comparisonMode: mode })
  },

  setComparisonSelectedIndices: (indices) => {
    set((state) => ({
      comparisonMode: {
        ...state.comparisonMode,
        selectedIndices: indices,
      },
    }))
  },

  setSelectedSnapshotsForComparison: (snapshotIds) => {
    // De-duplicate: keep most recent two unique IDs, maintain order
    const unique = Array.from(new Set(snapshotIds))
    const capped = unique.slice(-2)

    // Ignore no-op re-selects (same IDs in same order)
    const current = get().selectedSnapshotsForComparison
    if (
      capped.length === current.length &&
      capped.every((id, i) => id === current[i])
    ) {
      return
    }

    set({ selectedSnapshotsForComparison: capped })
  },

  setDecisionRationale: (rationale) => {
    set({ currentDecisionRationale: rationale })
  },

  resetComparison: () => {
    set(initialComparisonState)
  },
}))
