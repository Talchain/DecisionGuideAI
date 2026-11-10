/**
 * THE CANVAS'S REGIONS (DL layout pass, 9 Nov 2026; from the V11 comp). The olumi-core lane's window has four named regions, and every
 * layout rule here reads them from this one module:
 *
 *   HEAD  the band along the canvas's top, from the window's top to just below its lowest head control (Model · Explore · Team),
 *         across the free canvas. Drawn opaque (CanvasHeadBand), so a card panned up goes under it.
 *   FOOT  the canvas's foot controls: the zoom row and the more-below cue. Reserved where they stand (not a full-width band: the
 *         canvas keeps the columns beside them).
 *   DOCK  the dock's column on the right (measureDockInset).
 *   FREE  what is left: where cards are read.
 *
 * Z-ORDER RULE: nothing may cover an open card, its form, or the composer. Cards live inside React Flow's transformed layer (its own
 * stacking context), so no z-index can lift a card above a fixed control. The mechanism is the camera: when a card is opened or focus enters
 * it (its editor included), the board moves by just enough that the card clears HEAD, FOOT and DOCK (`clearOf`). The composer is the dock's
 * own (its footer stack, round 5). The z scale, low to high: canvas 0 · HEAD band 4 · FOOT controls 5 · left toolbar and its add form
 * 1100 · more-below cue 1200 · lens chips 1250 (they sit on the band).
 *
 * FIRST-PAINT RULE: the board opens on the question, its aims and the options, and at least the person's first figure row; where that
 * cannot fit at zoom 1 (the 12/14/18 type rule forbids zooming out), the more-below cue says how many cards are below (BelowCue).
 */
import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { measureDockInset } from '../canvas/components/FloatingOlumiPanel'
import { LENS_BAR_TESTID } from '../canvas/artefacts/LensBar'

export type Rect = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number }
export type Regions = { readonly head: Rect; readonly foot: readonly Rect[]; readonly dock: Rect }

/**
 * FIRST-PAINT NUMBERS (DL ruling 9 Nov: hiring must fit at zoom 1; owned here, read by layout.ts headFirst).
 * STORY_ROOM_Y: the room between the options and the first story row, flow px (was TREE_ROOM_Y 96 plus a jump past the room).
 * FOOT_CLEAR: how far above the layout's room foot (canvas.ts roomOf, the fit's insets) a story card over the foot controls' columns
 * (FOOT_W) must end to be read whole above them; a row any card of which would end lower starts past the room instead, never drawn cut.
 */
export const STORY_ROOM_Y = 20
/** Measured at 1232x704 (9 Nov): the room's foot is 52 px below the foot controls' top; plus REGION_GAP. */
export const FOOT_CLEAR = 64
/** The foot controls' span from the canvas's left, px: the zoom row and, beside it, the more-below cue. A card right of it needs only to end
 *  within the room; a card over it must end FOOT_CLEAR above the room's foot. */
export const FOOT_W = 360
/** Clear space kept between a card and a region, px. */
export const REGION_GAP = 12
/** Clear space below the lowest head control, px. */
export const BAND_GAP = 8
export const HEAD_CONTROLS = [`[data-testid="${LENS_BAR_TESTID}"]`] as const
export const FOOT_CONTROLS = ['nav[aria-label="Viewport controls"]', '[data-testid="view-below-cue"] button'] as const

/** HEAD's height: the lowest head control's foot plus the gap; 0 when none is drawn. */
export function headHeightOf(feet: readonly number[]): number {
  let low = 0
  for (const f of feet) if (f > low) low = f
  return low === 0 ? 0 : Math.ceil(low + BAND_GAP)
}

/**
 * The camera's top inset, never above HEAD (round 7: the suite's hiring board framed 23 px under the band). The fit's padding can be read
 * before the chips row is placed; then the top-left column's foot (`--chrome-top-left`, as canvas.ts roomOf reads it) plus BAND_GAP stands in.
 */
