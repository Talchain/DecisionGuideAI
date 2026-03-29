/**
 * Analysis Snapshot Store
 *
 * Session-scoped Zustand store that persists lightweight snapshots
 * after each analysis run. Used by the Compare tab's Refinement Journey
 * to track recommendation and model quality evolution.
 *
 * Not persisted to localStorage or Supabase — session-scoped only.
 */
import { create } from 'zustand'
import type { AnalysisSnapshot } from '../compare-tab/types'

export interface AnalysisSnapshotStoreState {
  snapshots: AnalysisSnapshot[]
}

export interface AnalysisSnapshotActions {
  addSnapshot: (snapshot: AnalysisSnapshot) => void
  getLatest: () => AnalysisSnapshot | null
  getPrevious: () => AnalysisSnapshot | null
  getFirst: () => AnalysisSnapshot | null
  getRunCount: () => number
  clearSnapshots: () => void
}

export const useAnalysisSnapshotStore = create<AnalysisSnapshotStoreState & AnalysisSnapshotActions>(
  (set, get) => ({
    snapshots: [],

    addSnapshot: (snapshot) => {
      set(state => {
        // Enforce sequential 1-indexed runNumber regardless of caller
        const enforced = { ...snapshot, runNumber: state.snapshots.length + 1 }
        return { snapshots: [...state.snapshots, enforced] }
      })
    },

    getLatest: () => {
      const { snapshots } = get()
      return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
    },

    getPrevious: () => {
      const { snapshots } = get()
      return snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
    },

    getFirst: () => {
      const { snapshots } = get()
      return snapshots.length > 0 ? snapshots[0] : null
    },

    getRunCount: () => get().snapshots.length,

    clearSnapshots: () => set({ snapshots: [] }),
  })
)

// ---------------------------------------------------------------------------
// Selectors (standalone for use with useShallow or direct subscription)
// ---------------------------------------------------------------------------

export const selectSnapshots = (state: AnalysisSnapshotStoreState) => state.snapshots
export const selectSnapshotCount = (state: AnalysisSnapshotStoreState) => state.snapshots.length
