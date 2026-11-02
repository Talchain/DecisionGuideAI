/**
 * v10: where Olumi's coaching note stands (#/canvas2 only; every caller is gated on `usePresentation() === 'v10'`).
 *
 * The design QA (1 Nov 2026, defect 8) found the note floating at the bottom of the canvas while the focus ring sat on
 * the card it was about, and at 1280 clipped on the left and under the zoom controls. Two rules fix it here:
 *
 *  - A note about a record is PINNED BESIDE that record, on the side with the most room, with a short connector. It is
 *    placed from the card's own position and the camera, so it moves and zooms with the canvas.
 *  - A note about nothing keeps its place, but is always held inside the VISIBLE canvas: clear of the tool rails and zoom
 *    controls on the left, the top bar, the Outputs dock on the right and the overlay band at the foot.
 *
 * Everything below is measured from what is drawn (the same selectors the fit uses), never guessed. The geometry is a
 * pure function over boxes so it is proved without a browser.
 */
import { useLayoutEffect, useState, type RefObject } from 'react'
import { DOCK_SELECTOR, OVERLAY_BAND_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../canvas/utils/computeFitPadding'

export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** The visible canvas, as edges. */
export interface Bounds { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type NoteSide = 'right' | 'left' | 'below' | 'above'
export interface NoteSpot { readonly left: number; readonly top: number; readonly side: NoteSide }

/** Space between the record and its note, and between a note and the edge of the visible canvas (screen px). */
export const V10_NOTE_GAP = 14
export const V10_NOTE_WIDTH = 290
const SLIDE_PX = 16
const SLIDE_STEPS = 24

const VIEWPORT_CONTROLS_SELECTOR = 'nav[aria-label="Viewport controls"]'
const LENS_BAR_SELECTOR = '[data-testid="lens-bar"]'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)))

/** A note box moved the least distance that puts it wholly inside `bounds` (a note larger than the room pins to the top left). */
export function clampIntoBounds(box: Box, bounds: Bounds): { left: number; top: number } {
  return {
    left: clamp(box.x, bounds.left, bounds.right - box.w),
    top: clamp(box.y, bounds.top, bounds.bottom - box.h),
  }
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))

/**
 * Where a `size` note goes beside `anchor`, in one coordinate frame. The first choice is the side with the most spare
 * room whose spot covers no other card and lets the connector still meet the record. Failing that, the nearest free spot
 * along any side; failing that, the spot that covers the least. The result is always inside `bounds`.
 */
export function placeNoteBeside(anchor: Box, size: { w: number; h: number }, others: readonly Box[], bounds: Bounds, gap = V10_NOTE_GAP): NoteSpot {
  const { w, h } = size
  const inside = (s: { left: number; top: number }) => s.left >= bounds.left && s.top >= bounds.top && s.left + w <= bounds.right && s.top + h <= bounds.bottom
  const covered = (s: { left: number; top: number }) => others.reduce((sum, o) => sum + overlap({ x: s.left, y: s.top, w, h }, o), 0)
  const base: Record<NoteSide, { left: number; top: number }> = {
    right: { left: anchor.x + anchor.w + gap, top: anchor.y },
    left: { left: anchor.x - w - gap, top: anchor.y },
    below: { left: anchor.x, top: anchor.y + anchor.h + gap },
    above: { left: anchor.x, top: anchor.y - h - gap },
  }
  // Spare room on each side once the note and its gaps are taken out: the side with the most is the one with most room.
  const spare: Record<NoteSide, number> = {
    right: bounds.right - (anchor.x + anchor.w) - w - 2 * gap,
    left: anchor.x - bounds.left - w - 2 * gap,
    below: bounds.bottom - (anchor.y + anchor.h) - h - 2 * gap,
    above: anchor.y - bounds.top - h - 2 * gap,
  }
  const sides = (['right', 'left', 'below', 'above'] as const).slice().sort((a, b) => spare[b] - spare[a])
  const horizontal = (s: NoteSide) => s === 'right' || s === 'left'
  const at = (side: NoteSide, d: number): NoteSpot => ({
    side,
    left: base[side].left + (horizontal(side) ? 0 : d),
    top: base[side].top + (horizontal(side) ? d : 0),
  })
  // A slide keeps the connector meeting the record: the note must still overlap the record's span along that side.
  const meets = (s: NoteSpot) => horizontal(s.side)
    ? s.top < anchor.y + anchor.h - SLIDE_PX && s.top + h > anchor.y + SLIDE_PX
    : s.left < anchor.x + anchor.w - SLIDE_PX && s.left + w > anchor.x + SLIDE_PX

  const offsets = [0]
  for (let k = 1; k <= SLIDE_STEPS; k++) offsets.push(k * SLIDE_PX, -k * SLIDE_PX)
  const spots = offsets.flatMap((d) => sides.map((side) => at(side, d)))
  const fitting = spots.filter(inside)

  const beside = fitting.find((s) => meets(s) && covered(s) === 0)
  if (beside) return beside
  const nearestFree = fitting.find((s) => covered(s) === 0)
  if (nearestFree) return nearestFree
  const least = fitting.reduce<NoteSpot | null>((best, s) => (best === null || covered(s) < covered(best) ? s : best), null)
  if (least) return least
  const first = at(sides[0], 0)
  return { side: first.side, ...clampIntoBounds({ x: first.left, y: first.top, w, h }, bounds) }
}

