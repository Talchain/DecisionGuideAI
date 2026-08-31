/**
 * useModelEditCanonicalConfirm — the cold read that an EDIT asks for.
 *
 * ⭐ WHY THIS EXISTS (review of #1057, F1). The completion ledger's `committed`
 * phase requires canonical evidence, and the first cut of that work wired the
 * adjudication to `hydrateCanvasFromServer` and called the interface "not dark".
 * It was dark. The complete manifest of that function's callers is three, and
 * none of them is an edit:
 *
 *   1. `useServerGraphHydration` — ONCE per scenario id, at boot, i.e. BEFORE
 *      any attempt exists.
 *   2. `runAbsentGraphRetrySchedule` — armed only when boot returned `absent`
 *      (a scenario with no graph, so nothing to edit).
 *   3. `recoverDraftFromServer` — only when a draft STREAM died.
 *
 * So a user who edited a factor and stayed on the scenario was `receipted` for
 * the life of the page, and the panel would have rendered a permanent in-flight
 * state on every SUCCESSFUL edit. A reload does not rescue it: the ledger is
 * module-scoped and the reload destroys it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT WAS CONSIDERED, AND WHY THIS ONE
 * ─────────────────────────────────────────────────────────────────────────────
 * · **Settle from the turn's own graph echo.** REJECTED, and it is the option
 *   that has to be rejected loudest, because it is the cheap one. The echo
 *   arrives on the SAME response as the receipt, through the same producer, in
 *   the same transaction. The whole thesis of this work is that that channel
 *   cannot witness persistence — CEE reported an edit applied while
 *   `observed_state.value` never moved. Reading the echo would restore exactly
 *   the false success the ledger exists to catch, with extra steps.
 * · **Re-use `hydrateCanvasFromServer` after an edit.** REJECTED: it MERGES the
 *   answer onto the canvas. Firing it after every edit would let a slow read
 *   roll back newer local work — the silent-rollback hazard its own header
 *   documents. Confirmation must READ without writing the canvas.
 * · **A periodic poll.** REJECTED: spends requests when nothing is outstanding,
 *   and still gives no guarantee at the moment the user needs one.
 * · **A bounded, demand-driven cold read, issued because an attempt is
 *   outstanding.** CHOSEN. It is the only independent evidence available, it
 *   costs nothing when nothing is awaiting, and it is correlated: the read is
 *   issued after the receipt, so the ordering guard admits it by construction.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BOUNDED, AND WHY THE BOUND IS PER ATTEMPT
 * ─────────────────────────────────────────────────────────────────────────────
 * The effect re-runs on every ledger change, so an unbounded trigger could spin.
 * The bound is a per-attempt read count: an attempt is worth at most
 * `MAX_CONFIRM_READS` reads, and one read serves every attempt outstanding at
 * the moment it is issued. When a read settles them, `hasAttemptsAwaitingCanonical`
 * goes false and the effect stops asking. An attempt whose reads all fail stays
 * `receipted` — honest, and never a false claim in either direction.
 *
 * ⚠ IDENTITY IS READ AT REQUEST TIME, NEVER CAPTURED AT RENDER TIME — the same
 * discipline and the same accessor as `useServerGraphHydration`, for the same
 * reason: an access token rotates, and a token captured in a render can already
 * be expired when this fire-and-forget request goes out.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useCanvasStore } from '../store'
import { useAuth } from '../../contexts/AuthContext'
import { getSessionIdentity } from '../../lib/supabase'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { logger } from '../../lib/logger'
import {
  getModelEditCompletionVersion,
  hasAttemptsAwaitingCanonical,
  markCanonicalReadIssued,
  modelEditAttemptIdsAwaitingCanonical,
  settleModelEditAttemptsFromCanonicalGraph,
  subscribeModelEditCompletion,
} from './modelEditCompletion'

/** Reads spent on any one attempt before it is left in its honest open phase. */
export const MAX_CONFIRM_READS = 2

export function useModelEditCanonicalConfirm(scenarioIdFromRoute?: string | null): void {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { user } = useAuth()

  // Same source precedence as `useServerGraphHydration`: the store id is what
  // the boot path sets, the route param is the deep-link fallback.
  const scenarioId = currentScenarioId ?? scenarioIdFromRoute ?? null

  // Re-evaluate whenever the ledger moves — a receipt landing is the event that
  // makes a confirmation read worth spending.
  const version = useSyncExternalStore(
    subscribeModelEditCompletion,
    getModelEditCompletionVersion,
    getModelEditCompletionVersion,
  )

  const readsPerAttemptRef = useRef(new Map<string, number>())
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!scenarioId) return
    if (inFlightRef.current) return
    if (!hasAttemptsAwaitingCanonical(scenarioId)) return

    const awaiting = modelEditAttemptIdsAwaitingCanonical(scenarioId)
    const reads = readsPerAttemptRef.current
    const worthReading = awaiting.filter((id) => (reads.get(id) ?? 0) < MAX_CONFIRM_READS)
    if (worthReading.length === 0) return

    // Charge the read to every attempt it will serve, BEFORE issuing it — a
    // failure must still consume the budget or a dead scenario re-asks forever.
    for (const id of worthReading) reads.set(id, (reads.get(id) ?? 0) + 1)

    inFlightRef.current = true
    const controller = new AbortController()

    void (async (): Promise<void> => {
      try {
        const identity = await getSessionIdentity()
        // ⭐ THE TICK IS TAKEN BEFORE THE REQUEST GOES OUT. Taken after, it
        // would post-date bytes that pre-date it and the ordering guard it
        // feeds would be worthless.
        const readIssuedAt = markCanonicalReadIssued()
        const result = await fetchScenarioGraph(scenarioId, {
          userId: identity.userId,
          accessToken: identity.accessToken,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (result.status === 'graph') {
          settleModelEditAttemptsFromCanonicalGraph(scenarioId, result.graph, readIssuedAt)
        } else {
          logger.debug('model_edit_confirm.no_graph', { scenarioId, outcome: result.status })
        }
      } catch (err) {
        // Never rethrow: a confirmation is an improvement on an honest open
        // phase, never a precondition for anything on screen.
        logger.debug('model_edit_confirm.failed', { scenarioId, err: String(err) })
      } finally {
        inFlightRef.current = false
      }
    })()

    return () => {
      controller.abort()
      inFlightRef.current = false
    }
  }, [scenarioId, version, user?.id])
}
