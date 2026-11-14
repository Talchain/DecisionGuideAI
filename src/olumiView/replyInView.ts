/**
 * AI and canvas as one partner: when a NEW reply arrives that points at cards (core's `chat[].answer.next.about`, and `next.at` where it is
 * a card), the board moves so those cards are in view (panned; zoomed out only as far as needed, never in) and their ring pulses once.
 * Never on a reload or a reopened scenario (the first View seen for a scenario is the baseline), never while the person is dragging, and
 * never within `QUIET_MS` of their own pan or zoom, or if they move during the settle. Reduced motion: it jumps, no animation.
 * Nothing is written and no words are added: the cards are the ones the reply's ring already lights (ring.ts).
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { View } from './client'
import { useViewStore } from './store'
import { viewLaying } from './canvas'
import { nextCardsOf } from './layout'
import { freePane, tryInViewTarget } from './revealCamera'
import { pulseCards } from './ring'

const TICK = 250, MAX_TICKS = 40
/** The person's own pan or zoom this recently leaves the camera alone. */
export const QUIET_MS = 4000

export type ReplySeen = { readonly sid: string; readonly id: number }
/** What the person's own hand has done to the camera: the time of their last pan or zoom, and whether a drag is under way. */
export type Activity = { at: number; active: boolean }

/** The newest reply core has answered (the highest turn id with an answer) and the cards it points at, in core's order, only those on the board. */
export function newestReplyOf(view: View | null): { id: number; cards: readonly string[] } | null {
  let best: View['chat'][number] | null = null
  for (const t of view?.chat ?? []) if (t.answer != null && (best === null || t.id > best.id)) best = t
  if (best === null || best.answer == null) return null
  const on = new Set((view?.model?.cards ?? []).map((c) => c.id))
  const at = best.answer.next.at
  const ids = [...nextCardsOf(best.answer.next), ...(at == null ? [] : [at])]
  return { id: best.id, cards: [...new Set(ids)].filter((id) => on.has(id)) }
}

/**
 * The first View seen for a scenario only sets the baseline (a reload, or a scenario reopened, moves nothing). After it, a reply with a higher
 * id than any seen is new: its cards (possibly none) come back with the updated baseline. A different scenario starts over.
 */
export function replyArrival(seen: ReplySeen | null, sid: string | null, view: View | null): { seen: ReplySeen | null; cards: readonly string[] } {
  if (sid === null || view === null) return { seen, cards: [] }
  const newest = newestReplyOf(view)
  if (seen === null || seen.sid !== sid) return { seen: { sid, id: newest?.id ?? -1 }, cards: [] }
  if (newest === null || newest.id <= seen.id) return { seen, cards: [] }
  return { seen: { sid, id: newest.id }, cards: newest.cards }
}

/** May the camera move now: not while a drag is under way, and not within QUIET_MS of the person's own pan or zoom. */
export const cameraMayMove = (a: Activity, now: number): boolean => now - a.at >= QUIET_MS

type Box = { x: number; y: number; w: number; h: number }
/** Where the camera goes so every one of `box` is in the free canvas: null when it all is already (nothing moves). */
export function replyViewTarget(box: Box, pane: { w: number; h: number }, inset: { left: number; top: number; right: number; bottom: number }, viewport: { x: number; y: number; zoom: number }) {
  return tryInViewTarget({ box, pane, inset, viewport })
}

export function useReplyInView(movedAt: MutableRefObject<number>, activity: MutableRefObject<Activity>): void {
  const { getViewport, setViewport, getInternalNode } = useReactFlow()
  const seen = useRef<ReplySeen | null>(null)
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  // One arrival per new reply, held apart from the polled View so a later poll does not cancel the settle below.
  const [arrival, setArrival] = useState<{ n: number; ids: readonly string[] } | null>(null)
  useEffect(() => {
    const r = replyArrival(seen.current, sid, view)
    seen.current = r.seen
    if (r.cards.length > 0) setArrival((a) => ({ n: (a?.n ?? 0) + 1, ids: r.cards }))
  }, [view, sid])
  useEffect(() => {
    if (arrival === null) return
    const ids = arrival.ids
    // The person has the camera (mid-drag, or panned or zoomed a moment ago): the reply's ring still shows, the board stays put.
    if (!cameraMayMove(activity.current, Date.now())) return
    const moves = movedAt.current
    let ticks = 0, last = ''
    const t = setInterval(() => {
      ticks += 1
      if (moves !== movedAt.current || activity.current.active || ticks > MAX_TICKS) return clearInterval(t)
      const pane = document.querySelector('.react-flow')
      if (pane === null || viewLaying()) return
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
      for (const id of ids) {
        const n = getInternalNode(id)
        if (n === undefined || !n.measured.width || !n.measured.height) return
        const at = n.internals.positionAbsolute
        x0 = Math.min(x0, at.x); y0 = Math.min(y0, at.y); x1 = Math.max(x1, at.x + n.measured.width); y1 = Math.max(y1, at.y + n.measured.height)
      }
      // Settled: the cards and the camera kept their place for one tick (the board's own framing eases for 400 ms after a new version).
      const vp = getViewport(), here = `${x0},${y0},${x1},${y1},${vp.x},${vp.y},${vp.zoom}`
      if (here !== last) { last = here; return }
      clearInterval(t)
      const { size, inset } = freePane(pane)
      const to = replyViewTarget({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, size, inset, vp)
      const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      if (to === null) { pulseCards(ids); return }
      void setViewport(to, { duration: still ? 0 : 300 })
      setTimeout(() => pulseCards(ids), still ? 0 : 320)
    }, TICK)
    return () => clearInterval(t)
  }, [arrival, movedAt, activity, getViewport, setViewport, getInternalNode])
}