/** The short line from the record's edge to the note's edge, in the same frame; null when the note sits on the record. */
export function connectorBetween(anchor: Box, note: Box): { x1: number; y1: number; x2: number; y2: number } | null {
  const on = (p: { x: number; y: number }, b: Box) => ({ x: clamp(p.x, b.x, b.x + b.w), y: clamp(p.y, b.y, b.y + b.h) })
  const p = on({ x: note.x + note.w / 2, y: note.y + note.h / 2 }, anchor)
  const q = on(p, note)
  return Math.hypot(q.x - p.x, q.y - p.y) < 1 ? null : { x1: p.x, y1: p.y, x2: q.x, y2: q.y }
}

const rectOf = (selector: string): DOMRect | null => {
  if (typeof document === 'undefined') return null
  const r = document.querySelector(selector)?.getBoundingClientRect()
  return r && r.width > 0 && r.height > 0 ? r : null
}

/**
 * The visible canvas in screen px: the canvas frame (the window when it has no size), less the tool rails and zoom
 * controls at its left, the top bar and lens bar above, the Outputs dock at its right and, unless `ignoreBand`, the overlay
 * band at its foot. A rail counts only if it sits in the frame's near half, so a wide panel never closes the canvas up.
 */
export function measureVisibleCanvas(frame?: Element | null, opts: { ignoreBand?: boolean } = {}): Bounds {
  const win = typeof window === 'undefined' ? { w: 1280, h: 800 } : { w: window.innerWidth, h: window.innerHeight }
  const fr = frame?.getBoundingClientRect()
  const f = fr && fr.width > 0 && fr.height > 0 ? { l: fr.left, t: fr.top, r: fr.right, b: fr.bottom } : { l: 0, t: 0, r: win.w, b: win.h }
  const midX = (f.l + f.r) / 2
  const midY = (f.t + f.b) / 2
  let left = f.l
  for (const sel of [SIDEBAR_SELECTOR, VIEWPORT_CONTROLS_SELECTOR]) {
    const r = rectOf(sel)
    if (r && r.right < midX) left = Math.max(left, r.right)
  }
  let top = f.t
  for (const sel of [TOP_BAR_SELECTOR, LENS_BAR_SELECTOR]) {
    const r = rectOf(sel)
    if (r && r.top < midY) top = Math.max(top, r.bottom)
  }
  const dock = rectOf(DOCK_SELECTOR)
  const right = dock && dock.left > midX ? Math.min(f.r, dock.left) : f.r
  const band = opts.ignoreBand ? null : rectOf(OVERLAY_BAND_SELECTOR)
  const bottom = band && band.top > midY ? Math.min(f.b, band.top) : f.b
  return { left: left + V10_NOTE_GAP, top: top + V10_NOTE_GAP, right: right - V10_NOTE_GAP, bottom: bottom - V10_NOTE_GAP }
}

/** Every card React Flow has drawn except `exceptId`, as boxes in the frame `origin` (a client rect). */
export function drawnCardsIn(origin: { left: number; top: number }, scope: ParentNode | null, exceptId?: string): Box[] {
  if (!scope) return []
  return Array.from(scope.querySelectorAll<HTMLElement>('.react-flow__node'))
    .filter((el) => el.getAttribute('data-id') !== exceptId)
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }))
}

/** Bounds from screen px into a frame whose top left is `origin`. */
export const boundsInFrame = (b: Bounds, origin: { left: number; top: number }): Bounds => ({
  left: b.left - origin.left, top: b.top - origin.top, right: b.right - origin.left, bottom: b.bottom - origin.top,
})

/**
 * A note about nothing keeps the place it has (a cell of the overlay band), then is nudged the least distance that puts it
 * wholly inside the visible canvas. Returns the style to put on the note; undefined while it already is inside.
 */
export function useKeepInView(ref: RefObject<HTMLElement | null>, active: boolean): { transform: string } | undefined {
  const [shift, setShift] = useState({ dx: 0, dy: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render; an equal shift bails out
  useLayoutEffect(() => {
    const el = ref.current
    if (!active || !el) return
    const r = el.getBoundingClientRect()
    if (!(r.width > 0 && r.height > 0)) return
    const frame = (el.closest(OVERLAY_BAND_SELECTOR) as HTMLElement | null)?.offsetParent ?? null
    const bounds = measureVisibleCanvas(frame, { ignoreBand: true })
    const natural: Box = { x: r.left - shift.dx, y: r.top - shift.dy, w: r.width, h: r.height }
    const to = clampIntoBounds(natural, bounds)
    const next = { dx: Math.round(to.left - natural.x), dy: Math.round(to.top - natural.y) }
    if (next.dx !== shift.dx || next.dy !== shift.dy) setShift(next)
  })
  return active && (shift.dx !== 0 || shift.dy !== 0) ? { transform: `translate(${shift.dx}px, ${shift.dy}px)` } : undefined
}
