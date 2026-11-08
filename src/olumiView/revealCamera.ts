/**
 * V11: the team's disagreement is seen without looking for it. Once per reveal (the scenario and its chip views), after the board has
 * settled, if a chip (./RevealMarks.tsx) lies outside the canvas, the board is panned just enough to bring it in, at the person's own zoom.
 * Never after the person has moved the board themselves, and never again for the same reveal. Paul's 1232 x 704 screen framed the board
 * top-aligned with the chip below the fold (7 Nov shots).
 */
import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useViewStore } from './store'
import { revealOf, useReveal } from './reveal'
import { evidenceCards } from './evidence'
import type { View } from './client'
import { viewLaying } from './canvas'
import { chipViewIds } from './layout'

/** Room kept between the chip and the canvas's edge (px). */
const MARGIN = 40
const TICK = 250, MAX_TICKS = 40

export function useRevealInView(movedAt: MutableRefObject<number>): void {
  const { getViewport, setViewport } = useReactFlow()
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const key = useMemo(() => {
    const ids = chipViewIds(revealOf(view)?.marks ?? []).join(',')
    return ids === '' ? '' : `${sid}:${ids}`
  }, [view, sid])
  const done = useRef(new Set<string>())
  useEffect(() => {
    if (key === '' || done.current.has(key)) return
    const moves = movedAt.current
    let ticks = 0, last = ''
    const t = setInterval(() => {
      ticks += 1
      const finish = () => { clearInterval(t); done.current.add(key) }
      if (moves !== movedAt.current || ticks > MAX_TICKS) return finish()
      const chip = document.querySelector('[data-reveal-chip]'), pane = document.querySelector('.react-flow')
      if (chip === null || pane === null || viewLaying()) return
      const c = chip.getBoundingClientRect(), p = pane.getBoundingClientRect()
      // Settled: the chip has kept its place for one tick (the board's own framing eases for 400 ms).
      const here = `${c.x},${c.y}`
      if (here !== last) { last = here; return }
      finish()
      const below = c.bottom - (p.bottom - MARGIN), above = p.top + MARGIN - c.top
      if (below <= 0 && above <= 0) return
      const vp = getViewport()
      const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      void setViewport({ ...vp, y: vp.y + (below > 0 ? -below : above) }, { duration: still ? 0 : 300 })
    }, TICK)
    return () => clearInterval(t)
  }, [key, movedAt, getViewport, setViewport])
}

/** Opening a chip or an evidence mark never leaves the person smaller than this (choice D, Paul 6 Nov). */
export const OPEN_MIN_ZOOM = 0.9
type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
type Vp = { readonly x: number; readonly y: number; readonly zoom: number }

/** The card an open brings in: a chip's own card, or the first card an evidence mark concerns (core's order); null when there is none. */
export function openedCardOf(view: View | null, card: string | null, evidence: number | null): string | null {
  if (card !== null) return card
  if (view === null || evidence === null) return null
  const e = view.evidence.find((x) => x.id === evidence)
  return e === undefined ? null : (evidenceCards(view, e)[0] ?? null)
}

/**
 * The viewport that shows the card and its chip rail (the card's box plus `chipH` below it, flow units) fully in the pane (px), centred, at
 * the person's zoom, raised to 0.9 when below it, never lowered. null when it is already fully in view at a zoom of 0.9 or more.
 */
export function openInViewTarget(a: { card: Box; chipH: number; pane: { w: number; h: number }; viewport: Vp }): Vp | null {
  const { card, chipH, pane, viewport: v } = a
  const zoom = Math.max(v.zoom, OPEN_MIN_ZOOM)
  const h = card.h + chipH
  if (zoom === v.zoom) {
    const l = card.x * zoom + v.x, t = card.y * zoom + v.y
    if (l >= MARGIN && t >= MARGIN && l + card.w * zoom <= pane.w - MARGIN && t + h * zoom <= pane.h - MARGIN) return null
  }
  return { zoom, x: pane.w / 2 - (card.x + card.w / 2) * zoom, y: pane.h / 2 - (card.y + h / 2) * zoom }
}

/**
 * Once per open (a new card or evidence id), after the board has settled: the opened card and its chip rail are centred in the free canvas
 * (./revealCamera openInViewTarget). Never after the person has moved the board themselves since the open.
 */
export function useOpenInView(movedAt: MutableRefObject<number>): void {
  const { getViewport, setViewport, getInternalNode } = useReactFlow()
  const view = useViewStore((s) => s.view)
  const card = useReveal((s) => s.card), evidence = useReveal((s) => s.evidence)
  const id = openedCardOf(view, card, evidence)
  const key = id === null ? '' : `${card === null ? 'e' : 'c'}:${card ?? evidence}:${id}`
  useEffect(() => {
    if (key === '' || id === null) return
    const moves = movedAt.current
    let ticks = 0, last = ''
    const t = setInterval(() => {
      ticks += 1
      if (moves !== movedAt.current || ticks > MAX_TICKS) return clearInterval(t)
      const n = getInternalNode(id), pane = document.querySelector('.react-flow')
      if (n === undefined || !n.measured.width || !n.measured.height || pane === null || viewLaying()) return
      const at = n.internals.positionAbsolute, here = `${at.x},${at.y},${n.measured.height}`
      if (here !== last) { last = here; return }
      clearInterval(t)
      const vp = getViewport(), p = pane.getBoundingClientRect()
      const chips = document.querySelector(`[data-testid="reveal-chips-${id}"]`)
      const chipH = chips === null ? 0 : (chips.getBoundingClientRect().height / vp.zoom) + 4
      const to = openInViewTarget({ card: { x: at.x, y: at.y, w: n.measured.width, h: n.measured.height }, chipH, pane: { w: p.width, h: p.height }, viewport: vp })
      if (to === null) return
      const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      void setViewport(to, { duration: still ? 0 : 300 })
    }, TICK)
    return () => clearInterval(t)
  }, [key, id, movedAt, getViewport, setViewport, getInternalNode])
}
