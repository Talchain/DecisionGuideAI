/**
 * Where a fixed, top-anchored canvas overlay starts: BELOW the top bar.
 *
 * v3.1 WS2 (#5) made the canvas top bar full-width, 51px tall and z-index
 * 3000, and `TopBar` publishes its height as `--topbar-h`. Every overlay that
 * used to pin itself at `top-4` / `top-6` then sat under it: the reconnect
 * banner was covered completely (#2078 review 5842363420), so the canvas stayed
 * in a mode that rewires an edge on the next node click with nothing on screen
 * saying so. The layout banner and the toasts covered the bar's title and
 * controls instead.
 *
 * The offsets keep each overlay's old distance from the top of whatever is
 * above it: `1rem` (was `top-4`) and `1.5rem` (was `top-6`). With no top bar
 * (`--topbar-h` is `0px` in `index.css`) the rendered position is unchanged.
 */
export const TOP_CLEARANCE = 'calc(max(var(--topbar-h, 0px), var(--chrome-top-left, 0px)) + 1rem)'
export const TOAST_TOP_CLEARANCE = 'calc(max(var(--topbar-h, 0px), var(--chrome-top-left, 0px)) + 1.5rem)'

/**
 * 1 Oct 2026 (Paul): the app bar is a top-LEFT pill and `--topbar-h` is 0, so the dock runs the full height. Things
 * that live in the top-left column or across the top centre still clear the pill: `--chrome-top-left` is its bottom
 * edge (`TopBar.tsx`). The larger of the two edges wins, so a full-width bar, if one ever returns, is still cleared.
 */
export const TOP_LEFT_CLEARANCE_CSS = 'max(var(--topbar-h, 0px), var(--chrome-top-left, 0px))'

/** The same edge in px, for code that positions in JS (the left inspector, the left popovers). 0 with no chrome. */
export function topLeftChromeBottomPx(): number {
  if (typeof document === 'undefined') return 0
  const cs = getComputedStyle(document.documentElement)
  const bar = parseFloat(cs.getPropertyValue('--topbar-h')) || 0
  const pill = parseFloat(cs.getPropertyValue('--chrome-top-left')) || 0
  return Math.max(bar, pill)
}
