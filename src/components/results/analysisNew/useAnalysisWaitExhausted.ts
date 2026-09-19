/**
 * THE CLIENT STOPS WAITING AT A DECLARED BOUND. THIS IS THE SURFACE SAYING SO.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, MEASURED ON PAUL'S RUN (19 Sep 2026, bundle `b3d5806d`)
 * ═══════════════════════════════════════════════════════════════════════════
 * Scenario `2b1a023c`. The wire said a run had started, and CEE's own logs say
 * it finished:
 *
 *   14:31:06.392  analysis_state.run_state = { kind: "running", started_at }
 *   14:31:47.726  v5.ui_directive.suppressed  reason="leading_option_claim_withheld"
 *   14:31:48.309  v5.run_analysis.auto_run_after_draft
 *                 outcome="dispatched" dispatch_outcome="ok" commit_performed=true
 *
 * The result was committed 42 seconds in. The directive that would have
 * delivered it was suppressed, so no later turn ever corrected `run_state`, and
 * the bundle exported at 14:32:09Z still carried `kind: "running"`.
 *
 * ⛔ AND IT NEVER STOPS CARRYING IT. `wireRunning` has no clock of its own
 * (`analysisStateSelector.ts:533`): it is a statement about the turn CEE
 * composed, cleared only by a later turn saying otherwise. Its sibling
 * `localRunning` IS bounded — it tracks a fetch this client issued, so it ends
 * when that fetch does. The two are joined by `||` under ONE name, `isRunning`,
 * and the selector prices the disjunction's risk as "being wrong toward 'still
 * running' costs a moment of extra chrome". That is true of the bounded half
 * and false of the unbounded one, where the cost is every moment there will be.
 *
 * ⭐ CLAUDE.md trap 21, exactly: two claims with DIFFERENT LIFETIMES sharing one
 * name. The fix is not to align them — it is to bound the client's own patience
 * and let each surface read the bounded answer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY 130s IS NOT A NUMBER THIS MODULE INVENTS
 * ═══════════════════════════════════════════════════════════════════════════
 * `PROVISIONAL_DELIVERY_DEADLINE_MS` is the delivery hook's OWN declared bound,
 * derived from the last offset of its ladder, and its docblock states the
 * consequence in terms: "Past this the hook stops and writes nothing." So at
 * this instant the client has definitively stopped trying. Every earlier second
 * is one where a result may still arrive and the busy claim is honest.
 *
 * Importing it — rather than writing 130_000 here — is what stops this becoming
 * the hand-maintained mirror the constant's own comment describes being caught
 * as once already (CLAUDE.md trap 12).
 *
 * ⚠ WHAT EXHAUSTION DOES AND DOES NOT LICENCE. It licenses exactly one claim:
 * THE CLIENT IS NO LONGER WAITING. It does not license "the run failed", "the
 * run finished" or "the run is still going" — the client consumes no run state
 * and cannot know which. Copy keyed on this flag must stay true under all
 * three, which is the same honesty invariant `AnalysisRunningBanner`'s stage
 * table is built on.
 *
 * ⚠ AND ABSENT A CLOCK IT FAILS CLOSED, toward today's behaviour. Without
 * `startedAt` the only available origin is mount time, which measures the age
 * of a COMPONENT rather than of a run — the round-2 P1 regression recorded in
 * `AnalysisRunningBanner.tsx:19-29`. A surface with no run clock keeps saying
 * the run is in flight, because that is the last thing it was honestly told.
 */
import { useEffect, useState } from 'react'

import { PROVISIONAL_DELIVERY_DEADLINE_MS } from '../../../canvas/hooks/useProvisionalAnalysisDelivery'

export { PROVISIONAL_DELIVERY_DEADLINE_MS }

/**
 * True once a run asserted at `startedAt` has outlived the client's whole
 * delivery budget.
 *
 * Pure, exported, and tested directly: the hook below is a subscription around
 * it, and a predicate that can be read without a renderer is one a reviewer can
 * check against the constant by eye.
 */
export function waitIsExhausted(
  isRunning: boolean,
  startedAt: number | undefined,
  now: number,
): boolean {
  if (!isRunning) return false
  if (startedAt === undefined || !Number.isFinite(startedAt)) return false
  return now - startedAt > PROVISIONAL_DELIVERY_DEADLINE_MS
}

/**
 * The subscription. Re-evaluates once, at the exact moment the bound passes,
 * rather than on a repeating tick.
 *
 * ⚠ A ONE-SHOT TIMEOUT, NOT A 1s INTERVAL. `AnalysisRunningBanner` ticks every
 * second because it narrates a CHANGING value; this answers a boolean that
 * flips once, so an interval would re-render the largest surface in the dock
 * ~130 times to observe a single transition. The timeout is armed for the
 * remaining time and cleared on unmount or on a new run.
 *
 * ⚠ THE INITIALISER MATTERS AS MUCH AS THE TIMER — a panel mounted 200s into an
 * abandoned run must render the exhausted state on its FIRST frame, not after a
 * timeout that was armed for a negative delay. Same lesson as the banner's
 * "a banner mounting at 25s must render the 20s stage on its first frame".
 */
export function useAnalysisWaitExhausted(
  isRunning: boolean,
  startedAt: number | undefined,
): boolean {
  const [exhausted, setExhausted] = useState(() => waitIsExhausted(isRunning, startedAt, Date.now()))

  useEffect(() => {
    const settled = waitIsExhausted(isRunning, startedAt, Date.now())
    setExhausted(settled)
    if (settled) return undefined
    if (!isRunning || startedAt === undefined || !Number.isFinite(startedAt)) return undefined

    const remaining = startedAt + PROVISIONAL_DELIVERY_DEADLINE_MS - Date.now()
    const timer = setTimeout(() => setExhausted(true), Math.max(0, remaining) + 1)
    return () => clearTimeout(timer)
  }, [isRunning, startedAt])

  return exhausted
}
