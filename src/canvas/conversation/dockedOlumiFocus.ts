/**
 * dockedOlumiFocus — the focus channel for the DOCKED Olumi composer.
 *
 * ## Why this is a SECOND channel and not a widening of the first
 *
 * `useFloatingFocus` already exists and answers "focus the floating/hero
 * composer". This one answers "focus the DOCKED composer". They look like one
 * concept and are not: the two surfaces are mutually exclusive by design
 * (`olumiSurface.resolveOlumiSurface`), they mount in different trees, and at
 * any moment at most one of them has an input to focus. Folding them into one
 * registry would mean the last surface to mount silently wins — which is the
 * "two authorities under one name" defect this estate pays for repeatedly
 * (platform trap 21). Two named channels, one per surface, and the caller
 * picks by asking which surface is hosting.
 *
 * ## What it fixes
 *
 * Nothing registered a focus channel for the docked composer at all, so
 * `revealOlumiSurface()` — the primitive every Ask-Olumi action funnels
 * through — could only ever focus the floating panel. On the dominant deployed
 * path (dock hosting Olumi, floating yielded and therefore NOT registered)
 * `focusFloating()` returned false and the composer the user was looking at
 * was never focused. The action "worked" and the user still had to click into
 * the box.
 *
 * Module-level rather than context, for the same reason `useFloatingFocus` is:
 * the callers are spread across the canvas, the inspector and the analysis
 * surface, and prop-drilling a ref through them is not worth a re-render.
 */

type FocusFn = () => void

let registered: FocusFn | null = null

/**
 * Called by the docked composer while it is actually rendering an input.
 * Returns its own unregister — and the identity check means a stale cleanup
 * from a previous mount cannot clear a newer registration.
 */
export function registerDockedOlumiFocus(fn: FocusFn): () => void {
  registered = fn
  return () => {
    if (registered === fn) registered = null
  }
}

/**
 * Focus the docked Olumi composer. Returns false when nothing is registered —
 * the dock is collapsed, on another tab, or in its status/redirect mode.
 *
 * ⚠ A false return is NOT an invitation to fall back to `focusFloating()`.
 * On the docked path the floating panel has deliberately deregistered, and
 * focusing whatever else happens to be in that slot is how the original defect
 * worked. No focus is the correct outcome when there is no composer.
 */
export function focusDockedOlumi(): boolean {
  if (!registered) return false
  registered()
  return true
}
