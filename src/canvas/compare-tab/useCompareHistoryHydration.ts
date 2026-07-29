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

  // One in-flight read at a time, and never a setState after unmount.
  const activeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scenarioId) return

    const key = `${scenarioId}::${lastResultHash ?? ''}`
    if (activeKeyRef.current === key) return
    activeKeyRef.current = key

    let cancelled = false

    void (async () => {
      try {
        // Guest / signed-out: no read, no error, existing empty state.
        const { userId } = await getSessionIdentity()
        if (cancelled || !userId) return

        const rows = await listPersistedAnalysisRuns(scenarioId, MAX_PERSISTED_RUNS)
        if (cancelled || rows.length === 0) return

        // Events come from the scenario row the canvas already hydrated —
        // read at USE time, not captured in the effect's dependency list, so
        // a late events hydration cannot re-trigger the network read.
        const events = (useCanvasStore.getState()._hydratedEvents ?? []) as ScenarioEvent[]
        const snapshots = buildSnapshotsFromPersistedRuns(rows, events)
        if (cancelled || snapshots.length === 0) return

        useAnalysisSnapshotStore.getState().hydrateFromPersisted(snapshots)
      } catch (err) {
        // Degrade to the tab's existing empty state. Reset the key so a later
        // render can retry rather than latching the failure forever.
        activeKeyRef.current = null
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
