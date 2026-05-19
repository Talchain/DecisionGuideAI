/**
 * useFloatingFocus — module-level focus channel for the floating Olumi panel.
 *
 * The floating panel registers a `focus()` callback on mount. Any other
 * surface (persistent status strip, Olumi tab click while floating is open)
 * can call `focusFloating()` to imperatively focus the floating panel's
 * textarea. Avoids prop-drilling a ref through multiple component layers.
 */

type FocusFn = () => void

let registered: FocusFn | null = null

export function registerFloatingFocus(fn: FocusFn): () => void {
  registered = fn
  return () => {
    if (registered === fn) registered = null
  }
}

export function focusFloating(): boolean {
  if (registered) {
    registered()
    return true
  }
  return false
}
