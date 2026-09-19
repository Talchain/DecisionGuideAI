/**
 * HAS THIS CLIENT STOPPED WAITING FOR THE RUN THE WIRE IS ASSERTING?
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, WITNESSED (bundle `b3d5806d`, 19 Sep 2026, scenario `2b1a023c`)
 * ═══════════════════════════════════════════════════════════════════════════
 *   14:31:06.392  analysis_state.run_state = { kind: "running", started_at }
 *   14:31:48.309  auto_run_after_draft  dispatch_outcome="ok"  commit_performed=true
 *   14:32:09      bundle exported, STILL kind: "running"
 *
 * The result was committed 42s in. The directive that delivers it was
 * suppressed, so no later turn corrected `run_state`.
 *
 * ⛔ AND IT NEVER CORRECTS ITSELF. `wireRunning` has no clock
 * (`analysisStateSelector.ts:533`): it is a statement about the turn CEE
 * composed, cleared only by a later turn. Its sibling `localRunning` IS bounded
 * — it tracks a fetch this client issued. The two are joined by `||` under one
 * name, and the selector prices the disjunction as "being wrong toward 'still
 * running' costs a moment of extra chrome". True of the bounded half; false of
 * the unbounded one, where the cost is every moment there will be.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔⛔ THE FIRST CUT OF THIS FILE GOT IT WRONG, IN EXACTLY THE SHAPE ABOVE
 * ═══════════════════════════════════════════════════════════════════════════
 * It measured `now - run_state.started_at > DEADLINE`. **That is the PRODUCER's
 * clock, and this module is answering a question about THIS CLIENT.** The
 * delivery schedule arms when the hook mounts and polls for its whole ladder
 * FROM THERE — so a page opened well after a run was asserted reports "stopped
 * waiting" at the very moment it has started. CI caught it as a missing banner
 * on a wire-asserted run whose fixture `started_at` sits in the past.
 *
 * Two clocks under one name, inside the fix for two clocks under one name.
 *
 * ⭐ SO THE ANSWER IS OBSERVED, NOT INFERRED. `provisionalDeliveryRecord`
 * already records what this client did: when it armed, and how the schedule
 * ENDED. A settled schedule whose outcome is not `delivered` is not an estimate
 * that the client has given up — it is the client having given up, recorded at
 * the moment it happened.
 *
 * ⭐⭐ AND IT IS RIGHT FOR THE OUTCOME A CLOCK CANNOT SEE. `withheld` SETTLES
 * THE SCHEDULE EARLY ("divergence is a property of the canvas, not of the
 * answer's timing"), often long before the deadline. A clock-only predicate
 * would keep claiming a run was in flight for the whole remaining ladder on the
 * one outcome that is already final.
 *
 * ⚠ THE CLOCK SURVIVES ONLY AS A FLOOR, and it is now the CLIENT's clock
 * (`armed_at`), for the case where a schedule armed and never settled because
 * its effect was torn down. `PROVISIONAL_DELIVERY_DEADLINE_MS` is the hook's
 * own declared bound — "past this the hook stops and writes nothing" — imported
 * rather than restated, so a moved ladder cannot silently move this (trap 12).
 *
 * ⚠ FAIL-CLOSED AT EVERY ABSENCE. No record, a record for a DIFFERENT run, an
 * unparseable stamp, or no run asserted at all: not exhausted. A surface with
 * nothing to go on keeps saying the last thing it was honestly told.
 */
import { useEffect, useState } from 'react'

import { useCanvasStore } from '../../../canvas/store'
import { readDeliveryRecord } from '../../../canvas/hooks/provisionalDeliveryRecord'
import type { ProvisionalDeliveryRecord } from '../../../canvas/hooks/provisionalDeliveryRecord'
import { PROVISIONAL_DELIVERY_DEADLINE_MS } from '../../../canvas/hooks/useProvisionalAnalysisDelivery'

export { PROVISIONAL_DELIVERY_DEADLINE_MS }

/** How often the settled flag is re-read. The record is module state, not reactive. */
export const WAIT_POLL_MS = 5_000

/**
 * The predicate, pure and exported so it can be checked without a renderer.
 *
 * `runKey` is the delivery hook's own arming key — `${scenarioId}:${started_at}`
 * — and matching on it is what stops a PREVIOUS run's settled record marking the
 * current one abandoned.
 */
export function waitIsExhausted(
  isRunning: boolean,
  record: ProvisionalDeliveryRecord | null,
  runKey: string | null,
  now: number,
): boolean {
  if (!isRunning) return false
  if (record === null || runKey === null) return false
  if (record.run_key !== runKey) return false

  // THE OBSERVED ANSWER. The schedule ended; `delivered` is the only ending
  // that put something on screen, so every other one means this client stopped
  // waiting and the surface still shows nothing.
  //
  // ⚠ AND IT IS THE SETTLE OF THE ATTEMPT THAT OWNS THE RECORD. `run_key`
  // repeats across re-arms, so `recordDeliverySettled` now takes the arming
  // token too; a superseded attempt's abort no longer reaches this reader at
  // all. Recorded here because this predicate is WHY that ownership had to
  // exist: a diagnostic blemish became a false claim the moment a product
  // surface read it.
  if (record.outcome !== null) return record.outcome !== 'delivered'

  // THE FLOOR. Armed and never settled — possible if the effect was torn down
  // mid-schedule. Measured from when THIS CLIENT armed, never from the run.
  const armed = Date.parse(record.armed_at)
  if (!Number.isFinite(armed)) return false
  return now - armed > PROVISIONAL_DELIVERY_DEADLINE_MS
}

/**
 * The subscription.
 *
 * ⚠ POLLED, BECAUSE THE RECORD IS MODULE STATE AND NOTHING PUBLISHES IT.
 * `provisionalDeliveryRecord` is deliberately not in the canvas store ("a
 * module-level record is read by the bundle and by nothing else"), so there is
 * nothing to subscribe to. The poll runs ONLY while a run is asserted and not
 * yet settled, and `setState` with an unchanged boolean is a no-op in React, so
 * a quiet run costs one comparison every five seconds and zero renders.
 */
export function useAnalysisWaitExhausted(isRunning: boolean): boolean {
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)
  const analysisState = useCanvasStore((s) => s.analysisStateV1)

  // Derived EXACTLY as `useProvisionalAnalysisDelivery` derives it, because a
  // key that differs by one character silently never matches and this whole
  // module degrades to "never exhausted" without a single failing assertion.
  const runKey =
    analysisState !== null &&
    analysisState !== undefined &&
    analysisState.run_state.kind === 'running'
      ? `${currentScenarioId ?? ''}:${analysisState.run_state.started_at}`
      : null

  const [exhausted, setExhausted] = useState(() =>
    waitIsExhausted(isRunning, readDeliveryRecord(), runKey, Date.now()),
  )

  useEffect(() => {
    const read = (): boolean => waitIsExhausted(isRunning, readDeliveryRecord(), runKey, Date.now())
    setExhausted(read())
    if (!isRunning || runKey === null) return undefined
    const timer = setInterval(() => setExhausted(read()), WAIT_POLL_MS)
    return () => clearInterval(timer)
  }, [isRunning, runKey])

  return exhausted
}
