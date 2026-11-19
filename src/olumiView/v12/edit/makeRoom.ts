/**
 * MAKING ROOM FOR THE BOX (Paul, 19 Nov live test: "pop-overs cover the risk cards"). A full board leaves no side of a card clear of the others, so the
 * box beside a card sat on the next card. When that is so, the board slides (a short animated pan of the view, never a card's place in the model) until
 * the card and its box both stand in the free canvas with no other card under the box (`roomFor`, placeBeside.ts), and slides back when the box closes.
 *
 * The lane's canvas registers its camera here (ViewCanvas); without one (a spec with no canvas) nothing pans. One pan per box opening; the view the
 * person had is kept and given back when nothing is open any more, unless they moved the board themselves meanwhile (then their view stays).
 */
import { useLaneInspector } from './inspectorStore'

export type View = { readonly x: number; readonly y: number; readonly zoom: number }
export type BoxCamera = { readonly get: () => View; readonly set: (v: View, duration: number) => void }

/** The slide's length (ms): long enough to read as the board moving, short enough not to wait for. Reduced motion: none. */
export const ROOM_PAN_MS = 220

let camera: BoxCamera | null = null
let room: { saved: View; applied: View } | null = null

const still = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
const same = (a: View, b: View): boolean => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.zoom - b.zoom) < 1e-6

/** Is there a camera to pan? */
export const canMakeRoom = (): boolean => camera !== null

/** Slide the board by (dx, dy) screen px. The view before the first slide is kept, to be given back. The slide's length in ms is returned. */
export function slideBoard(dx: number, dy: number): number {
  if (camera === null || (dx === 0 && dy === 0)) return 0
  const v = camera.get(), to = { x: v.x + dx, y: v.y + dy, zoom: v.zoom }, ms = still() ? 0 : ROOM_PAN_MS
  room = { saved: room?.saved ?? v, applied: to }
  camera.set(to, ms)
  return ms
}

/** Nothing is open any more: give the person's view back, if the board is still where the slide left it. */
export function giveBackRoom(): void {
  if (room === null || camera === null) { room = null; return }
  const r = room
  room = null
  if (same(camera.get(), r.applied)) camera.set(r.saved, still() ? 0 : ROOM_PAN_MS)
}

/** The lane's canvas registers its camera while it is up; the box's closing (nothing open) gives the view back. Returns the stop. */
export function registerBoxCamera(c: BoxCamera): () => void {
  camera = c
  const off = useLaneInspector.subscribe((s, prev) => { if (s.current === null && prev.current !== null) giveBackRoom() })
  return () => { off(); if (camera === c) { camera = null; room = null } }
}
