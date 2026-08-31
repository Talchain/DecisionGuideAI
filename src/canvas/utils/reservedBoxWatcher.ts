/**
 * reservedBoxWatcher — re-fit when the RESERVED BOX changes, not only when the
 * layout changes.
 *
 * WHY (`WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` §5.1): a lane witnessed
 * the camera stranded at zoom 0.385 after the conversation panel closed, while
 * the computed fit for the new, larger box was 0.582 — the graph sitting 34%
 * smaller than it needed to be, live, on the deployed build. `fitView` ran once
 * per completed layout and never again, so every pixel of canvas won back by
 * collapsing the dock (or, now, by the floating panel no longer reserving) was
 * won and then not spent.
 *
 * THE SIGNAL IS DERIVED, NOT MIRRORED (CLAUDE.md trap 12). This watcher does not
 * keep a list of "things that change the reserved box" and hope it stays
 * current — it recomputes `computeFitPadding()` and compares the result. A
 * trigger we failed to think of degrades to the previous behaviour (no
 * re-fit), never to a wrong fit. The triggers are therefore allowed to be
 * approximate, and the decision never is.
 *
 * ⚠⚠ THIS PARAGRAPH USED TO END *"a trigger that fires spuriously costs four
 * `getBoundingClientRect` calls and changes nothing"*. **THAT WAS FALSE, AND IT
 * WAS THE LOAD-BEARING WRONG ASSUMPTION IN DEFECT #1051** (measured 31 Aug 2026,
 * `panZoom.setViewport` wrapped so every camera write named its caller). A
 * spurious fire costs THE USER'S CAMERA: this watcher's `onChange` runs the
 * product's floored auto-fit, which on `build-vs-buy` overwrote the overview the
 * user had just asked for — 0.2630 with 19 of 19 nodes in the pane, replaced
 * 155ms later by 0.5000 with 9 of 19. The sentence taught two lanes that this
 * path was free, which is exactly what a false comment does (trap 14), so it is
 * corrected here rather than deleted.
 *
 * ⚠ AND A SPURIOUS FIRE IS STILL REACHABLE — LATENT, NOT FIXED, RECORDED HERE
 * FOR WHOEVER TOUCHES THIS FILE NEXT. `last` is taken at SUBSCRIBE time, at
 * canvas mount, while the OutputsDock is still a 68px rail; the dock reaches its
 * expanded 444px reservation ~2.4s later, so the first trigger after that —
 * often the user's own first `pointerup` — sees a "change" that is really just
 * the app finishing its startup. Traced directly:
 *
 *     {"ev":"subscribe","last":"73px|68px|29px|76px"}
 *     {"ev":"check","last":"73px|68px|29px|76px","next":"73px|444px|29px|76px","changed":true}
 *
 * It can no longer take the user's camera (`utils/userCameraClaim.ts` stops
 * that), so it is a latent oddity rather than a live defect and was deliberately
 * NOT fixed in #1059. It is still a re-fit nobody asked for at an arbitrary
 * moment ~2.4s into every session. If you are here to change this file, that is
 * the thing to fix: baseline the signature once the canvas is actually settled,
 * rather than at mount.
 *
 * ⚠ BUT "DEGRADES TO NO RE-FIT" IS STICKY, AND THERE IS A NAMED HOLE (recorded
 * at the #786 review rather than left to be discovered). None of the triggers
 * fires when a `position: fixed` OVERLAY MOUNTS: the `ResizeObserver` watches
 * `.react-flow`, whose box does not change when something is painted on top of
 * it. So if the top bar is not yet measurable at fit time, `max(0, ...)` yields
 * the old base margin and nothing later notices. The top bar mounts with the
 * route, ahead of the canvas, so this is not reachable today — but it is pinned
 * as a VALUE test ("the padding is 73px given this rect"), never as a RECOVERY
 * test ("the padding self-corrects after the rect appears"), and the difference
 * is exactly what would be missed.
 *
 * The trigger set, each with its reason:
 *  - `resize` on window — the viewport itself changed.
 *  - `transitionend` (capture) — the dock's collapse/expand animates its width.
 *  - `pointerup` (capture) — the end of a dock width drag; the style lands in
 *    the same commit, which the settle re-check below covers.
 *  - a `ResizeObserver` on the pane, when available — covers anything that
 *    resizes `.react-flow` itself without a window resize.
 *
 * Every trigger is coalesced onto the next animation frame AND re-checked once
 * after `RESERVED_BOX_SETTLE_MS`, because a collapse animates: the frame after
 * the click still reads the OLD width, and only the settle read sees the new
 * one. Both reads are cheap and idempotent — the signature comparison is what
 * decides.
 */

import { computeFitPadding, type FitPadding } from './computeFitPadding'

/**
 * Long enough to outlast the dock's width transition and short enough that the
 * user does not see a stale frame. The transition is a Tailwind default-duration
 * class on the dock shell; this is deliberately a settle WINDOW rather than a
 * mirror of that duration, so a styling change cannot silently break it.
 */
export const RESERVED_BOX_SETTLE_MS = 360

/** The comparable form of a reserved box — four px strings, order-stable. */
export function reservedBoxSignature(padding: FitPadding): string {
  return `${padding.top}|${padding.right}|${padding.bottom}|${padding.left}`
}

export interface ReservedBoxWatcherOptions {
  /** Injected in tests; defaults to the live measurement. */
  readonly measure?: () => FitPadding
  readonly settleMs?: number
}

/**
 * Call `onChange` whenever the reserved box's signature changes. Returns an
 * unsubscribe. Safe to call in a non-DOM environment (returns a no-op).
 */
export function watchReservedBox(
  onChange: (signature: string) => void,
  options: ReservedBoxWatcherOptions = {},
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}

  const measure = options.measure ?? (() => computeFitPadding())
  const settleMs = options.settleMs ?? RESERVED_BOX_SETTLE_MS

  let last = reservedBoxSignature(measure())
  let frame: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const check = () => {
    if (disposed) return
    const next = reservedBoxSignature(measure())
    if (next === last) return
    last = next
    onChange(next)
  }

  const schedule = () => {
    if (disposed) return
    if (frame === null) {
      frame = window.requestAnimationFrame(() => {
        frame = null
        check()
      })
    }
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null
        check()
      }, settleMs)
    }
  }

  window.addEventListener('resize', schedule)
  document.addEventListener('transitionend', schedule, true)
  document.addEventListener('pointerup', schedule, true)

  let observer: ResizeObserver | null = null
  const pane = document.querySelector('.react-flow')
  if (pane && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule)
    observer.observe(pane)
  }

  return () => {
    disposed = true
    window.removeEventListener('resize', schedule)
    document.removeEventListener('transitionend', schedule, true)
    document.removeEventListener('pointerup', schedule, true)
    observer?.disconnect()
    if (frame !== null) window.cancelAnimationFrame(frame)
    if (timer !== null) clearTimeout(timer)
  }
}
