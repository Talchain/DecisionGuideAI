/**
 * ⭐ A CORE TURN THAT OUTRAN THE STREAM BUDGET IS STILL FINISHING, NOT FAILED (DL lease, 20 Oct 2026).
 *
 * CEE's stream route ends a turn that runs past its budget with `COMPLETE { status_code: 504, payload: { code:
 * 'UPSTREAM_TIMEOUT' } }` and keeps running it, committing the model (`streamed-turn-sse.ts:334-353`, b76bc42c). So the
 * outcome is UNKNOWN when the frame arrives. On core the same `turn_id` is safe to send again: a request that loses the
 * claim WAITS for the running turn and returns its answer, or `409 TURN_OUTCOME_UNKNOWN` at its deadline, and never runs
 * the turn twice (`agent-v1-turn.ts:2930-3042`).
 */

/**
 * The stream-budget timeout CEE sends on a turn it is still running. Body-keyed, never inferred from the status alone:
 * the legacy lane's `504 { code: 'UPSTREAM_TIMEOUT' }`, or the core route's contract error `TURN_STILL_RUNNING` (R2, as
 * `coreTurnErrorBody` hands it on: `{ error: code }`).
 */
export function isCoreStreamBudgetTimeout(httpStatus: number | undefined, body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  return (body as { error?: unknown }).error === 'TURN_STILL_RUNNING'
    || (httpStatus === 504 && (body as { code?: unknown }).code === 'UPSTREAM_TIMEOUT')
}

/** How long to let the running turn get ahead before asking for its answer again. */
export const STILL_FINISHING_REPLAY_DELAY_MS = 3000

export const CORE_STILL_FINISHING_NOTICE = 'Olumi is still finishing this. The answer will appear here.'
export const CORE_FINISHED_RELOADED_NOTICE = 'Olumi finished this. Your saved model is on the canvas.'
export const CORE_OUTCOME_UNKNOWN_NOTICE = "Olumi's answer couldn't be confirmed yet. Reload to see the current model before sending again."
