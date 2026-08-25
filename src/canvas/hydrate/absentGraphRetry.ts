/**
 * absentGraphRetry — the bounded re-ask for a graph the server has not written
 * back YET.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT (journey-witnessed 2026-08-25, 5 trials, build `55807813`)
 * ═══════════════════════════════════════════════════════════════════════════
 * `useServerGraphHydration` issues EXACTLY ONE `POST /bff/cee/scenarios/:id/graph`
 * per scenario id. If that answer carries `graph_present:false` the canvas stays
 * empty for the life of the page — there is no retry.
 *
 * That collides with a second measured fact: the server write-back completes
 * 30–90s AFTER the model first appears on screen. A guest who closes the tab and
 * returns inside that window is told nothing, shown nothing, and left with a
 * blank canvas while their model is intact on the server and lands moments
 * later. Restart at +15s → 0 nodes, twice. Restart at +180s → 14 and 11 nodes,
 * immediately. In one trial the server held the graph by +47s while the canvas
 * sat at 0 and never re-asked. A plain reload recovers it every time.
 *
 * NOTHING IS LOST. THE CLIENT STOPS LOOKING. This module makes it keep looking,
 * for a bounded time, and then tell the truth.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY HERE AND NOT IN THE ADAPTER OR THE ORCHESTRATOR
 * ═══════════════════════════════════════════════════════════════════════════
 * `fetchScenarioGraph` already retries — but only a 503, and only because that
 * is a TRANSPORT answer. Adding an `absent` retry there would change the
 * semantics for every caller: `useProvisionalAnalysisDelivery` runs its own
 * bounded schedule over the same route and would then be retrying twice over,
 * and `recoverDraftFromServer` is an in-session user-triggered read for which
 * `absent` is a final answer. Both would silently start spending the shared
 * per-client-IP read budget several times over.
 *
 * `hydrateCanvasFromServer` is likewise the wrong home: it is `await`ed by
 * `recoverDraftFromServer`, so a loop inside it would block that call for the
 * length of this schedule.
 *
 * So the policy lives at the BOOT path, which is the only caller that has the
 * returning-guest problem, and it re-enters `hydrateCanvasFromServer` — the
 * whole orchestrator, not the adapter — so a late graph is merged, identity-
 * tokened, context-integrity-recorded and boot-verdict-applied by EXACTLY the
 * same code as a first-load graph. There is no second ingestion path.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ IT MUST TERMINATE — AN UNBOUNDED POLL IS A WORSE DEFECT THAN THE ONE FIXED
 * ═══════════════════════════════════════════════════════════════════════════
 * A scenario can answer `absent` forever (a draft that never completed, a graph
 * CEE never wrote). The schedule below is a FIXED LIST, not a backoff loop with
 * a stop condition bolted on: when the list is consumed the function returns and
 * nothing reschedules. The read COUNT is asserted in the spec precisely so a
 * later "just poll every few seconds" cannot land without failing a test.
 *
 * BUDGET. CEE's `read` tier is 90 rpm, keyed per CLIENT IP and shared with
 * `useProvisionalAnalysisDelivery` (7 reads/60s) and draft recovery. This
 * schedule spends 7 reads over 100s. Front-loaded, because the window's lower
 * bound is 30s and a guest who returns late in it should not wait the full span.
 */

import { logger } from '../../lib/logger'
import type { HydrationOutcome } from './serverGraphHydration'

/**
 * Delays between re-asks, in ms, measured from the FIRST `absent` answer.
 *
 * Covers the measured 30–90s write-back window with margin, in 7 reads. Exported
 * so the spec asserts the SCHEDULE rather than restating it (trap 12), and so
 * the budget claim above is checkable rather than asserted in prose.
 */
export const ABSENT_GRAPH_RETRY_DELAYS_MS: readonly number[] = [
  3_000, 8_000, 16_000, 30_000, 50_000, 75_000, 100_000,
]

/** The bound. Past this the schedule STOPS. */
export const ABSENT_GRAPH_RETRY_DEADLINE_MS =
  ABSENT_GRAPH_RETRY_DELAYS_MS[ABSENT_GRAPH_RETRY_DELAYS_MS.length - 1]

export type AbsentGraphRetryOutcome =
  /** A re-ask produced a graph. This is the defect's fix, observed. */
  | 'hydrated'
  /** Every attempt answered `absent`. The bound expired; tell the truth. */
  | 'exhausted'
  /**
   * A re-ask returned a NON-absent answer that is not a graph — a 404, a
   * refusal, a transport failure. The scenario stopped being "not written back
   * yet" and became something else. Stop, and surface nothing: these are the
   * states `serverGraphHydration`'s header already rules must pass silently.
   */
  | 'terminal'
  /** The scenario changed or the canvas unmounted. */
  | 'aborted'

/**
 * The stages a surface may show. `retrying` and `exhausted` are the only two
 * this module reports; `idle` is the store's initial and cleared value.
 */
export type AbsentGraphRetryStage = 'retrying' | 'exhausted'

