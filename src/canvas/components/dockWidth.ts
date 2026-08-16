/**
 * Responsive width for the right-hand OutputsDock.
 *
 * Why this module exists: the dock's expanded width was a single fixed
 * `--dock-right-expanded: 26rem` (416px) applied at every viewport. At a
 * 1280px laptop that is 32.5% of the screen, and because `computeFitPadding`
 * reserves whatever the dock occludes, it also removes 444px from the graph's
 * fitting box — measured 15 Aug 2026 at 1280x800: fit box 730px of 1280, the
 * post-draft `fitView` hit its `minZoom` legibility floor and the graph
 * overflowed the visible canvas.
 *
 * The rules, in one place so the mount path, the resize path and the drag
 * path cannot drift apart (they were three separate copies of the bounds):
 *
 *  - `dockWidthBounds` — the HARD bounds a user drag may reach. Unchanged
 *    from the previous inline copies (`280` .. `min(480, 40% of viewport)`),
 *    so an existing persisted width keeps behaving exactly as before.
 *  - `responsiveDockWidth` — what the dock is when the user has NEVER dragged
 *    it. Proportional to the viewport, capped at the historic 416px so wide
 *    screens are unchanged, floored at 280px so it stays usable.
 *  - `resolveDockWidth` — the width to apply right now. An explicit user
 *    width always wins over the responsive default; it is only re-clamped to
 *    the hard bounds, which is itself a fix (previously a width persisted at
 *    a wide viewport stayed 480px in a 900px window, where the clamp says 360).
 *
 * All three are pure so they can be unit-tested without a DOM.
 */

/** Narrowest usable dock. Never derived away — below this the panel content wraps unusably. */
export const DOCK_MIN_WIDTH = 280

/**
 * Ceiling for the RESPONSIVE default: the historic fixed width. Screens wide
 * enough to reach it get exactly the previous behaviour, so this change is a
 * laptop-size reduction and not a redesign.
 */
export const DOCK_RESPONSIVE_MAX_WIDTH = 416

/**
 * Share of the viewport the dock takes before the ceiling bites. 0.26 puts a
 * 1280px laptop at 333px (83px back to the canvas) and a 1600px screen back
 * at the historic 416px.
 */
export const DOCK_VIEWPORT_RATIO = 0.26

/** Hard bounds a user drag may reach — the pre-existing rule, now stated once. */
export function dockWidthBounds(viewportWidth: number): { min: number; max: number } {
  const usable = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0
  return {
    min: DOCK_MIN_WIDTH,
    // `max(min, …)` so a pathologically narrow viewport can never produce
    // max < min, which would make the clamp order-dependent.
    max: Math.max(DOCK_MIN_WIDTH, Math.min(480, Math.floor(usable * 0.4))),
  }
}

/** The dock's width when the user has never resized it. */
export function responsiveDockWidth(viewportWidth: number): number {
  const { min, max } = dockWidthBounds(viewportWidth)
  const proportional = Math.round((Number.isFinite(viewportWidth) ? viewportWidth : 0) * DOCK_VIEWPORT_RATIO)
  const ceiling = Math.min(DOCK_RESPONSIVE_MAX_WIDTH, max)
  return Math.max(min, Math.min(ceiling, proportional))
}

/**
 * The width to apply now.
 *
 * @param storedWidth the user's persisted explicit width, or `null` when they
 *   have never dragged the dock. `null` — not `0`, not `NaN` — is the signal
 *   that the responsive default applies; anything unparseable is treated the
 *   same way rather than silently becoming a number.
 */
export function resolveDockWidth(viewportWidth: number, storedWidth: number | null): number {
  const { min, max } = dockWidthBounds(viewportWidth)
  if (storedWidth == null || !Number.isFinite(storedWidth)) return responsiveDockWidth(viewportWidth)
  return Math.max(min, Math.min(max, Math.round(storedWidth)))
}

/** Parse the persisted value into the `number | null` `resolveDockWidth` expects. */
export function parseStoredDockWidth(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}
