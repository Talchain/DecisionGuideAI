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
 * BOUNDED, AND THE BOUND IS A REAL SCHEDULE
 * ─────────────────────────────────────────────────────────────────────────────
 * One read serves every attempt outstanding when it is issued, and the loop
 * stops the moment nothing is awaiting — so the common case costs exactly one
 * request. A non-`graph` answer RETRIES on the measured write-back schedule
 * (see `CONFIRM_READ_DELAYS_MS`); an exhausted budget leaves the attempt in its
 * honest open phase and is never a verdict in either direction.
 *
 * ⚠ IDENTITY IS READ AT REQUEST TIME, NEVER CAPTURED AT RENDER TIME — the same
 * discipline and the same accessor as `useServerGraphHydration`, for the same
 * reason: an access token rotates, and a token captured in a render can already
 * be expired when this fire-and-forget request goes out.
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useAuth } from '../../contexts/AuthContext'
import { getSessionIdentity } from '../../lib/supabase'
import { fetchScenarioGraph } from '../../adapters/cee/scenarioGraph'
import { logger } from '../../lib/logger'
import { ABSENT_GRAPH_RETRY_DELAYS_MS, waitForRetry } from '../hydrate/absentGraphRetry'
import {
  hasAttemptsAwaitingCanonical,
  markCanonicalReadIssued,
  settleModelEditAttemptsFromCanonicalGraph,
  subscribeModelEditCompletion,
} from './modelEditCompletion'

/**
 * ⚠ THE SAME SCHEDULE `absentGraphRetry` DERIVED, AND FOR THE SAME REASON.
 *
 * The first cut spent ONE read and called a budget of 2 a bound — it was
 * unspendable: a failed or non-`graph` answer changed none of the effect's
 * dependencies, so nothing ever re-triggered, and the attempt stuck at
 * `receipted`. `fetchScenarioGraph` has seven non-`graph` outcomes that all
 * land here.
 *
 * `absent` is the one that matters most and is exactly why this schedule
 * exists: CEE's write-back completes 30–90s after the model first appears
 * (journey-witnessed 25 Aug, 5 trials), and a once-only read against that
 * endpoint left the canvas empty for the life of the page. A confirmation read
 * fires MOMENTS after an edit, which is squarely inside that window — so
 * re-adopting the once-only shape would re-adopt the measured defect.
 *
 * The DELAYS are imported rather than restated (trap 12: a copied schedule
 * drifts). What is deliberately NOT reused is `runAbsentGraphRetrySchedule`
 * itself — it orchestrates HYDRATION, returns `HydrationOutcome`, and merges
 * the answer onto the canvas, which a confirmation must never do.
 */
export const CONFIRM_READ_DELAYS_MS = ABSENT_GRAPH_RETRY_DELAYS_MS

/** Injectable for tests — production uses the real client and the real clock. */
export interface ModelEditConfirmDeps {
  read?: typeof fetchScenarioGraph
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
}

