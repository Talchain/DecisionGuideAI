/**
 * useCompareHistoryHydration — seed the Compare tab from persisted runs.
 *
 * ROADMAP 2.113a slice 1. This hook is the whole data-source swap: no new UI
 * surface, no change to the tab's state machine, no change to what any
 * component renders. The existing render tree (RunSelector, Hero,
 * TrajectorySection, TransitionsSection, CompareFooter) is driven by
 * `analysisSnapshotStore` exactly as before — this fills that store.
 *
 * WHERE IT RUNS. Inside `CompareTabBody`, which `OutputsDock` mounts ONLY
 * while the Compare tab is the active tab. So the read costs nothing until
 * the user opens the tab, and "open Compare" is the moment the history is
 * wanted.
 *
 * WHEN IT RE-READS. On scenario change, and whenever
 * `currentScenarioLastResultHash` moves — which `canvas/store.ts`
 * `resultsComplete` sets on EVERY completion including the V5 path
 * (store.ts:3068). A completed analysis has already been persisted by CEE
 * inside the turn that produced it, so by the time that hash changes the new
 * fact is readable.
 *
 * GUESTS ARE UNCHANGED, AND DELIBERATELY SO. Versions and facts exist only
 * for signed-in-owned scenarios (`v5_handler_facts.user_id` is NULL for guest
 * rows, and `auth.uid() = NULL` is NULL, so RLS returns a guest nothing). The
 * hook checks for a session FIRST and skips the read entirely rather than
 * firing a request that is guaranteed to come back empty. The tab then shows
 * its existing empty/explainer state — never an error.
 *
 * EVERY FAILURE DEGRADES TO THAT SAME EMPTY STATE. A missing grant, an
 * offline client, a malformed row: the Compare tab is a passive, read-only
 * retrospective, and there is no honest error for it to show that the user
 * could act on.
 */
import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useAnalysisSnapshotStore } from '../stores/analysisSnapshotStore'
import { buildSnapshotsFromPersistedRuns } from '../stores/persistedRunSnapshotFactory'
import { listPersistedAnalysisRuns, MAX_PERSISTED_RUNS } from '../../services/analysisRunHistoryService'
import { getSessionIdentity } from '../../lib/supabase'
import type { ScenarioEvent } from '../../types/scenario'

export function useCompareHistoryHydration(): void {
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const lastResultHash = useCanvasStore(s => s.currentScenarioLastResultHash)

  /**
   * The (scenario, result-hash) pair whose read has ALREADY COMPLETED.
   *
   * ⚠ It is set on COMPLETION, never on start — and that ordering is the whole
   * point. Marking it on start looks like the same dedupe and is a trap: React
   * may mount, tear down and re-mount an effect without the deps changing
   * (StrictMode's development double-invoke is the common case). The first
   * pass would then claim the key, its cleanup would cancel the in-flight
   * read, and the second pass would see the key already claimed and do
   * nothing — leaving the tab permanently empty with no error anywhere. That
   * is this programme's dominant defect class: machinery that reads as a
   * guarantee and never executes. Marking on completion cannot produce it;
   * the worst case is one redundant read of a read-only, idempotent query.
   *
   * (StrictMode is NOT enabled in `src/main.tsx` today. The guard is written
   * this way so that enabling it can never silently switch this feature off.)
   */
  const completedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scenarioId) return

    const key = `${scenarioId}::${lastResultHash ?? ''}`
    if (completedKeyRef.current === key) return

    let cancelled = false

    void (async () => {
      try {
        // Guest / signed-out: no read, no error, existing empty state.
        // Deliberately NOT marked complete — a user who signs in mid-session
        // must get their history without a scenario switch to unlatch it.
        const { userId } = await getSessionIdentity()
        if (cancelled || !userId) return

        const rows = await listPersistedAnalysisRuns(scenarioId, MAX_PERSISTED_RUNS)
        if (cancelled) return
        // A completed read that found nothing is still a completed read.
        completedKeyRef.current = key
        if (rows.length === 0) return

        // Events come from the scenario row the canvas already hydrated —
        // read at USE time, not captured in the effect's dependency list, so
        // a late events hydration cannot re-trigger the network read.
        const events = (useCanvasStore.getState()._hydratedEvents ?? []) as ScenarioEvent[]
        const snapshots = buildSnapshotsFromPersistedRuns(rows, events)
        if (cancelled || snapshots.length === 0) return

        useAnalysisSnapshotStore.getState().hydrateFromPersisted(snapshots)
      } catch (err) {
        // Degrade to the tab's existing empty state, and leave the key
        // UNMARKED so a later mount retries rather than latching the failure
        // forever.
        if (import.meta.env.DEV) {
          console.warn('[useCompareHistoryHydration] persisted run read failed', err)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [scenarioId, lastResultHash])
}