export function frameTop(top: number): number {
  if (typeof document === 'undefined') return top
  const column = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-top-left')) || 0
  return Math.max(top, regionsOf().head.bottom, column === 0 ? 0 : column + BAND_GAP)
}

const rectsOf = (sels: readonly string[]) => sels.flatMap((s) => [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect()))

/** The regions as the window draws them now. */
export function regionsOf(): Regions {
  const W = window.innerWidth, H = window.innerHeight, inset = measureDockInset()
  const head = headHeightOf(rectsOf(HEAD_CONTROLS).map((r) => r.bottom))
  return { head: { left: 0, right: W - inset, top: 0, bottom: head }, foot: rectsOf(FOOT_CONTROLS), dock: { left: W - inset, right: W, top: 0, bottom: H } }
}

const across = (a: Rect, b: Rect) => Math.min(a.right, b.right) > Math.max(a.left, b.left)
const along = (a: Rect, b: Rect) => Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)

/**
 * How far (px) the board must move so `card` clears the regions: `dy` up (negative) when a foot control is under it, down (positive) when
 * the head band covers its top; `dx` left (negative) when it runs into the dock. Its top wins over its foot when it cannot clear both, so the
 * card's heading is always read. 0, 0 when it is clear.
 */
export function clearOf(card: Rect, r: Regions): { dx: number; dy: number } {
  let up = 0
  for (const f of r.foot) if (across(card, f) && card.bottom > f.top - REGION_GAP) up = Math.max(up, card.bottom - (f.top - REGION_GAP))
  // The band already keeps its own gap (BAND_GAP): a card is clear of it once its top is below the band.
  const down = r.head.bottom > 0 && across(card, r.head) && card.top < r.head.bottom ? r.head.bottom - card.top : 0
  // Moving up by `up` must not push its top under the head: then show its top.
  const dy = down > 0 ? down : up > 0 ? -Math.min(up, Math.max(0, card.top - r.head.bottom)) : 0
  const dx = card.right > r.dock.left - REGION_GAP && along(card, r.dock) ? -(card.right - (r.dock.left - REGION_GAP)) : 0
  return { dx: Math.trunc(dx), dy: Math.trunc(dy) }
}

/**
 * The z-order rule's mechanism: when focus enters a canvas card (opening it, or its editor), once the card has kept its size for a frame the
 * board moves by `clearOf`. Nothing moves when it is clear; nothing zooms.
 */
export function useCardClearOfRegions(): void {
  const { getViewport, setViewport } = useReactFlow()
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null
    const into = (e: FocusEvent) => {
      const node = e.target instanceof Element ? e.target.closest('.react-flow__node-viewCard') : null
      if (node === null) return
      // The card as drawn (its bordered box), not React Flow's node wrapper.
      const card = node.querySelector('[data-view-card]') ?? node
      if (t !== null) clearInterval(t)
      let last = '', ticks = 0
      t = setInterval(() => {
        ticks += 1
        // D2: a card's figure editor opens under the card, out of its flow (FigureEdit); the box kept clear is the card with that panel.
        const c = card.getBoundingClientRect(), p = node.querySelector('[data-figure-edit-panel]')?.getBoundingClientRect()
        const b = p === undefined ? c : new DOMRect(Math.min(c.left, p.left), Math.min(c.top, p.top), Math.max(c.right, p.right) - Math.min(c.left, p.left), Math.max(c.bottom, p.bottom) - Math.min(c.top, p.top))
        const here = `${b.top},${b.height}`
        if (!card.isConnected || ticks > 40) { clearInterval(t!); t = null; return }
        if (here !== last) { last = here; return }
        clearInterval(t!); t = null
        const { dx, dy } = clearOf(b, regionsOf())
        if (dx === 0 && dy === 0) return
        const v = getViewport(), still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
        void setViewport({ ...v, x: v.x + dx, y: v.y + dy }, { duration: still ? 0 : 200 })
      }, 50)
    }
    document.addEventListener('focusin', into)
    return () => { document.removeEventListener('focusin', into); if (t !== null) clearInterval(t) }
  }, [getViewport, setViewport])
}
