/**
 * Analysis Snapshot Store
 *
 * Zustand store holding the runs the Compare tab's Refinement Journey is
 * built from.
 *
 * ROADMAP 2.113a slice 1 changed WHERE those runs come from. The store itself
 * is still in-memory — it is not written to localStorage or Supabase — but it
 * is now SEEDED from Supabase (`hydrateFromPersisted`), which is what makes
 * the journey survive a reload and, on the deployed V5 path, exist at all:
 * the session capture gate at `canvas/store.ts` `resultsComplete` requires a
 * `rawV2Response`, and the live results-hydration applicator passes null for
 * it (`v5/applyV5State.ts:1023`, "V5 carries no V2 envelope"), so that gate
 * never opened on the real wire.
 */
import { create } from 'zustand'
import type { AnalysisSnapshot } from '../compare-tab/types'

export interface AnalysisSnapshotStoreState {
  snapshots: AnalysisSnapshot[]
}

export interface AnalysisSnapshotActions {
  addSnapshot: (snapshot: AnalysisSnapshot) => void
  hydrateFromPersisted: (persisted: AnalysisSnapshot[]) => void
  getLatest: () => AnalysisSnapshot | null
  getPrevious: () => AnalysisSnapshot | null
  getFirst: () => AnalysisSnapshot | null
  getRunCount: () => number
  clearSnapshots: () => void
}

/**
 * Run identity for dedupe across the two sources.
 *
 * `responseHash` is the analysis response's own hash — the identity the V5
 * hydration path ALREADY uses to decide whether an incoming
 * `analysis_result` is a new run (`applyV5State.ts:1014`, `hash !== prevHash`).
 * Reusing it means the Compare tab and the results panel agree on what "the
 * same run" means instead of each inventing an answer.
 *
 * Falls back to `runId` when a run carries no response hash, so an unhashed
 * run is never silently merged into another one. (Live: 773/773 persisted
 * runs carry `enrichment.response_hash`; the fallback is for malformed rows.)
 */
function runIdentity(snapshot: AnalysisSnapshot): string {
  return snapshot.responseHash && snapshot.responseHash.length > 0
    ? `hash:${snapshot.responseHash}`
    : `run:${snapshot.runId}`
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

    /**
     * Seed the journey from persisted `run_analysis` facts, keeping any
     * session-captured run the persisted set does not already contain.
     *
     * MERGE RULES, and why each one is what it is:
     *
     * 1. PERSISTED WINS ON A COLLISION. When a session snapshot and a
     *    persisted row describe the same run (same `responseHash`), the
     *    persisted one is kept. It carries the durable `runId` and the
     *    `aag_v1` hash, so the list stays internally consistent across
     *    re-hydrations; the session copy's only advantage is its graph-derived
     *    fields, and preferring it would make the SAME run change identity
     *    between a fresh load and a reload.
     *
     * 2. SESSION SNAPSHOTS ARE LAYERED ON TOP, NOT DISCARDED. A direct-run
     *    path still captures them, and a run that has not reached the DB yet
     *    must not vanish from the tab.
     *
     * 3. THE LIST IS SORTED BY TIMESTAMP, then renumbered 1..N. Sorting is
     *    what lets rule 2 hold without assuming session runs are always the
     *    newest.
     *
     * 4. ⚠ NO HASH FAMILY IS MIXED INTO A COMPARISON. The merged list can
     *    legitimately hold both sources, whose `graphHash` values come from
     *    DIFFERENT regimes and are not comparable. That is handled where the
     *    comparison happens — `detectStructureChange` refuses a cross-source
     *    hash comparison — NOT by refusing to merge. See types.ts
     *    `SnapshotSource`.
     */
    hydrateFromPersisted: (persisted) => {
      set(state => {
        const seen = new Set(persisted.map(runIdentity))
        const sessionOnly = state.snapshots.filter(
          s => s.source === 'session' && !seen.has(runIdentity(s)),
        )
        const merged = [...persisted, ...sessionOnly].sort((a, b) =>
          a.timestamp === b.timestamp ? 0 : a.timestamp < b.timestamp ? -1 : 1,
        )
        return {
          snapshots: merged.map((s, i) => ({ ...s, runNumber: i + 1 })),
        }
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
