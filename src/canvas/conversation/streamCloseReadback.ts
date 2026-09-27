/**
 * STREAM CLOSED WITHOUT A FINAL TURN → READ THE SAVED MODEL FIRST (Panel #70 5851425976, DL 5851437372).
 *
 * Served: CEE redeployed mid-draft; `/proxy/v5/turn/stream` closed after DRAFTING heartbeats only, and the UI
 * sat on "Still drafting…" for 5+ min — the STREAMED DRAFT FALLBACK re-sent the whole brief as a buffered turn
 * (up to `TURN_WAIT_MS`, 175 s) against a CEE that was mid-deploy. A manual reload recovered the finished model
 * at once: CEE finishes a turn when the client hangs up (#751), so the first draft had committed.
 *
 * The fix REUSES the reload's read (`recoverDraftFromServer` → `hydrateCanvasFromServer`), ONCE, about 5 s after
 * the close, BEFORE the buffered re-send. Recovered → no re-send. Anything else → today's fallback, unchanged.
 */

/** Long enough for a draft the server was finishing to commit; short against a 175 s re-send. */
export const STREAM_CLOSE_READBACK_DELAY_MS = 5_000

/**
 * Only an OPENED stream that the server CLOSED with no final turn (`no_terminal_frame`, Panel's served case: the
 * body ended after 150 bytes of DRAFTING heartbeats) reads back first. A dropped socket (`transport`), silence,
 * malformed frames and a backwards `seq` keep today's path (the buffered fallback, then its recovery read) —
 * widening to `transport` moves ~19 pinned recovery rows and is a separate, reviewed change.
 */
export function readsBackBeforeResend(fallbackReason: string): boolean {
  return /^no_terminal_frame:/.test(fallbackReason)
}

/** Resolves after the delay, or at once when the turn is aborted (the caller then skips the read). */
export function waitBeforeStreamCloseReadback(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, STREAM_CLOSE_READBACK_DELAY_MS)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done)
  })
}
