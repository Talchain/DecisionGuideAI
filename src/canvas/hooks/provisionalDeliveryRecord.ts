/**
 * WHAT THE CLIENT'S DELIVERY SCHEDULE ACTUALLY DID — so a bundle can say, rather
 * than a reader having to infer it.
 *
 * ## The gap this closes, measured 19 Sep 2026
 *
 * A completed analysis did not reach the user and they ran it again. Walking
 * that failure needs one fact above all others: **did the client's delivery
 * schedule arm, and did it fire?**
 *
 * The debug bundle could not answer it. Searched every key in a real export for
 * `provisional|delivery|poll|attempt|armed|schedule`: **zero hits.** The
 * schedule's own outcome went to `logger.debug` and nowhere else — and
 * `drop_console` is unconditional in the production terser config, so on a
 * deployed build that line does not exist at all.
 *
 * So the only available evidence was `analysis_state.run_state`, which is what
 * the SERVER said, not what the CLIENT did. Two sessions of inference rested on
 * it, and two of my own conclusions from it were wrong.
 *
 * ## ⚠ WHY A MODULE AND NOT THE STORE
 *
 * This is diagnostic exhaust, not application state: nothing renders from it and
 * no behaviour branches on it. Putting it in the canvas store would add a field
 * to a large shared file that another lane is editing, for a value with no
 * reader in the UI. A module-level record is read by the bundle and by nothing
 * else, which is exactly its scope.
 *
 * ## ⛔ WHAT IT MUST NOT CARRY
 *
 * No user text, no labels, no option or factor names. A scenario id and a run
 * key are identifiers the bundle already carries elsewhere; anything authored by
 * a person belongs nowhere near an exhaust channel that is pasted into chats.
 */

/** One armed run's delivery attempt, as observed by the client. */
export interface ProvisionalDeliveryRecord {
  /** The hook's own arming key: `${scenarioId}:${run_state.started_at}`. */
  readonly run_key: string
  /**
   * ⭐⭐ WHICH ATTEMPT AT THAT KEY. `run_key` is NOT unique per attempt: the
   * effect re-arms on the same `${scenarioId}:${started_at}` whenever its auth
   * identity dependency changes, so attempt A is torn down and attempt B arms
   * under the identical key.
   *
   * While this record was read only by the debug bundle, A's late settle
   * overwriting B was a diagnostic blemish. `useAnalysisWaitExhausted` now
   * reads it as PRODUCT AUTHORITY — so without ownership, A's abort would
   * declare B's live schedule stopped and the panel would announce an
   * abandoned run over one still in flight.
   */
  readonly attempt: number
  /** When the schedule armed, ISO. */
  readonly armed_at: string
  /**
   * How the schedule ended, verbatim from `runProvisionalDeliverySchedule`, or
   * `null` while it is still running.
   *
   * ⚠ `null` is a REAL STATE and the most interesting one: a bundle exported
   * mid-schedule shows an armed run that has not settled, which is precisely the
   * case that used to be indistinguishable from never having armed.
   */
  readonly outcome: string | null
  /** When `outcome` was written, ISO; `null` while running. */
  readonly settled_at: string | null
}

/**
 * The most recent armed run only.
 *
 * ⚠ ONE, NOT A HISTORY. A growing list in a module that never unmounts is a
 * leak, and the question this answers is about the run the user is looking at.
 * A bundle exported after two runs describes the second, and says so by its
 * `run_key`.
 */
let current: ProvisionalDeliveryRecord | null = null

let attempts = 0

/**
 * Called by the hook at the moment it arms. Replaces any previous record and
 * returns the token that owns it.
 *
 * ⚠ The caller must keep the token and hand it back on settle. A monotonic
 * counter rather than the key, precisely because the key repeats across
 * re-arms — see `attempt` on the record.
 */
export function recordDeliveryArmed(runKey: string): number {
  attempts += 1
  current = {
    run_key: runKey,
    attempt: attempts,
    armed_at: new Date().toISOString(),
    outcome: null,
    settled_at: null,
  }
  return attempts
}

/**
 * Called when the schedule settles.
 *
 * ⚠ Ignores an outcome that does not own the current record — a late settle
 * from an aborted schedule must not overwrite the record of the attempt that
 * replaced it.
 *
 * ⛔ THE KEY ALONE WAS NOT ENOUGH, and that gap is why `attempt` exists. A
 * re-arm produces a NEW attempt under the SAME `run_key`, so a key-only check
 * accepted attempt A's late abort as if it described attempt B.
 */
export function recordDeliverySettled(runKey: string, attempt: number, outcome: string): void {
  if (current === null || current.run_key !== runKey || current.attempt !== attempt) return
  current = { ...current, outcome, settled_at: new Date().toISOString() }
}

/** What the bundle reads. `null` means the schedule never armed in this session. */
export function readDeliveryRecord(): ProvisionalDeliveryRecord | null {
  return current
}

/** Test-only reset. Never called by product code. */
export function __resetDeliveryRecordForTest(): void {
  current = null
  attempts = 0
}
