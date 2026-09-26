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
export const TOP_CLEARANCE = 'calc(var(--topbar-h, 0px) + 1rem)'
export const TOAST_TOP_CLEARANCE = 'calc(var(--topbar-h, 0px) + 1.5rem)'
