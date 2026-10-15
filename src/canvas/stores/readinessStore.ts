/**
 * Readiness Store — CEE's readiness verdict, READ FROM THE TURN.
 *
 * ⭐ S10/S11 "NO GRAPH OUT OF THE BROWSER" (DL Q2a, 15 Oct 2026). This store used to POST the canvas graph to
 * `/bff/cee/graph-readiness` on mount and on every edit, and keep a second verdict beside the one the turn already
 * carries. That request is deleted. The verdict is now the served `analysis_ready` the turn and the cold read deliver
 * into `useCanvasStore.ceeAnalysisReady`, the same canonical readiness authority (CEE `assessCanonicalAnalysisReadiness`)
 * asked about CEE's own persisted graph:
 *   - `may_run` (three-valued; `'unknown'` kept, never coerced) and `can_run_analysis` = `may_run === true`;
 *   - `readiness_issues[]`, CEE's own repair sentences with their scope and obligation.
 *
 * Fields only the deleted endpoint carried (`readiness_score`, `readiness_level`, `confidence_explanation`,
 * `improvements`, `scaffold_plan`, `blocker_reason`) are ABSENT, never invented: their readers already degrade to
 * the issues or say nothing. Before the first turn there is no verdict (`null`), never "ready".
 *
 * Consumers read via `useReadinessStore(s => s.readiness)` or the thin `useGraphReadiness()` wrapper; the state shape
 * is unchanged, so no consumer changes.
 */
import { create } from 'zustand'
import { useCanvasStore } from '../store'
import type {
  GraphReadiness,
  GraphImprovement,
  ReadinessIssue,
} from '../hooks/useGraphReadiness'

// Re-export types consumers need
export type { GraphReadiness, GraphImprovement }

// ── Store interface ────────────────────────────────────────────────

export interface ReadinessStoreState {
  readiness: GraphReadiness | null
  /** Kept for the state shape; the turn verdict carries no separate auth owner (always null). */
  verdictAuthKey: string | null
  /** Always false: nothing is fetched. */
  loading: boolean
  /** Always null: nothing is fetched, so there is no check that can fail. */
  error: string | null
  /**
   * Always false. The verdict is the turn's own, about CEE's persisted graph, and it is replaced by the next turn's;
   * there is no local model it can lag behind.
   */
  stale: boolean
  /** `Date.now()` when `readiness` was last published from a turn verdict. Null until then. */
  verdictAtMs: number | null
}

export interface ReadinessStoreActions {
  /** Re-read the turn verdict now (no request). */
  refresh: () => void
  /**
   * Begin watching the canvas store's turn verdict. Ref-counted; returns a release function.
   */
  startListening: () => () => void
  /** Reset state AND unsubscribe. */
  reset: () => void
  /** Auth boundary: clear the published verdict; mounted listeners stay. */
  resetForAuth: () => void
}

const initialState: ReadinessStoreState = {
  readiness: null,
  verdictAuthKey: null,
  loading: false,
  error: null,
  stale: false,
  verdictAtMs: null,
}

/**
 * CEE's `readiness_issues[]`, kept exactly as the producer sent them (field-for-field `RouteReadinessBlocker`).
 *
 * ⚠ `[]` IS PRESERVED: "CEE said there is nothing" is not "CEE said nothing". Entries without a usable `message` (the
 * only rendered field) are dropped, but the array's presence survives. `obligation` is never defaulted: an unknown stays
 * unknown rather than becoming a demand (INV-P6).
 */
export function normaliseReadinessIssues(raw: unknown): ReadinessIssue[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter((issue: any) => issue && typeof issue.message === 'string' && issue.message.trim())
    .map((issue: any): ReadinessIssue => ({
      message: issue.message,
      ...(typeof issue.code === 'string' ? { code: issue.code } : {}),
      ...(typeof issue.category === 'string' ? { category: issue.category } : {}),
      ...(typeof issue.repairability === 'string' ? { repairability: issue.repairability } : {}),
      ...(typeof issue.option_id === 'string' ? { option_id: issue.option_id } : {}),
      ...(typeof issue.option_label === 'string' ? { option_label: issue.option_label } : {}),
      ...(typeof issue.factor_id === 'string' ? { factor_id: issue.factor_id } : {}),
      ...(typeof issue.factor_label === 'string' ? { factor_label: issue.factor_label } : {}),
      ...(typeof issue.obligation === 'string' ? { obligation: issue.obligation } : {}),
      ...(typeof issue.waived_by_exclusion === 'boolean' ? { waived_by_exclusion: issue.waived_by_exclusion } : {}),
    }))
}