/**
 * ⚠ THE ONLY OUTCOME THAT MAY BE RE-ASKED.
 *
 * `absent` is `200 + graph_present:false` for a scenario id we hold a pointer to
 * — the server answered, it exists, it has no graph YET. Every other outcome is
 * a STABLE answer and re-asking it spends the shared read budget to earn the
 * same refusal again:
 *
 *   · `notReadable` — 404. Absent ∪ not-yours ∪ oracle-unresolvable. A stable
 *     answer, and NEVER deletion. Must behave byte-identically to today.
 *   · `refused`     — 401/403/429. An auth or rate answer; retrying 429 in
 *     particular is actively harmful.
 *   · `unusable`    — transport failure or a self-contradicting shape. This is
 *     the "cannot distinguish from a dead server" case and is deliberately NOT
 *     retried here; the adapter already made three attempts.
 *   · `unavailable` — 503 through all three adapter attempts. Already retried.
 *   · `mergeRefused`— a graph ARRIVED. The problem is the merge, not absence.
 *   · `merged` / `unchanged` — success.
 *   · `skipped`     — no pointer, or the scenario moved under the read.
 *
 * Written as an explicit allow-list of ONE rather than a `!== 'graph'` style
 * negation: a future outcome added to `HydrationOutcome` must be considered
 * deliberately, and will default to NOT retrying.
 */
function isStillWaitingForWriteBack(outcome: HydrationOutcome): boolean {
  return outcome === 'absent'
}

/** A re-ask that produced a graph — the schedule's success condition. */
function isGraph(outcome: HydrationOutcome): boolean {
  return outcome === 'merged' || outcome === 'unchanged'
}

export interface AbsentGraphRetryDeps {
  readonly scenarioId: string
  readonly userId: string | null
  /** Supabase access token, travelling the same route as `userId`. */
  readonly accessToken: string | null
  readonly signal: AbortSignal
  /**
   * Re-entry point. This is `hydrateCanvasFromServer` in production — the whole
   * orchestrator, so a late graph is ingested by the first-load code path.
   */
  readonly hydrate: (
    scenarioId: string,
    opts: { userId?: string | null; accessToken?: string | null; signal?: AbortSignal },
  ) => Promise<HydrationOutcome>
  /**
   * The clock, injected.
   *
   * ⚠ NO FAKE TIMERS IN THE CORE SPEC, for the reason
   * `useProvisionalAnalysisDelivery.spec.ts` states: injecting the clock proves
   * WHAT THE SCHEDULE ASKED FOR, where a fake-timer harness only proves the loop
   * ran. The delays are OBSERVED, not elapsed.
   */
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>
  readonly delays?: readonly number[]
  /**
   * Stage reporting for the surface. Called at most twice: `retrying` when the
   * schedule arms, `exhausted` when the bound expires. NEVER called on
   * `hydrated`, `terminal` or `aborted` — the caller clears instead, so a stale
   * stage cannot outlive the schedule that set it.
   */
  readonly onStage?: (stage: AbsentGraphRetryStage) => void
}

/**
 * Run the bounded re-ask once, for one scenario that has just answered `absent`.
 *
 * Never throws; every exit is an outcome. Extracted from the hook so the bound,
 * the allow-list and the termination are provable without mounting React.
 */
export async function runAbsentGraphRetrySchedule(
  deps: AbsentGraphRetryDeps,
): Promise<AbsentGraphRetryOutcome> {
  const delays = deps.delays ?? ABSENT_GRAPH_RETRY_DELAYS_MS

  if (deps.signal.aborted) return 'aborted'

  // The surface may now say we are looking. It may NOT say the work is gone,
  // and it disappears on any exit below.
  deps.onStage?.('retrying')

  let previous = 0
  for (const at of delays) {
    try {
      await deps.wait(at - previous, deps.signal)
    } catch {
      return 'aborted'
    }
    previous = at
    if (deps.signal.aborted) return 'aborted'

    const outcome = await deps.hydrate(deps.scenarioId, {
      userId: deps.userId,
      accessToken: deps.accessToken,
      signal: deps.signal,
    })
    if (deps.signal.aborted) return 'aborted'

    if (isGraph(outcome)) {
      logger.debug('absent_graph_retry.hydrated', {
        scenarioId: deps.scenarioId,
        atMs: at,
        outcome,
      })
      return 'hydrated'
    }

    if (!isStillWaitingForWriteBack(outcome)) {
      // The scenario stopped being "not written back yet". Stop, and surface
      // nothing — `serverGraphHydration`'s header rules these pass silently.
      logger.debug('absent_graph_retry.terminal', {
        scenarioId: deps.scenarioId,
        atMs: at,
        outcome,
      })
      return 'terminal'
    }
  }

  // THE BOUND EXPIRED. Nothing reschedules. The surface may now say — truthfully
  // — that no model was returned, and offer the reload that demonstrably works.
  logger.debug('absent_graph_retry.exhausted', {
    scenarioId: deps.scenarioId,
    deadlineMs: ABSENT_GRAPH_RETRY_DEADLINE_MS,
    attempts: delays.length,
  })
  deps.onStage?.('exhausted')
  return 'exhausted'
}

/** The production clock. Rejects on abort so the loop exits promptly. */
export function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return signal.aborted ? Promise.reject(new Error('aborted')) : Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
