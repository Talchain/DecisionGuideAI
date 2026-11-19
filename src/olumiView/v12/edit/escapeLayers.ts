/**
 * ONE ESCAPE RULE (Paul, 18 Nov: every surface closes; nothing needs two presses): Escape closes the TOP-most open layer once, and only that layer.
 * A menu, a drawer, a modal, a form or the canvas's own surface (LaneEditingLayer: the details box, an edit form, the right-click menu) registers while it
 * is open (`useEscapeLayer`), in the order it opened; the one listener below, in the capture phase on `window`, hands the press to the newest layer and
 * stops it there, so no layer under it also sees the key and none needs a listener of its own. A layer's `close` may answer 'yield' (the press is not
 * its own: a text field of another surface, a modal that closes itself; nothing is taken and the key goes on) or 'pass' (taken, but the surface closes
 * through its own key handler, so the press travels on, marked taken for a waiting challenge). Escape inside a text field only closes the layer: what was
 * typed stays where it was (a form folds with its draft).
 */
import { useEffect, useRef } from 'react'

/**
 * Escape keys a canvas surface has taken. The one key listener (escapeLayers) records every Escape it consumed; a waiting challenge's own
 * listener reads this, so one press closes the top canvas surface and only the next one cancels the challenge.
 */
const consumed = new WeakSet<Event>()
export const consumeEscape = (e: Event): void => { consumed.add(e) }
export const escapeConsumed = (e: Event): boolean => consumed.has(e)

export type EscapeTake = void | 'pass' | 'yield'
type Close = (e: KeyboardEvent) => EscapeTake
interface Layer { readonly id: number; readonly close: { current: Close } }
const stack: Layer[] = []
let next = 0, on = false

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || escapeConsumed(e)) return
  const top = stack[stack.length - 1]
  if (top === undefined) return
  const took = top.close.current(e)
  if (took === 'yield') return
  consumeEscape(e)
  if (took !== 'pass') e.stopPropagation()
}

/**
 * While `open`, this surface is a layer: the newest open one is the one Escape closes. `close` is read at the press, so it may change freely.
 * `again`: a value whose change puts the layer back on top (the canvas surface shown anew, in place of the one it replaced).
 */
export function useEscapeLayer(open: boolean, close: Close, again?: unknown): void {
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return undefined
    const layer: Layer = { id: ++next, close: closeRef }
    stack.push(layer)
    if (!on) { window.addEventListener('keydown', onKey, true); on = true }
    return () => {
      const at = stack.findIndex((l) => l.id === layer.id)
      if (at >= 0) stack.splice(at, 1)
      if (stack.length === 0 && on) { window.removeEventListener('keydown', onKey, true); on = false }
    }
  }, [open, again])
}
