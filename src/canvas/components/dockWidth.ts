/**
 * Responsive width for the right-hand OutputsDock.
 *
 * Why this module exists: the dock's expanded width used to be a single fixed
 * `--dock-right-expanded: 26rem` (416px) written into three hand-copied
 * inline literals — the mount path, the resize path and the drag path each
 * carried their own bounds. They agreed on the day they were written and
 * nothing would have gone red when they stopped. The rules now live here once.
 *
 * ⚠⚠ THE NARROWING THIS MODULE ORIGINALLY SHIPPED IS REVERTED (17 Aug 2026).
 * The ratio was set to 0.26 to buy graph legibility back from the dock: at
 * 1280x800 the fit box went 760px → 843px, and a later pre-analysis clamp
 * pushed it to 896px. **None of it was enough and none of it was ever going
 * to be.** The drafted 17-node graph measures 2016 flow-units, so at the 0.50
 * `LABEL_LEGIBLE_ZOOM` floor it needs 1008px — the post-draft `fitView`
 * clamps at the floor at 416px, at 333px AND at 280px alike (asserted in
 * `computeFitPadding.spec.ts`). The width was traded and the legibility was
 * never delivered, while the panel lost 35% of its content budget (390px →
 * 254px after borders and `px-3` padding) and every tab's formatting with it.
 *
 * So the default returns to 416 wherever the viewport allows. Closing the
 * 1008px gap needs the dock COLLAPSED, which is a workspace-shell decision,
 * not a width constant. This is containment; the canonical panel shell that
 * owns width, tabs, scroll regions and type scale is separate work.
 *
 * The rules, in one place so the mount path, the resize path and the drag
 * path cannot drift apart (they were three separate copies of the bounds):
 *
 *  - `dockWidthBounds` — the HARD bounds a user drag may reach. Unchanged
 *    from the previous inline copies (`280` .. `min(480, 40% of viewport)`),
 *    so an existing persisted width keeps behaving exactly as before.
 *  - `responsiveDockWidth` — what the dock is when the user has NEVER dragged
 *    it. Capped at the historic 416px, floored at 280px so it stays usable,
 *    and proportional only in the band between — which, at the restored
 *    ratio, is viewports NARROWER than 1280.
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
 * Ceiling for the RESPONSIVE default: the dock's last known usable width, and
 * still the declared default in `src/index.css:517`
 * (`--dock-right-expanded: 26rem`). Every viewport wide enough to reach it
 * gets it.
 */
export const DOCK_RESPONSIVE_MAX_WIDTH = 416

/**
 * Share of the viewport the dock takes before the ceiling bites.
 *
 * DERIVED, not chosen: `416 / 1280 = 0.325` exactly, so a 1280px laptop — the
 * viewport every measurement in this file was taken at — lands on the ceiling
 * rather than under it, and every wider screen is capped there too. Below
 * 1280 the dock tapers proportionally to the 280px floor, which is the one
 * part of the 0.26 experiment worth keeping: a fixed 416 on a 900px window is
 * 46% of the screen.
 *
 * ⚠ CHANGING THIS CHANGES THE DEFAULT AT EVERY VIEWPORT ≤ 416/ratio. The
 * containment pins in `dockWidth.spec.ts` and the MOUNTED pins in
 * `OutputsDock.dockWidth.dom.spec.tsx` bind 1280 / 1920 / 3840 by name so a
 * future ratio edit reds instead of drifting.
 */
export const DOCK_VIEWPORT_RATIO = 0.325

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