export function useModelEditCanonicalConfirm(
  scenarioIdFromRoute?: string | null,
  deps: ModelEditConfirmDeps = {},
): void {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { user } = useAuth()

  // Same source precedence as `useServerGraphHydration`: the store id is what
  // the boot path sets, the route param is the deep-link fallback.
  const scenarioId = currentScenarioId ?? scenarioIdFromRoute ?? null

  // ⚠ SUBSCRIBED, NOT RENDERED. An earlier cut read the ledger through
  // `useSyncExternalStore`, which re-rendered THE WHOLE CANVAS ROUTE on every
  // ledger write — this hook is mounted in `CanvasMVP`, and it renders nothing.
  // The subscription lives in the effect instead: it sees exactly the same
  // events and costs no renders at all.

  const inFlightRef = useRef(false)
  /**
   * ⭐⭐ A WAKE-UP THAT ARRIVES MID-EPISODE IS BANKED, NOT DROPPED (review of
   * `800569f8`, B1). The first cut returned early while a read was in flight
   * and recorded nothing, which loses the ONE event that mattered:
   *
   *   1. attempt A reaches the FINAL read of its episode; the tick is stamped
   *      and the request is in flight;
   *   2. attempt B is receipted while it is; the listener fires and is dropped;
   *   3. the read answers, and its tick PRE-DATES B's receipt — so the ordering
   *      guard correctly declines to adjudicate B from those bytes;
   *   4. the loop has no next iteration. Nothing replays. B stays `receipted`
   *      for the life of the page.
   *
   * Step 3 is not the defect — declining stale bytes is the whole point of the
   * guard. The defect is that nothing ever asks again.
   */
  const rerunRequestedRef = useRef(false)
  const read = deps.read ?? fetchScenarioGraph
  const wait = deps.wait ?? waitForRetry

  useEffect(() => {
    if (!scenarioId) return

    const controller = new AbortController()

    /**
     * ONE bounded episode: at most `CONFIRM_READ_DELAYS_MS.length + 1` reads,
     * stopping the moment nothing is awaiting — so the common case (CEE answers
     * the first read) still costs exactly one request.
     */
    const runEpisode = async (): Promise<void> => {
      for (let i = 0; i <= CONFIRM_READ_DELAYS_MS.length; i += 1) {
        if (controller.signal.aborted) return
        if (!hasAttemptsAwaitingCanonical(scenarioId)) return
        if (i > 0) {
          try {
            await wait(CONFIRM_READ_DELAYS_MS[i - 1], controller.signal)
          } catch {
            return // aborted
          }
        }
        if (controller.signal.aborted) return

        const identity = await getSessionIdentity()
        // ⭐ THE TICK IS TAKEN BEFORE THE REQUEST GOES OUT. Taken after, it
        // would post-date bytes that pre-date it and the ordering guard it
        // feeds would be worthless. Re-taken on EVERY attempt, because each
        // read is its own point in time — including the replayed episode's,
        // which is exactly why a replay can settle what the last read could not.
        const readIssuedAt = markCanonicalReadIssued()
        const result = await read(scenarioId, {
          userId: identity.userId,
          accessToken: identity.accessToken,
          signal: controller.signal,
        })
        if (controller.signal.aborted) return
        if (result.status === 'graph') {
          settleModelEditAttemptsFromCanonicalGraph(scenarioId, result.graph, readIssuedAt)
        } else {
          logger.debug('model_edit_confirm.no_graph', {
            scenarioId,
            outcome: result.status,
            attempt: i,
          })
        }
      }
      // Budget spent. Whatever is still open stays in its honest phase — an
      // exhausted schedule is never a verdict in either direction.
      logger.debug('model_edit_confirm.exhausted', { scenarioId })
    }

    const runConfirmation = async (): Promise<void> => {
      // ⭐ COALESCE, NEVER DISCARD. One replay is banked however many events
      // land during the episode, so a burst of edits costs one extra episode.
      if (inFlightRef.current) {
        rerunRequestedRef.current = true
        return
      }
      if (!hasAttemptsAwaitingCanonical(scenarioId)) return
      inFlightRef.current = true
      try {
        do {
          rerunRequestedRef.current = false
          await runEpisode()
          // ⚠ NO `await` BETWEEN THE EPISODE RETURNING AND THIS CHECK, so a
          // listener cannot interleave into the gap and be lost a second time.
        } while (
          rerunRequestedRef.current &&
          !controller.signal.aborted &&
          hasAttemptsAwaitingCanonical(scenarioId)
        )
      } catch (err) {
        // Never rethrow: a confirmation is an improvement on an honest open
        // phase, never a precondition for anything on screen.
        logger.debug('model_edit_confirm.failed', { scenarioId, err: String(err) })
      } finally {
        inFlightRef.current = false
        rerunRequestedRef.current = false
      }
    }

    /**
     * ⚠ WHY THIS CANNOT BECOME AN INFINITE POLL, derived at the ledger's bytes
     * rather than asserted: a replay requires `rerunRequestedRef`, which only a
     * listener sets, and listeners run only from `emit()`. `emit()` has exactly
     * three call sites in `modelEditCompletion.ts` — a new attempt, a receipt,
     * and a TERMINAL canonical settle. `markCanonicalReadIssued` does not emit,
     * and neither does the deferred-refusal bookkeeping write. So this loop's
     * own reads cannot wake it: exhaustion is silent, and the only thing that
     * buys another episode is genuinely new information.
     */
    const unsubscribe = subscribeModelEditCompletion(() => {
      void runConfirmation()
    })
    void runConfirmation()

    return () => {
      unsubscribe()
      controller.abort()
      inFlightRef.current = false
      rerunRequestedRef.current = false
    }
  }, [scenarioId, user?.id, read, wait])

}
