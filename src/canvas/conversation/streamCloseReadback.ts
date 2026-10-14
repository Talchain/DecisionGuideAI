/**
 * STREAM CLOSED WITHOUT A FINAL TURN → READ THE SAVED MODEL FIRST (Panel #70 5851425976, DL 5851437372).
 *
 * Served: CEE redeployed mid-draft; `/proxy/v5/turn/stream` closed after DRAFTING heartbeats only, and the UI
 * sat on "Still drafting…" for 5+ min — the STREAMED DRAFT FALLBACK re-sent the whole brief as a buffered turn
 * (up to `TURN_WAIT_MS`, 175 s) against a CEE that was mid-deploy. A manual reload recovered the finished model
 * at once: CEE finishes a turn when the client hangs up (#751), so the first draft had committed.
 *
 * The fix REUSES the reload's read (`recoverDraftFromServer` → `hydrateCanvasFromServer`) about 5 s after
 * the close, BEFORE the buffered re-send. Recovered → no re-send. Anything else → today's fallback, unchanged.
 *
 * ⭐ B UI (SYS1 lever 2; served capacity 001307, 12 Oct): the stream went SILENT after 299 bytes (DRAFTING + BRIEF_READ)
 * while CEE saved the 13-node model; the silence fell to the buffered re-send (a POST that never reached CEE), then ONE
 * 8 s recovery read gave up 2 s before CEE answered it with the saved model, and the user read "We cannot confirm…".
 * A lost stream (silence or a dropped socket) now reads the saved model first, as a server close does, and a read
 * that gets no answer is tried once more (`STREAM_LOSS_READ`).
 */

/** Long enough for a draft the server was finishing to commit; short against a 175 s re-send. */
export const STREAM_CLOSE_READBACK_DELAY_MS = 5_000

/**
 * An OPENED stream that was LOST reads back first: the server CLOSED it with no final turn (`no_terminal_frame`,
 * Panel's served case: the body ended after 150 bytes of DRAFTING heartbeats), the socket DROPPED (`transport`), or it
 * went SILENT (`silence`, capacity 001307). The server got the brief in each case (the stream opened), so the saved
 * model is the answer to look for, not a second send. Malformed frames and a backwards `seq` keep today's path (the
 * buffered fallback, then its recovery read): the server answered, and what it said is in question.
 */
export function readsBackBeforeResend(fallbackReason: string): boolean {
  return /^(?:no_terminal_frame|transport|silence):/.test(fallbackReason)
}

/**
 * Both stream-loss recovery reads (before the re-send and after it): the adapter's 8 s read (`DEFAULT_TIMEOUT_MS`),
 * tried once more after 1 s when it gets NO answer (deadline or failed connection), never after an answer (404,
 * 401/403/429, another status) or a caller abort. Worst case 8 + 1 + 8 = 17 s of reading, 22 s from the loss with
 * the 5 s wait above.
 */
export const STREAM_LOSS_READ = { attempts: 2, backoffMs: 1_000 } as const

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