/**
 * The readiness verdict the TURN served (`analysis_ready`), in the store's shape. `null` before any turn verdict.
 * Only what CEE said: `may_run` and its `readiness_issues`. Nothing is derived from the canvas.
 */
export function readinessFromTurn(analysisReady: unknown): GraphReadiness | null {
  if (analysisReady === null || typeof analysisReady !== 'object') return null
  const raw = analysisReady as Record<string, unknown>
  const mayRun = raw.may_run
  const may_run = typeof mayRun === 'boolean' || mayRun === 'unknown' ? mayRun : undefined
  const readiness_issues = normaliseReadinessIssues(raw.readiness_issues)
  return {
    can_run_analysis: may_run === true,
    ...(may_run !== undefined ? { may_run } : {}),
    ...(readiness_issues !== undefined ? { readiness_issues } : {}),
  }
}

// ── Module-level subscription ──────────────────────────────────────

let unsubCanvasStore: (() => void) | null = null
let listenerRefCount = 0

function publishFromTurn(): void {
  const readiness = readinessFromTurn(useCanvasStore.getState().ceeAnalysisReady)
  useReadinessStore.setState({
    readiness,
    verdictAuthKey: null,
    loading: false,
    error: null,
    stale: false,
    verdictAtMs: readiness === null ? null : Date.now(),
  })
}

export const useReadinessStore = create<ReadinessStoreState & ReadinessStoreActions>((set) => ({
  ...initialState,

  refresh: () => {
    publishFromTurn()
  },

  startListening: () => {
    listenerRefCount++
    if (!unsubCanvasStore) {
      unsubCanvasStore = useCanvasStore.subscribe((state, prevState) => {
        if (state.ceeAnalysisReady !== prevState.ceeAnalysisReady) publishFromTurn()
      })
      publishFromTurn()
    }
    const subscription = unsubCanvasStore
    let released = false
    return () => {
      if (released || subscription !== unsubCanvasStore) return
      released = true
      listenerRefCount--
      if (listenerRefCount <= 0) stopListening()
    }
  },

  resetForAuth: () => {
    set(initialState)
    if (unsubCanvasStore) publishFromTurn()
  },

  reset: () => {
    stopListening()
    set(initialState)
  },
}))

/** Clean up the subscription and module-level state. */
function stopListening(): void {
  listenerRefCount = 0
  if (unsubCanvasStore) {
    unsubCanvasStore()
    unsubCanvasStore = null
  }
  useReadinessStore.setState(initialState)
}

// Selectors
export const selectReadiness = (state: ReadinessStoreState) => state.readiness
export const selectReadinessLoading = (state: ReadinessStoreState) => state.loading
export const selectReadinessError = (state: ReadinessStoreState) => state.error
export const selectReadinessStale = (state: ReadinessStoreState) => state.stale
export const selectReadinessVerdictAtMs = (state: ReadinessStoreState) => state.verdictAtMs

/**
 * ⭐ IS THE RUN GOING TO LEAVE THIS OPTION OUT — and if so, in CEE's words.
 *
 * `waived_by_exclusion` is stamped by CEE (`orchestrator-v5/admission/analysis-admission.ts`); the canvas READS it and
 * never re-derives it. Returns a primitive (a fresh identity would re-render the subscriber for ever): `null` means NOT
 * EXCLUDED; a string means excluded and carries the producer's own sentence (empty when it sent none). An entry with no
 * `option_id` names no option, so it marks none. A stale verdict marks nothing.
 */
export const selectOptionExclusionMessage =
  (optionId: string) =>
  (state: ReadinessStoreState): string | null => {
    if (state.stale) return null
    const issues = state.readiness?.readiness_issues
    if (!Array.isArray(issues)) return null
    for (const issue of issues) {
      if (issue?.waived_by_exclusion === true && issue.option_id === optionId) {
        return typeof issue.message === 'string' ? issue.message : ''
      }
    }
    return null
  }

// ── Test helpers ───────────────────────────────────────────────────

/** @internal — exposed for unit testing. Not part of public API. */
export const __test__ = {
  publishFromTurn,
  getModuleState: () => ({
    listenerRefCount,
    hasSubscription: unsubCanvasStore !== null,
  }),
  resetModuleState: () => {
    stopListening()
  },
}
