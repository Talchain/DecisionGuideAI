/**
 * useScenario — React hook bridging Supabase persistence with the canvas Zustand store.
 *
 * Responsibilities:
 * - Create, load, delete scenarios via scenarioService
 * - Auto-save graph (debounced 1500ms) and framing to Supabase
 * - Expose save status for the UI (saved / saving / error)
 * - Hydrate canvas store from a Supabase row on load
 * - Retry failed saves once after 3 seconds
 *
 * Persistence is gated on auth: when `user.id === 'guest'` (PoC / guest mode),
 * all operations are no-ops and the existing localStorage system continues to work.
 *
 * This hook does NOT replace existing state management — it wires into the
 * canvas Zustand store via selectors and `setState()`.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCanvasStore } from '../canvas/store'
import * as scenarioService from '../services/scenarioService'
import type { ScenarioStage, AnalysisProvenance, AnalysisStatus } from '../types/scenario'
import { hydrateAnalysisFromV2Response } from './hydrateAnalysis'
import type { Edge } from '@xyflow/react'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../canvas/domain/edges'
import { readPersistedGoalConstraints } from '../canvas/utils/persistedGraph'
import { isPersistenceActive as computeIsPersistenceActive } from '../lib/persistenceActive'
import { shouldPersistGraphForScenario } from '../canvas/stores/draftStore'
// P0 2026-08-13 — may this client write `scenarios.graph` at all? Its own module
// so the specs that pin the write MECHANISM can lift the policy and keep proving
// the plumbing. See that file's header for the whole derivation.
import { clientCanWriteReadableGraph } from '../lib/clientGraphWritePolicy'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface UseScenarioReturn {
  // CRUD
  createScenario: (title?: string) => Promise<string>
  loadScenario: (id: string) => Promise<void>
  deleteScenario: (id: string) => Promise<void>

  // Save status
  saveStatus: SaveStatus
  lastSavedAt: number | null
  saveError: string | null

  // Is Supabase persistence active?
  isPersistenceActive: boolean

  // Analysis persistence
  setAnalysisRunning: () => Promise<void>
  resetAnalysisStatus: () => Promise<void>
  persistAnalysisSuccess: (
    analysis: unknown,
    graphHash: string,
    /** T2b: null when the engine did not echo a usable seed — never a fabricated 0. */
    seedUsed: number | null,
    responseHash: string,
    details?: Record<string, unknown>,
    turnId?: string,
  ) => Promise<void>
  persistAnalysisFailure: (
    errorPayload: { code: string; message: string },
    turnId?: string,
  ) => Promise<void>
  persistBrief: (brief: unknown, turnId?: string) => Promise<void>
  setStage: (stage: ScenarioStage, turnId?: string) => Promise<void>
  createSharedBrief: () => Promise<{ slug: string } | null>

  // Graph staleness — true when graph has been edited after the last analysis
  analysisStale: boolean
  clearAnalysisStale: () => void

  // F1: awaitable barrier — flush any pending/dirty debounced graph save so a
  // run dispatched immediately after an edit analyses the CURRENT graph. No-op
  // for guests/inactive persistence; rejects on save failure (caller aborts).
  flushPendingSaves: () => Promise<void>
}

const GRAPH_DEBOUNCE_MS = 1500
const FRAMING_DEBOUNCE_MS = 1500
const RETRY_DELAY_MS = 3000

/**
 * The "have I already saved this?" key for the debounced graph autosave.
 *
 * ONE definition, used by the subscription, the save, the retry, and the
 * post-load priming. It previously existed as four hand-written
 * `JSON.stringify({ nodes, edges })` copies; B3 had to add a third field to
 * the payload, and a copy missed would have meant either a save storm (key
 * never matches) or a silently dropped constraint (key matches when the
 * payload differs).
 */
function graphSaveKey(s: {
  nodes: unknown
  edges: unknown
  goalConstraints: unknown
}): string {
  return JSON.stringify({
    nodes: s.nodes,
    edges: s.edges,
    goalConstraints: s.goalConstraints ?? null,
  })
}

