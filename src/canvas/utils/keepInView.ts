/**
 * KEEP A BOX IN THE FREE CANVAS (R5, github-3c on Paul's "visible through canvas reflow"; set-visible.mjs check 3). The smallest pan, in
 * screen px, that brings `box` wholly inside `free` (the canvas left once its chrome is taken off: the top bar, the lens bar, the dock, as
 * the camera's own fit measures them). Zero where it already fits; where it is larger than the free canvas, its top-left is kept in view.
 */
export type ScreenBox = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

export function panToKeepInView(box: ScreenBox, free: ScreenBox): { dx: number; dy: number } {
  const axis = (lo: number, hi: number, min: number, max: number) => (lo < min ? min - lo : hi > max ? Math.max(max - hi, min - lo) : 0)
  return { dx: axis(box.left, box.right, free.left, free.right), dy: axis(box.top, box.bottom, free.top, free.bottom) }
}
