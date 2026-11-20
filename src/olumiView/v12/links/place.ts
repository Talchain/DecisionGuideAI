/**
 * Where a link's label-layer parts stand (its words, its remove control, a stance chip) is geometry that changes with the board, so it is written to two
 * custom properties on the element (`--link-x`, `--link-y`, in flow px), exactly as the lane's one Tip writes `--tip-x` / `--tip-y`; olumiLook.css
 * (`.ok-link-words`, `.ok-link-ctl`, `.ok-link-chip`) turns them into the transform. No component writes an inline style.
 */
export const placeAt = (el: HTMLElement | null, x: number, y: number): void => {
  if (el === null) return
  el.style.setProperty('--link-x', `${x}px`)
  el.style.setProperty('--link-y', `${y}px`)
}