// ---------------------------------------------------------------------------
// Single-owner autosave coordination (Codex findings F1 + F4)
//
// F4 — DOUBLE PIPELINE: useScenario() mounts in BOTH CanvasMVP and OutputsDock.
// Two instances each installed their own store subscriptions and debounce
// timers, so a single edit scheduled TWO independent saves; the DB write has no
// revision check, so a slower stale save could overwrite newer work. The fix is
// ONE writer: a module-level ownership registry. Every mount installs passive
// subscriptions, but only the mount at the head of `activeAutosaveOwners`
// actually persists. Ownership is checked at call time (not install time), so it
// transfers to a surviving mount the instant the owner unmounts — no gap.
//
// F1 — RACE: an authenticated user who edits then presses Analyse within the
// 1500ms debounce window gets analysis of the PREVIOUS graph (a canonical V5 run
// sends only scenario_id; CEE reads its persisted scenario graph). The fix is a
// single awaitable barrier — `flushPendingGraphSave` — awaited before run
// dispatch. It shares the "already persisted" key and the in-flight save promise
// below with the debounced autosave so the two never disagree on cleanliness or
// double-write.
const activeAutosaveOwners: string[] = []
function isAutosaveOwner(id: string): boolean {
  return activeAutosaveOwners.length > 0 && activeAutosaveOwners[0] === id
}

// Shared across every mount AND the flush barrier: the key of the graph payload
// already persisted, and the in-flight graph save (if any). Module-level so the
// pre-analysis flush and the debounced autosave agree on "clean" and never
// double-write. Reset when the last mount unmounts (see the ownership effect).
let sharedLastSavedGraphKey = ''
let inFlightGraphSave: Promise<unknown> | null = null

// Record the in-flight save so the flush barrier can await it, and self-clear
// when it settles. The housekeeping `.finally` chain swallows its own rejection
// (`.catch`) so it never surfaces as an unhandled rejection — the ACTUAL result
// is always awaited by the caller (the autosave try/catch, or the flush
// barrier), which is where a real failure is handled.
function trackInFlightGraphSave(p: Promise<unknown>): void {
  inFlightGraphSave = p
  void p
    .finally(() => {
      if (inFlightGraphSave === p) inFlightGraphSave = null
    })
    .catch(() => {})
}

/**
 * Persist the current canvas graph immediately via the gated write path.
 * Shared by the debounced autosave, its retry, and the flush barrier so there is
 * ONE write code path. Updates the shared "already persisted" key and marks the
 * store clean on success. Rejects (propagates) on failure — callers decide.
 *
 * @returns `true` when a write was performed, `false` when it was SUPPRESSED —
 * either because this client cannot produce CEE-readable bytes at all (P0
 * 2026-08-13, see `clientCanWriteReadableGraph`), or because the scenario's
 * streamed draft has unsettled values (round-2 review R2-N1). Callers that
 * surface a save indicator must not report "saved" for a write that deliberately
 * did not happen — a false indicator is precisely the honesty class this lane
 * polices, and during a terminal `unsettled` state a signed-in user would
 * otherwise see "saved" on every edit while nothing persists, then lose all of it
 * on reload to CEE's commit.
 */
