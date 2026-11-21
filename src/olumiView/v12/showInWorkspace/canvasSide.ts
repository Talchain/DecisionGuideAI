/**
 * The canvas's side of the camera port (cameraPort.ts), written here so that the whole of it is this folder's own, typed and tested, and
 * the canvas owner's hunk is only two things: `showHolds()` read by the board's ONE framing loop (it WAITS while it is true and then
 * goes on as it would have, for a new board and for a resize alike), and one registration:
 *
 *   useEffect(() => registerShowCameraPort(makeShowCameraPort({ getViewport, setViewport, getInternalNode, userMoved, hand, fit })), [...])
 *
 * EVERY camera call this port makes: `refit` is the canvas's Fit button (`userMoved = false; hand(); fit()`), asked once after an unfold;
 * `moveTo` is one `setViewport` as the person's own move (`userMoved = true; hand()`), as the canvas's reveal-return makes. No loop, no
 * framing of its own: there is one camera, the canvas's.
 *
 * What each member needs of the canvas is the `CanvasSide` below: React Flow's own three camera calls and the three things only the
 * canvas knows (whether the person holds the camera, the one function every person-made move goes through, and its own framing).
 */
import type { ReactFlowInstance } from '@xyflow/react'
import { takeShowHold, type Box, type Pane, type ShowCameraPort, type Viewport } from './cameraPort'
import { FOOT_GUTTER, QUESTION, VIEW_CARD, boardOf, freePane, levelOf, useCanvasStore, useViewStore, viewLaying } from './deps'

export interface CanvasSide {
  getViewport(): Viewport
  setViewport(to: Viewport, opts: { duration: number }): unknown
  getInternalNode(id: string): { readonly measured: { readonly width?: number; readonly height?: number }; readonly internals: { readonly positionAbsolute: { readonly x: number; readonly y: number } } } | undefined
  /** Whether the person holds the camera (the canvas's `userMoved`): the board does not refit under a camera that is held. */
  readonly userMoved: { current: boolean }
  /** Every control that moves the camera for the person says so through this one function (the canvas's `hand`): pending pans stand down. */
  hand(): void
  /** The board's own framing of the board on screen (the canvas's `fit`); it answers the frame it asked for, if any. */
  fit(): unknown
}

/** Compile-time only: React Flow's own three camera calls are what `CanvasSide` asks of them. The canvas's own three are checked where it registers. */
type Is<T extends true> = T
export type ReactFlowCallsFitCanvasSide = Is<Pick<ReactFlowInstance, 'getViewport' | 'setViewport' | 'getInternalNode'> extends Pick<CanvasSide, 'getViewport' | 'setViewport' | 'getInternalNode'> ? true : false>

const frame = (f: () => void): void => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => f()); else setTimeout(f, 16) }

/**
 * Not `settleIdsOf` (layout.ts, the board's own framing): that waits only for cards the canvas already holds, and a show must wait for
 * the cards the View NOW draws (a badge just opened adds cards the canvas does not hold yet).
 *
 * Where everything the View now draws stands on the canvas, as one string: null while any card the View draws is missing or unmeasured,
 * or while the canvas still holds a card the View no longer draws. The camera is part of it, so a move still easing is not "settled".
 */
function placesOf(c: CanvasSide): string | null {
  const model = useViewStore.getState().view?.model ?? null
  const wanted = model === null ? [] : [QUESTION, ...boardOf(model).model.cards.map((card) => card.id)]
  const parts: string[] = []
  for (const id of wanted) {
    const n = c.getInternalNode(id)
    if (n === undefined || !n.measured.width || !n.measured.height) return null
    parts.push(`${id}@${n.internals.positionAbsolute.x},${n.internals.positionAbsolute.y},${n.measured.width},${n.measured.height}`)
  }
  const drawn = new Set(wanted)
  if (useCanvasStore.getState().nodes.some((n) => n.type === VIEW_CARD && !drawn.has(n.id))) return null
  const v = c.getViewport()
  return `${parts.join('|')}#${v.x},${v.y},${v.zoom}`
}

export function makeShowCameraPort(c: CanvasSide): ShowCameraPort {
  const pane = (): Pane | null => {
    const el = typeof document === 'undefined' ? null : document.querySelector('.react-flow')
    if (el === null) return null
    // The foot gutter is not free canvas (footClear.ts FOOT_GUTTER): the foot controls stand in it, and on Simple the board's foot edge
    // covers whatever is behind it (BelowCue). A card whose foot is in it is not in view, whatever the fit padding says.
    const p = freePane(el)
    return { size: p.size, inset: { ...p.inset, bottom: Math.max(p.inset.bottom, FOOT_GUTTER) } }
  }
  return {
    capture: () => ({ viewport: c.getViewport(), held: c.userMoved.current }),
    settled: (signal) => new Promise<boolean>((resolve) => {
      if (signal.aborted) { resolve(false); return }
      let last: string | null = null, over = false
      const end = (ok: boolean): void => { if (over) return; over = true; signal.removeEventListener('abort', stop); resolve(ok) }
      const stop = (): void => end(false)
      signal.addEventListener('abort', stop, { once: true })
      const tick = (): void => {
        if (over) return
        const here = placesOf(c)
        if (here !== null && here === last && !viewLaying()) { end(true); return }
        last = here
        frame(tick)
      }
      frame(tick)
    }),
    boxOf: (ids): Box | null => {
      if (ids.length === 0) return null
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const id of ids) {
        const n = c.getInternalNode(id)
        if (n === undefined || !n.measured.width || !n.measured.height) return null
        const at = n.internals.positionAbsolute
        x0 = Math.min(x0, at.x); y0 = Math.min(y0, at.y); x1 = Math.max(x1, at.x + n.measured.width); y1 = Math.max(y1, at.y + n.measured.height)
      }
      // On Simple a row is top-aligned. Extend the box to the foot of every card that starts above the named cards' own foot,
      // so fitting the box also brings those cards fully into view. BelowCue is only a floating cue on the left;
      // no band hides rows at the canvas's foot.
      if (levelOf(useViewStore.getState().sid) === 'simple') {
        const foot = y1
        for (const node of useCanvasStore.getState().nodes) {
          if (node.type !== VIEW_CARD) continue
          const n = c.getInternalNode(node.id)
          if (n === undefined || !n.measured.height) continue
          const top = n.internals.positionAbsolute.y
          if (top < foot) y1 = Math.max(y1, top + n.measured.height)
        }
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    },
    pane,
    moveTo: (to, { duration }) => { c.userMoved.current = true; c.hand(); void c.setViewport(to, { duration }) },
    refit: () => {
      c.userMoved.current = false
      c.hand()
      const v = c.fit() as Partial<Viewport> | null | undefined
      return v != null && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.zoom === 'number' ? { x: v.x, y: v.y, zoom: v.zoom } : null
    },
    hold: () => {
      const end = takeShowHold()
      c.hand()
      return (held) => {
        if (!end()) return
        // Only a run nothing newer overtook says who holds the camera afterwards: an overtaken one (null) ends its hold and writes nothing.
        // This port frames nothing here: a new board or a resize that came during the hold is the canvas's own loop's to frame, which
        // was waiting and now goes on (unless the camera is held, by the canvas's own rule).
        if (held !== null) c.userMoved.current = held
      }
    },
  }
}
