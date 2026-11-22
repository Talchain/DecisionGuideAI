/**
 * ONE ESCAPE RULE (Paul, 18 Nov: every surface closes; nothing needs two presses): Escape is first the key of whatever the person is in. A component with
 * its own Escape handler (a popover, a menu, a dialog, a field) closes itself and marks the press handled with `preventDefault()` (or stops it). Only a press
 * nothing handled goes to the shared stack: it closes the newest open layer once, and only that layer.
 * A surface that has no handler of its own registers while it is open (`useEscapeLayer`), in the order it opened. So a popover opened over a layer closes
 * first, whether or not it is registered, and a second press closes the layer.
 *
 * The stack acts last. The window's capture phase only notes the press and adds a one-time bubble listener on `window`, so it is the last listener of that press,
 * after every element, document and window handler, however late each registered.
 * A text field only closes the layer: what was typed stays where it was (a form folds with its draft).
 */
import { useEffect, useRef } from 'react'

type Close = () => void
interface Layer { readonly id: number; readonly close: { current: Close }; readonly floor: boolean }
const stack: Layer[] = []
let next = 0

/** Is any layer open? A listener that is not a surface (the canvas's selection clearing) leaves the press to the stack while one is. */
export const escapeLayerOpen = (): boolean => stack.some((l) => !l.floor)

/** The newest open surface; a floor (a state waiting, not a surface) only when no surface is open. */
const topOf = (): Layer | undefined => [...stack].reverse().find((l) => !l.floor) ?? stack[stack.length - 1]

function closeTop(e: KeyboardEvent): void {
  if (e.defaultPrevented) return
  const top = topOf()
  if (top === undefined) return
  e.preventDefault()
  top.close.current()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || stack.length === 0) return
    window.addEventListener('keydown', (later) => { if (later === e) closeTop(e) }, { once: true })
  }, true)
}

/**
 * While `open`, this surface is a layer: the newest open one is the one an unhandled Escape closes. `close` is read at the press, so it may change freely.
 * `again`: a value whose change puts the layer back on top (the canvas surface shown anew, in place of the one it replaced).
 */
export function useEscapeLayer(open: boolean, close: Close, again?: unknown): void {
  useLayer(open, close, again, false)
}

/** A state waiting beneath every surface (a challenge waiting for its card): it takes Escape only when no surface is open, whenever it began. */
export function useEscapeFloor(open: boolean, close: Close): void {
  useLayer(open, close, undefined, true)
}

/** Register a surface that already owns its own open lifecycle. */
export function registerEscapeLayer(close: Close): () => void {
  return addLayer({ current: close }, false)
}

function addLayer(close: Layer['close'], floor: boolean): () => void {
  const layer: Layer = { id: ++next, close, floor }
  stack.push(layer)
  return () => {
    const at = stack.findIndex((l) => l.id === layer.id)
    if (at >= 0) stack.splice(at, 1)
  }
}

function useLayer(open: boolean, close: Close, again: unknown, floor: boolean): void {
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (open) return addLayer(closeRef, floor)
  }, [open, again, floor])
}