async function persistGraphNow(sid: string): Promise<boolean> {
  // ROADMAP 2.122 round 2 (adversarial review F1) — never persist a graph whose
  // values the UI KNOWS are in progress.
  //
  // A streamed draft renders its structure at ~36 s from a frame stamped
  // `status: in_progress`, ~25 s before the settled values arrive. Writing that
  // graph here creates an unsettled row in `scenarios.graph`; and if drafting then
  // ends without a terminal ingest (Stop, the 130 s timeout, a dead stream), the
  // row is never replaced and the next canvas edit's debounced echo save — which
  // re-reads the store at fire time — writes it back OVER CEE's own settled
  // commit. The review proved that path executable and voided the "bounded to
  // ~24 s" claim it was rowed under.
  //
  // Suppressing at THIS function is deliberate: its own header declares it the ONE
  // write code path, shared by the debounced autosave, its retry and the flush
  // barrier. One derived choke point, no list of call sites to keep in step.
  //
  // Resolves rather than rejects, so the flush barrier treats it as a no-op: a run
  // cannot need this flush, because the run gate is shut for exactly these phases.
  // The store stays dirty, so the debounce re-fires and the settled graph is
  // written the moment the phase clears.
  // P0 (2026-08-13) — the SHAPE question, asked here for THIS function's own
  // answer. The authoritative suppression is at the choke point,
  // `saveGraphViaGatedPath`; see below for why both exist.
  //
  // ⚠ IT WAS HERE FIRST, AND THAT WAS THE DEFECT AN INDEPENDENT REVIEW FOUND.
  // `persistGraphNow` is one of TWO callers of the write function; the other,
  // `lib/loginDraftImport.importGuestDraft`, calls it DIRECTLY and sailed
  // straight past a guard installed at this call site — still writing React Flow
  // bytes into a brand-new scenario on the guest→signed-in onboarding path,
  // proven by execution with the policy shut. A guard at one call site IS the
  // hand-maintained mirror of "all call sites" (trap 12) — which is the argument
  // this function's own header makes, applied one level too shallow.
  //
  // So the AUTHORITATIVE suppression now lives at the choke point.
  //
  // ⚠ AND THIS LINE STAYS TOO — it is not a redundant second guard, and deleting
  // it as one would re-open a different hole. It exists for the R2-N1 contract:
  // this function must answer FALSE so its callers never report "saved" for a
  // write that did not happen. Deriving that answer from the service's return
  // value instead was tried and REVERTED: every spec that mocks `scenarioService`
  // gets `undefined` back, which reads as "suppressed", so a mocked service would
  // silently switch off the honesty contract AND make a real write look
  // suppressed in tests. A guard that a mock can fake is not a guard.
  //
  // Both call the SAME exported predicate, so there is no list to keep in step
  // and trap 12 is satisfied: the objection was to a guard that existed ONLY at a
  // call site, leaving the other call site open — not to a call site also asking
  // the question for its own purposes.
  if (!clientCanWriteReadableGraph()) return false
  if (!shouldPersistGraphForScenario(sid)) return false
  const state = useCanvasStore.getState()
  const key = graphSaveKey(state)
  await scenarioService.saveGraphViaGatedPath(
    sid,
    { nodes: state.nodes, edges: state.edges },
    crypto.randomUUID(),
    undefined,
    state.goalConstraints,
  )
  sharedLastSavedGraphKey = key
  const now = Date.now()
  useCanvasStore.getState().markClean()
  useCanvasStore.setState({ lastSavedAt: now })
  return true
}

/**
 * F1 barrier: flush any pending/dirty debounced graph save and await it, so a
 * run dispatched right after an edit analyses the CURRENT graph.
 *
 * Contract:
 * - Persistence inactive (guests / signed-out) → no-op, resolves immediately.
 *   Their runs carry the graph on the wire and are gated elsewhere.
 * - No active scenario id → no-op resolve.
 * - Graph already persisted (clean) → resolves immediately.
 * - Dirty → saves now, awaits, and REJECTS on failure. A failed flush must NOT
 *   silently proceed to dispatch; the caller aborts the run.
 */
export async function flushPendingGraphSave(isPersistenceActive: boolean): Promise<void> {
  if (!isPersistenceActive) return
  const sid = useCanvasStore.getState().currentScenarioId
  if (!sid) return
  // Await any autosave already mid-flight so we settle on top of it.
  if (inFlightGraphSave) {
    try {
      await inFlightGraphSave
    } catch {
      // A failed in-flight autosave is re-evaluated below: if still dirty we
      // retry the save here and surface its outcome to the caller.
    }
  }
  if (graphSaveKey(useCanvasStore.getState()) === sharedLastSavedGraphKey) return
  const p = persistGraphNow(sid)
  trackInFlightGraphSave(p)
  await p
}

