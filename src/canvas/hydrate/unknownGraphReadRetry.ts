/**
 * unknownGraphReadRetry — OW-1 rule 1's second half: an UNKNOWN boot read is
 * read again, for a bounded time.
 *
 * ── WHY ────────────────────────────────────────────────────────────────────
 * The one-writer contract (programme-docs #63, 5795148042 (e) → 5795173355):
 * "`graph/register` only on `graph_present:false` or a 404. On UNKNOWN — a 5xx
 * or a transport error — fail closed: keep the hold and retry the read." The
 * fail-closed half already exists: `bootGraphRead.ts` verdicts every unknown
 * `'refuse'`, so nothing is written. But the boot read fired once, so an
 * unknown was the page's last word on the scenario: the re-arm stayed refused
 * and the latch stayed unset for the page's life, over a model CEE may well
 * hold. Reading again is how an unknown resolves — to `merged` (latched), or to
 * `absent`/404 (the first registration).
 *
 * ── WHAT COUNTS AS UNKNOWN ─────────────────────────────────────────────────
 *   · `unavailable` — 503 through every adapter attempt;
 *   · `unusable`    — a transport failure, a per-attempt deadline, another
 *                     5xx, or a body the adapter cannot act on.
 * NOT unknown, and never re-read here: `notReadable` (404 — a stable answer),
 * `refused` / `signInRequired` (re-asking a 401/403/429 spends budget to earn
 * the same refusal, and a 429 retry is actively harmful), `mergeRefused` (a
 * graph ARRIVED), `absent` (its own schedule: `absentGraphRetry.ts`),
 * `merged` / `unchanged` (success) and `skipped` (the scenario moved).
 * An explicit allow-list, as in `absentGraphRetry.ts`: a future outcome
 * defaults to NOT retried.
 *
 * ── IT MUST TERMINATE ──────────────────────────────────────────────────────
 * A dead server answers unknown forever, and an unbounded poll against it is
 * worse than the defect. The schedule is a FIXED LIST: consumed, it stops.
 * BUDGET: CEE's `read` tier is 90 rpm per client IP, shared with the absent
 * re-ask and provisional delivery. This spends at most 4 reads (×3 adapter
 * attempts on a 503) over two minutes.
 */

import { logger } from '../../lib/logger'
import type { HydrationOutcome } from './serverGraphHydration'

/** Delays, in ms, measured from the first unknown answer. Exported so the spec asserts THE SCHEDULE. */
export const UNKNOWN_GRAPH_READ_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 45_000, 120_000]

/** The allow-list: the outcomes that mean "the page could not find out". */
export function isUnknownGraphRead(outcome: HydrationOutcome): boolean {
  return outcome === 'unavailable' || outcome === 'unusable'
}

export interface UnknownGraphReadRetryDeps {
  readonly scenarioId: string
  readonly userId: string | null
  readonly accessToken: string | null
  readonly signal: AbortSignal
  /** `hydrateCanvasFromServer` in production: a re-read settles its own boot-read record. */
  readonly hydrate: (
    scenarioId: string,
    opts: { userId?: string | null; accessToken?: string | null; signal?: AbortSignal },
  ) => Promise<HydrationOutcome>
  /** The clock, injected (see `absentGraphRetry.ts` for why). */
  readonly wait: (ms: number, signal: AbortSignal) => Promise<void>
  readonly delays?: readonly number[]
}

/**
 * Re-read a scenario whose boot read answered unknown, until an answer is
 * known or the schedule is consumed. Returns the LAST outcome read — a known
 * one, or the final unknown when the bound expired — or `'aborted'`.
 * Never throws.
 */
export async function runUnknownGraphReadRetrySchedule(
  deps: UnknownGraphReadRetryDeps,
): Promise<HydrationOutcome | 'aborted'> {
  const delays = deps.delays ?? UNKNOWN_GRAPH_READ_RETRY_DELAYS_MS
  let previous = 0
  let outcome: HydrationOutcome = 'unusable'
  for (const at of delays) {
    if (deps.signal.aborted) return 'aborted'
    try {
      await deps.wait(at - previous, deps.signal)
    } catch {
      return 'aborted'
    }
    previous = at
    if (deps.signal.aborted) return 'aborted'
    outcome = await deps.hydrate(deps.scenarioId, {
      userId: deps.userId,
      accessToken: deps.accessToken,
      signal: deps.signal,
    })
    if (deps.signal.aborted) return 'aborted'
    if (!isUnknownGraphRead(outcome)) {
      logger.debug('unknown_graph_read_retry.resolved', { scenarioId: deps.scenarioId, atMs: at, outcome })
      return outcome
    }
  }
  logger.debug('unknown_graph_read_retry.exhausted', {
    scenarioId: deps.scenarioId,
    attempts: delays.length,
  })
  return outcome
}
