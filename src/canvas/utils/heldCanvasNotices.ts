/**
 * A canvas notice raised while NO canvas is mounted to show it, held until one is.
 *
 * The canvas toast bridge (`ReactFlowGraph`, `topbar:show-toast`) lives inside the canvas route. A rename's turn that
 * is cut off because the user LEFT the model (S5 witness, 7 Oct: rename, then "My decisions" within ~2.6 s) settles
 * after the canvas has unmounted, so its notice was dispatched to no listener and the user never saw it. Here the
 * dispatch asks whether anyone showed it (the bridge calls `preventDefault()`); if nobody did, the notice is held and
 * the next canvas to mount shows it.
 *
 * A held notice is shown on whichever model opens next, so its words must be true there: the caller supplies a
 * separate sentence for that case.
 */
export const CANVAS_TOAST_EVENT = 'topbar:show-toast'

export type CanvasNoticeLevel = 'info' | 'success' | 'warning' | 'error'

export interface CanvasNotice {
  readonly message: string
  readonly level: CanvasNoticeLevel
}

/** A notice older than this is dropped rather than shown: it would no longer be about what the user just did. */
const HELD_MAX_AGE_MS = 10 * 60 * 1000
const HELD_MAX = 3

let held: Array<CanvasNotice & { readonly at: number }> = []

/**
 * Show `now` on the mounted canvas; if no canvas showed it, hold `later` for the next canvas that mounts.
 * Returns which happened.
 */
export function showCanvasNoticeOrHold(now: CanvasNotice, later: CanvasNotice): 'shown' | 'held' {
  if (typeof window === 'undefined') return 'held'
  const unhandled = window.dispatchEvent(new CustomEvent(CANVAS_TOAST_EVENT, { detail: now, cancelable: true }))
  if (!unhandled) return 'shown'
  held = [...held, { ...later, at: Date.now() }].slice(-HELD_MAX)
  return 'held'
}

/** The held notices still worth showing, oldest first; the hold is emptied. */
export function takeHeldCanvasNotices(now: number = Date.now()): CanvasNotice[] {
  const fresh = held.filter((n) => now - n.at <= HELD_MAX_AGE_MS).map(({ message, level }) => ({ message, level }))
  held = []
  return fresh
}

export function __resetHeldCanvasNoticesForTests(): void {
  held = []
}