export function useScenario(): UseScenarioReturn {
  const { user, authenticated } = useAuth()
  const navigate = useNavigate()

  // Persistence is active only for real Supabase users, not guest mode.
  // Canonical predicate lives in lib/persistenceActive (shared with the
  // GoalPanel constraint-honesty gate and loginDraftImport — derive, don't mirror).
  const isPersistenceActive = computeIsPersistenceActive(authenticated, user)

  // Canvas store selectors — only scalars/functions that don't create new
  // references on every ReactFlow tick.  nodes/edges/framing are read via
  // getState() inside a store subscription (see below) to avoid subscribing
  // the calling component to high-frequency ReactFlow position/measurement
  // updates, which previously caused an infinite render loop in CanvasMVP.
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Graph staleness — true when graph has been edited after the last analysis
  const [analysisStale, setAnalysisStale] = useState(false)

  // Timer refs for debounce and retry (cleared on unmount)
  const graphSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const framingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track mounted state to avoid setState on unmounted component
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // F4: register this mount in the module-level autosave ownership registry.
  // First-in wins; only the head owner drives the debounced writers. On unmount
  // the id is removed and a surviving mount silently becomes owner. When the
  // last mount unmounts, reset the shared save state so a future canvas session
  // (or a test) starts clean.
  const instanceIdRef = useRef<string>('')
  if (!instanceIdRef.current) {
    instanceIdRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `own_${Math.random().toString(36).slice(2)}`
  }
  useEffect(() => {
    const id = instanceIdRef.current
    activeAutosaveOwners.push(id)
    return () => {
      const i = activeAutosaveOwners.indexOf(id)
      if (i >= 0) activeAutosaveOwners.splice(i, 1)
      if (activeAutosaveOwners.length === 0) {
        sharedLastSavedGraphKey = ''
        inFlightGraphSave = null
      }
    }
  }, [])

  // Track the last saved framing to skip redundant saves (per-instance; only
  // the owner writes framing, so no cross-mount coordination is needed here).
  // The graph "already persisted" key is module-level (sharedLastSavedGraphKey)
  // because the flush barrier must agree with the autosave on cleanliness.
  const lastSavedFramingRef = useRef<string>('')

  // Stable reference to the current scenario ID for use inside timers
  const scenarioIdRef = useRef(currentScenarioId)
  scenarioIdRef.current = currentScenarioId

  // Keep isPersistenceActive in a ref so the subscription callback can read it
  const isPersistenceActiveRef = useRef(isPersistenceActive)
  isPersistenceActiveRef.current = isPersistenceActive

  // -----------------------------------------------------------------------
  // Auto-save graph (subscription-based, debounced 1500ms)
  // Uses useCanvasStore.subscribe to avoid subscribing the component to
  // nodes/edges, which change on every ReactFlow measurement tick.
  // -----------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      // React to nodes/edges changes — and to goalConstraints, which B3 made
      // part of the persisted graph payload. Without the third check a
      // constraint arriving on a turn that did not touch the graph would
      // never reach the database.
      if (
        state.nodes === prevState.nodes &&
        state.edges === prevState.edges &&
        state.goalConstraints === prevState.goalConstraints
      ) return

      const sid = scenarioIdRef.current
      if (!isPersistenceActiveRef.current || !sid) return
      if (!mountedRef.current) return
      // F4: only the owning mount schedules writes.
      if (!isAutosaveOwner(instanceIdRef.current)) return

      const graphSnapshot = graphSaveKey(state)
      if (graphSnapshot === sharedLastSavedGraphKey) return

      // Mark results as stale when graph changes after a completed analysis
      if (state.results.status === 'complete') {
        setAnalysisStale(true)
      }

      if (graphSaveTimerRef.current) clearTimeout(graphSaveTimerRef.current)

      graphSaveTimerRef.current = setTimeout(async () => {
        // This timer has RUN: it is no longer pending, and the unmount
        // best-effort flush must not treat it as though it were. Nulled first,
        // before any early return, so every exit from this callback leaves the
        // ref honest.
        graphSaveTimerRef.current = null
        const saveSid = scenarioIdRef.current
        if (!saveSid || !mountedRef.current) return
        // Re-check ownership + cleanliness at fire time: a flush barrier or the
        // other mount may have persisted this exact graph in the meantime.
        if (!isAutosaveOwner(instanceIdRef.current)) return
        if (graphSaveKey(useCanvasStore.getState()) === sharedLastSavedGraphKey) return

        // P0 (2026-08-13): only announce "Saving…" for a write that can
        // actually be attempted. `persistGraphNow` returns false when the
        // client cannot produce CEE-readable bytes, and the caller below then
        // correctly refuses to claim "saved" — so an ungated transition here
        // would park the TopBar indicator on "Saving…" permanently after every
        // canvas edit. A permanent false-progress indicator is the same
        // honesty class as a false "saved", just pointed the other way.
        if (mountedRef.current && clientCanWriteReadableGraph()) setSaveStatus('saving')

        try {
          const p = persistGraphNow(saveSid)
          trackInFlightGraphSave(p)
          const wrote = await p
          // R2-N1: a suppressed no-op must not read as "saved". Left at 'saving'
          // rather than invented as a new status: the write really is still
          // pending, the store stays dirty, and the debounce re-fires and
          // succeeds the moment the draft settles.
          if (mountedRef.current && wrote) {
            setSaveStatus('saved')
            setLastSavedAt(Date.now())
            setSaveError(null)
          }
        } catch (err) {
          if (mountedRef.current) {
            setSaveStatus('error')
            setSaveError(err instanceof Error ? err.message : 'Save failed')
          }
          // Retry once after 3 seconds
          retryTimerRef.current = setTimeout(async () => {
            const retrySid = scenarioIdRef.current
            if (!retrySid || !mountedRef.current) return
            try {
              const rp = persistGraphNow(retrySid)
              trackInFlightGraphSave(rp)
              const retryWrote = await rp
              if (mountedRef.current && retryWrote) {
                setSaveStatus('saved')
                setLastSavedAt(Date.now())
                setSaveError(null)
              }
            } catch (retryErr) {
              console.error('[useScenario] save retry failed:', retryErr)
            }
          }, RETRY_DELAY_MS)
        }
      }, GRAPH_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (graphSaveTimerRef.current) clearTimeout(graphSaveTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Auto-save framing (subscription-based, debounced 1500ms)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      if (state.currentScenarioFraming === prevState.currentScenarioFraming) return

      const sid = scenarioIdRef.current
      if (!isPersistenceActiveRef.current || !sid) return
      if (!mountedRef.current) return
      // F4: only the owning mount schedules writes.
      if (!isAutosaveOwner(instanceIdRef.current)) return

      const framing = state.currentScenarioFraming
      if (!framing) return

      const framingSnapshot = JSON.stringify(framing)
      if (framingSnapshot === lastSavedFramingRef.current) return

      if (framingSaveTimerRef.current) clearTimeout(framingSaveTimerRef.current)

      framingSaveTimerRef.current = setTimeout(async () => {
        const saveSid = scenarioIdRef.current
        if (!saveSid || !mountedRef.current) return

        try {
          const currentFraming = useCanvasStore.getState().currentScenarioFraming
          if (currentFraming) {
            await scenarioService.saveFraming(saveSid, currentFraming)
            lastSavedFramingRef.current = JSON.stringify(currentFraming)
          }
        } catch {
          if (import.meta.env.DEV) {
            console.warn('[useScenario] Framing save failed')
          }
        }
      }, FRAMING_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (framingSaveTimerRef.current) clearTimeout(framingSaveTimerRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Cleanup all timers on unmount + best-effort flush of pending saves
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      // Best-effort flush: if a debounced graph save is pending, fire it now.
      //
      // ⭐ CORRECTED 2026-08-10 (found by the PR #662 adversarial review;
      // pre-existing). This called `scenarioService.saveGraphViaGatedPath`
      // DIRECTLY. `persistGraphNow`'s own header declares it "the ONE write code
      // path ... one derived choke point, no list of call sites to keep in
      // step" — and this was the call site not in step: it never consulted
      // `shouldPersistGraphForScenario`, so for a signed-in user, navigating
      // away while a kept-unsettled streamed preview stood on the canvas wrote
      // that preview over CEE's committed graph. Exactly the loss the
      // suppression exists to prevent, reached through the one door that
      // skipped it. It now goes through the choke point, so the gate cannot be
      // bypassed here again without deleting the call.
      if (graphSaveTimerRef.current) {
        clearTimeout(graphSaveTimerRef.current)
        // ⭐ And NULL it. The ref was only ever cleared, never nulled, so an
        // already-FIRED debounce still read as "pending" here and this flush
        // fired for a save that had already completed (or had already been
        // suppressed) — a second write of a graph nobody had changed.
        graphSaveTimerRef.current = null
        const sid = scenarioIdRef.current
        if (sid) {
          persistGraphNow(sid).catch((err) => {
            console.error('[useScenario] Unmount graph flush failed:', err)
          })
        }
      }
      if (framingSaveTimerRef.current) {
        clearTimeout(framingSaveTimerRef.current)
        const sid = scenarioIdRef.current
        const f = useCanvasStore.getState().currentScenarioFraming
        if (sid && f) {
          scenarioService.saveFraming(sid, f).catch((err) => {
            console.error('[useScenario] Unmount framing flush failed:', err)
          })
        }
      }
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Title auto-generation from framing goal (C.1b Task 10)
  // Only auto-set once per scenario load — don't overwrite user edits.
  // The ref tracks whether we've already auto-set for the current scenario.
  // -----------------------------------------------------------------------

  const titleAutoSetForScenarioRef = useRef<string | null>(null)

  useEffect(() => {
    // Check on mount and subscribe for changes
    const tryAutoTitle = () => {
      const sid = scenarioIdRef.current
      if (!isPersistenceActiveRef.current || !sid) return
      // F4: only the owning mount writes the auto-title.
      if (!isAutosaveOwner(instanceIdRef.current)) return
      if (titleAutoSetForScenarioRef.current === sid) return

      const framingObj = useCanvasStore.getState().currentScenarioFraming as Record<string, unknown> | null

      const existingTitle = framingObj?.title
      if (existingTitle && typeof existingTitle === 'string' && existingTitle.trim().length > 0) {
        titleAutoSetForScenarioRef.current = sid
        return
      }

      const goal = framingObj?.goal
      if (!goal || typeof goal !== 'string') return

      const autoTitle = goal.length > 60
        ? goal.substring(0, 57) + '...'
        : goal

      titleAutoSetForScenarioRef.current = sid
      scenarioService.saveTitle(sid, autoTitle).catch((err) => {
        console.error('[useScenario] Auto-title save failed:', err)
      })
    }

    tryAutoTitle()

    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      if (
        state.currentScenarioFraming === prevState.currentScenarioFraming &&
        state.currentScenarioId === prevState.currentScenarioId
      ) return
      tryAutoTitle()
    })

    return unsubscribe
  }, [])

  // -----------------------------------------------------------------------
  // Navigation guard — beforeunload (C.1b Task 11)
  // Warn the user when navigating away with pending saves.
  // -----------------------------------------------------------------------

  const isDirty = useCanvasStore((s) => s.isDirty)

  // A committed inspector edit can be queued behind the conversation's
  // in-flight lock with the LOCAL save already complete — autosave clears
  // `isDirty` as soon as the canvas is persisted, which happens well before the
  // turn carrying that edit reaches CEE. Leaving on `isDirty` alone therefore
  // waves the user off with an unsent model change still in the buffer, and
  // the change is gone: the buffer is in-memory. Guard on it too.
  const pendingEmittedEdits = useCanvasStore((s) => s.pendingEmittedEdits)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving' || isDirty || pendingEmittedEdits > 0) {
        e.preventDefault()
        // Required for Chrome — string value is ignored by modern browsers
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus, isDirty, pendingEmittedEdits])

  // -----------------------------------------------------------------------
  // createScenario — insert row + navigate to /scenario/:id
  // -----------------------------------------------------------------------

  const createScenario = useCallback(
    async (title?: string): Promise<string> => {
      if (!isPersistenceActive || !user) {
        throw new Error('Persistence not active')
      }
      const eventId = crypto.randomUUID()
      const row = await scenarioService.createScenario(user.id, eventId, title)
      navigate(`/scenario/${row.id}`)
      return row.id
    },
    [isPersistenceActive, user, navigate],
  )

  // -----------------------------------------------------------------------
  // loadScenario — fetch from Supabase and hydrate canvas store
  // -----------------------------------------------------------------------

  const loadScenario = useCallback(
    async (id: string): Promise<void> => {
      if (!isPersistenceActive) return

      const row = await scenarioService.loadScenario(id)
      if (!row) {
        if (import.meta.env.DEV) {
          console.warn('[useScenario] Scenario not found:', id)
        }
        return
      }

      // The graph JSONB column stores { nodes: Node[], edges: Edge[] }
      const graph = row.graph as { nodes?: unknown[]; edges?: unknown[] } | null
      const graphNodes = (graph?.nodes ?? []) as Parameters<
        ReturnType<typeof useCanvasStore.getState>['hydrateGraphSlice']
      >[0]['nodes']
      // Upgrade persisted edges to strongly-typed Edge<EdgeData>,
      // matching the pattern in store.ts loadScenario
      const rawEdges = (graph?.edges ?? []) as Edge[]
      const graphEdges: Edge<EdgeData>[] = rawEdges.map((edge) => ({
        ...edge,
        data: {
          ...DEFAULT_EDGE_DATA,
          ...((edge.data as Partial<EdgeData> | undefined) ?? {}),
        },
      }))

      // B3: the scenario's persisted hard constraints. Read defensively —
      // this is untyped JSONB and the value feeds the run request.
      const loadedGoalConstraints = readPersistedGoalConstraints(row.graph)

      // Update local refs BEFORE hydrating the store to prevent the
      // subscription callbacks from scheduling a redundant re-save when
      // hydrateGraphSlice fires synchronous store updates. The key MUST
      // include the constraints for the same reason it includes the graph:
      // priming it with a different value than the store is about to hold
      // would schedule an immediate no-op save on every scenario open.
      sharedLastSavedGraphKey = graphSaveKey({
        nodes: graphNodes,
        edges: graphEdges,
        goalConstraints: loadedGoalConstraints,
      })
      lastSavedFramingRef.current = JSON.stringify(row.framing ?? null)

      // Hydrate graph slice (resets history, selection, reseeds IDs).
      // B3: goalConstraints is passed on EVERY load — the value or null. It
      // is not conditional, because "this scenario has no constraint" must
      // overwrite the previous scenario's, not fall through to it.
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: graphNodes,
        edges: graphEdges,
        currentScenarioId: row.id,
        goalConstraints: loadedGoalConstraints,
      })

      // Hydrate framing + stage.
      // Also unconditionally clear analysis freshness fields — hydrateGraphSlice
      // only touches graph/history/selection and does not reset these. Without
      // this reset, switching to a scenario whose analysis_status is not 'ready'
      // (e.g. 'none', 'running', 'failed') would leave analysisStateReady: true
      // and rawV2Response from the previous scenario, causing buildRequest to
      // ship stale analysis on the first turn. If analysis_status IS 'ready',
      // resultsHydrateFromSupabase below overlays the same false/null values.
      useCanvasStore.setState({
        currentScenarioFraming: (row.framing as Record<string, unknown> | null) ?? null,
        currentStage: row.stage,  // A.15: Hydrate lifecycle stage from Supabase
        isDirty: false,
        lastSavedAt: new Date(row.updated_at).getTime(),
        analysisStateReady: false,
        rawV2Response: null,
      })

      if (mountedRef.current) {
        setLastSavedAt(new Date(row.updated_at).getTime())
        setSaveStatus('saved')
        setSaveError(null)
      }

      // Handle interrupted analysis: if analysis_status is 'running',
      // the analysis was interrupted — reset to 'none' (Schema v2.0 §7)
      if (row.analysis_status === 'running') {
        // Fire-and-forget status reset on the server
        scenarioService
          .resetAnalysisStatus(row.id)
          .catch((err) => {
            // Non-critical — the UI already treats it as 'none'
            console.error('[useScenario] Reset interrupted analysis status failed:', err)
          })
      }

      // Hydrate analysis results from Supabase when status is 'ready'
      if (row.analysis_status === 'ready' && row.analysis != null) {
        const hydrated = hydrateAnalysisFromV2Response(
          row.analysis,
          (row.analysis_provenance as AnalysisProvenance) ?? null,
        )

        if (hydrated) {
          useCanvasStore.getState().resultsHydrateFromSupabase(hydrated)

          // Set staleness-detection metadata on the store
          const prov = row.analysis_provenance as AnalysisProvenance | null
          useCanvasStore.setState({
            currentScenarioLastResultHash: hydrated.results.hash ?? null,
            currentScenarioLastRunAt: prov?.analysed_at ?? null,
            currentScenarioLastRunSeed:
              prov?.seed_used != null ? String(prov.seed_used) : null,
          })
        } else if (import.meta.env.DEV) {
          console.warn(
            '[useScenario] Failed to hydrate analysis — invalid V2RunResponse shape',
          )
        }
      }

      // Track 3: Store thread and events on canvas store for consumption by
      // useConversation (hydration) and JourneyTabBody (timeline).
      // These are transient — consumed once, then cleared.
      const rawThread = row.thread as unknown[] | null
      const rawEvents = Array.isArray(row.events) ? row.events : null
      useCanvasStore.setState({
        _hydratedThread: rawThread && Array.isArray(rawThread) && rawThread.length > 0 ? rawThread : null,
        _hydratedEvents: rawEvents,
      })

      // Hydrate error state when analysis previously failed
      if (row.analysis_status === 'failed' && row.analysis_error != null) {
        const errorPayload = row.analysis_error as {
          code?: string
          message?: string
        }
        // Clear stale results state before setting error
        useCanvasStore.setState({
          results: {
            status: 'error',
            progress: 0,
            error: {
              code: errorPayload?.code ?? 'PERSISTED_FAILURE',
              message: errorPayload?.message ?? 'Previous analysis failed',
              canRetry: true,
            },
          },
          runMeta: {
            diagnostics: undefined,
            correlationIdHeader: undefined,
            degraded: undefined,
            ceeReview: null,
            ceeTrace: null,
            ceeError: null,
            ceeReviewV1: null,
            ceeTraceV1: null,
            ceeErrorV1: null,
          },
          currentScenarioLastResultHash: null,
          currentScenarioLastRunAt: null,
          currentScenarioLastRunSeed: null,
        })
      }
    },
    [isPersistenceActive],
  )

  // -----------------------------------------------------------------------
  // deleteScenario
  // -----------------------------------------------------------------------

  const deleteScenario = useCallback(
    async (id: string): Promise<void> => {
      if (!isPersistenceActive) return
      await scenarioService.deleteScenario(id)

      // If we deleted the active scenario, clear the store reference
      if (useCanvasStore.getState().currentScenarioId === id) {
        useCanvasStore.setState({ currentScenarioId: null })
      }
    },
    [isPersistenceActive],
  )

  // -----------------------------------------------------------------------
  // Analysis persistence (C.1b)
  // -----------------------------------------------------------------------

  const setAnalysisRunningCb = useCallback(
    async (): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      await scenarioService.setAnalysisRunning(currentScenarioId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const resetAnalysisStatusCb = useCallback(
    async (): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      await scenarioService.resetAnalysisStatus(currentScenarioId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const clearAnalysisStale = useCallback(() => {
    setAnalysisStale(false)
  }, [])

  // F1: awaitable flush barrier bound to this session's persistence state.
  const flushPendingSaves = useCallback(
    () => flushPendingGraphSave(isPersistenceActive),
    [isPersistenceActive],
  )

  const persistAnalysisSuccess = useCallback(
    async (
      analysis: unknown,
      graphHash: string,
      seedUsed: number | null,
      responseHash: string,
      details?: Record<string, unknown>,
      turnId?: string,
    ): Promise<void> => {
      // Clear staleness when new analysis completes
      setAnalysisStale(false)

      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.storeAnalysis(
        currentScenarioId,
        analysis,
        graphHash,
        seedUsed,
        responseHash,
        eventId,
        details,
        turnId,
      )
    },
    [isPersistenceActive, currentScenarioId],
  )

  const persistAnalysisFailure = useCallback(
    async (
      errorPayload: { code: string; message: string },
      turnId?: string,
    ): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.storeAnalysisFailure(
        currentScenarioId,
        errorPayload,
        eventId,
        turnId,
      )
    },
    [isPersistenceActive, currentScenarioId],
  )

  const persistBrief = useCallback(
    async (brief: unknown, turnId?: string): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.storeBrief(currentScenarioId, brief, eventId, turnId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const setStage = useCallback(
    async (stage: ScenarioStage, turnId?: string): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.setStage(currentScenarioId, stage, eventId, turnId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const createSharedBrief = useCallback(async (): Promise<{
    slug: string
  } | null> => {
    if (!isPersistenceActive || !currentScenarioId) return null
    const result = await scenarioService.createSharedBrief(currentScenarioId)
    return { slug: result.slug }
  }, [isPersistenceActive, currentScenarioId])

  // -----------------------------------------------------------------------
  // Return value (stable via useMemo to prevent unnecessary re-renders)
  // -----------------------------------------------------------------------

  return useMemo(
    () => ({
      createScenario,
      loadScenario,
      deleteScenario,
      saveStatus,
      lastSavedAt,
      saveError,
      isPersistenceActive,
      setAnalysisRunning: setAnalysisRunningCb,
      resetAnalysisStatus: resetAnalysisStatusCb,
      persistAnalysisSuccess,
      persistAnalysisFailure,
      persistBrief,
      setStage,
      createSharedBrief,
      analysisStale,
      clearAnalysisStale,
      flushPendingSaves,
    }),
    [
      createScenario,
      loadScenario,
      deleteScenario,
      saveStatus,
      lastSavedAt,
      saveError,
      isPersistenceActive,
      setAnalysisRunningCb,
      resetAnalysisStatusCb,
      persistAnalysisSuccess,
      persistAnalysisFailure,
      persistBrief,
      setStage,
      createSharedBrief,
      analysisStale,
      clearAnalysisStale,
      flushPendingSaves,
    ],
  )
}
