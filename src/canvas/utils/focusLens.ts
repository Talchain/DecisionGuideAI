/**
 * focusLens — F3 (graph-visuals): the rule for WHEN the transient focus lens ends.
 *
 * THE RULE: the focus dim must not outlive the camera it was framed against.
 * Any camera move ends the lens EXCEPT the one focus itself just ordered.
 *
 * Why this is not simply `if (event)`: ReactFlow hands onMoveStart the
 * originating gesture for a user drag/wheel and `null` for a programmatic
 * move. But the app's OWN camera controls (the zoom in/out/reset/fit buttons)
 * move the camera programmatically too — they are user ACTIONS that arrive as
 * `null` events. Filtering on the event therefore swallows the very moves that
 * most need to end the lens, stranding a stale dim over a reframed camera.
 *
 * So the discriminator is not "did an event come with it" but "did FOCUS order
 * this move": handleFocusNode arms the suppressor immediately before its own
 * fit, and the first move-start to arrive consumes the arming.
 *
 * Time-boxed AND consume-once, deliberately:
 *  - consume-once, so the arming can never cover a second, later move;
 *  - time-boxed, because a fit whose camera is already at the target emits NO
 *    move at all, which would otherwise leave the arming set forever and make
 *    the next genuine user pan the one that gets swallowed.
 * The residual window is a user pan landing inside `windowMs` of focus's own
 * fit — during which the camera is mid-animation anyway.
 *
 * Pure by design (cameraMotion/cameraComfort precedent): the clock is injected,
 * so there are no timers to leak and the contract is pinned with a fake clock.
 */

/** How long focus's own fit may claim a move-start before the arming goes stale. */
export const FOCUS_FIT_SUPPRESS_MS = 150

export interface FocusFitSuppressor {
  /** Arm: call immediately BEFORE focus's own programmatic fit. */
  begin: () => void
  /**
   * Ask, from onMoveStart: was this move focus's own fit (so KEEP the lens)?
   * Consumes the arming, so only the first move-start can claim it.
   */
  consume: () => boolean
}

export function createFocusFitSuppressor(
  nowMs: () => number = () => Date.now(),
  windowMs: number = FOCUS_FIT_SUPPRESS_MS,
): FocusFitSuppressor {
  let armedAt: number | null = null
  return {
    begin: () => {
      armedAt = nowMs()
    },
    consume: () => {
      if (armedAt === null) return false
      const withinWindow = nowMs() - armedAt <= windowMs
      // Consume even when stale: a fit that never moved the camera must not
      // leave the arming lying in wait for a genuine user pan.
      armedAt = null
      return withinWindow
    },
  }
}
