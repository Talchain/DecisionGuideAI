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
import { computeFitPadding } from '../canvas/utils/computeFitPadding'

const TICK = 250, MAX_TICKS = 40

/**
 * Once per reveal, after the board has settled: the contested card and its chips are centred (./revealCamera revealFocusTarget). Never after
 * the person has moved the board themselves.
 */
export function useRevealInView(movedAt: MutableRefObject<number>): void {
  const { getViewport, setViewport, getInternalNode } = useReactFlow()
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const key = useMemo(() => {
    const ids = revealOf(view)?.marks.filter((m) => m.isChip).map((m) => m.view).join(',') ?? ''
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
      // The contested card: the one carrying the difference (core's disagreement chip), else the first card with a chip.
      const chip = document.querySelector('[data-reveal-kind="disagreement"]') ?? document.querySelector('[data-reveal-chip]')
      const pane = document.querySelector('.react-flow')
      const id = chip?.closest('.react-flow__node')?.getAttribute('data-id') ?? null
      if (chip === null || pane === null || id === null || viewLaying()) return
      const n = getInternalNode(id)
      if (n === undefined || !n.measured.width || !n.measured.height) return
      const c = chip.getBoundingClientRect()
      // Settled: the chip has kept its place for one tick (the board's own framing eases for 400 ms).
      const here = `${Math.round(c.x)},${Math.round(c.y)}`
      if (here !== last) { last = here; return }
      finish()
      const vp = getViewport(), { size, inset } = freePane(pane)
      const rail = chip.closest('[data-testid^="reveal-chips-"]')
      const chipH = rail === null ? 0 : (rail.getBoundingClientRect().height / vp.zoom) + 4
      const at = n.internals.positionAbsolute
      const to = revealFocusTarget({ card: { x: at.x, y: at.y, w: n.measured.width, h: n.measured.height }, chipH, pane: size, inset, viewport: vp })
      if (to === null) return
      const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      void setViewport(to, { duration: still ? 0 : 300 })
    }, TICK)
    return () => clearInterval(t)
  }, [key, movedAt, getViewport, setViewport, getInternalNode])
}

/**
 * Ruling D, as the design owner witnessed it (8 Nov): when a reveal lands, the contested card and its chip rail are centred in the free canvas
 * (the pane less `inset`: what covers it, the outputs dock) at
 * the person's zoom (never zoomed), so the difference sits where the eye starts, not at an edge. null when it is centred already (within
 * `CENTRED` px on both axes), so a board framed on it does not move.
 */
export const CENTRED = 24
type Inset = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export function revealFocusTarget(a: { card: Box; chipH: number; pane: { w: number; h: number }; inset?: Inset; viewport: Vp; minZoom?: number }): Vp | null {
  const { card, chipH, pane, viewport: v } = a
  const i = a.inset ?? { left: 0, top: 0, right: 0, bottom: 0 }
  const zoom = Math.max(v.zoom, a.minZoom ?? 0)
  const cx = i.left + (pane.w - i.left - i.right) / 2, cy = i.top + (pane.h - i.top - i.bottom) / 2
  const x = cx - (card.x + card.w / 2) * zoom, y = cy - (card.y + (card.h + chipH) / 2) * zoom
  return zoom === v.zoom && Math.abs(x - v.x) <= CENTRED && Math.abs(y - v.y) <= CENTRED ? null : { zoom, x, y }
}

/**
 * The free canvas, as the board's own framing reads it: the pane less what covers it (the outputs dock, the header: computeFitPadding),
 * and less any part of the pane outside the window, so "centred" is where the person can see it.
 */
function freePane(pane: Element): { size: { w: number; h: number }; inset: Inset } {
  const p = pane.getBoundingClientRect(), pad = computeFitPadding(pane)
  const num = (v: string | number) => (typeof v === 'number' ? v : parseFloat(v) || 0)
  const W = typeof window === 'undefined' ? p.right : window.innerWidth, H = typeof window === 'undefined' ? p.bottom : window.innerHeight
  return {
    size: { w: p.width, h: p.height },
    inset: { left: Math.max(num(pad.left), -p.left), top: Math.max(num(pad.top), -p.top), right: Math.max(num(pad.right), p.right - W), bottom: Math.max(num(pad.bottom), p.bottom - H) },
  }
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
 * Ruling D on selection (design owner, 8 Nov: "centre on chip selection"): the card and its chip rail (the card's box plus `chipH` below it,
 * flow units) centred in the free canvas (the pane less `inset`, px), at the person's zoom, raised to 0.9 when below it, never lowered.
 * null only when it is centred there already at a zoom of 0.9 or more.
 */
export function openInViewTarget(a: { card: Box; chipH: number; pane: { w: number; h: number }; inset?: Inset; viewport: Vp }): Vp | null {
  return revealFocusTarget({ ...a, minZoom: OPEN_MIN_ZOOM })
}

/**
 * On every open (each chip or evidence mark selected, the same one again included), after the board has settled: the opened card and its
 * chip rail are centred in the free canvas (openInViewTarget). Never after the person has moved the board themselves since the open.
 */
export function useOpenInView(movedAt: MutableRefObject<number>): void {
  const { getViewport, setViewport, getInternalNode } = useReactFlow()
  const view = useViewStore((s) => s.view)
  const card = useReveal((s) => s.card), evidence = useReveal((s) => s.evidence), opens = useReveal((s) => s.opens)
  const id = openedCardOf(view, card, evidence)
  const key = id === null ? '' : `${card === null ? 'e' : 'c'}:${card ?? evidence}:${id}:${opens}`
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
      const vp = getViewport(), { size, inset } = freePane(pane)
      const chips = document.querySelector(`[data-testid="reveal-chips-${id}"]`)
      const chipH = chips === null ? 0 : (chips.getBoundingClientRect().height / vp.zoom) + 4
      const to = openInViewTarget({ card: { x: at.x, y: at.y, w: n.measured.width, h: n.measured.height }, chipH, pane: size, inset, viewport: vp })
      if (to === null) return
      const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      void setViewport(to, { duration: still ? 0 : 300 })
    }, TICK)
    return () => clearInterval(t)
  }, [key, id, movedAt, getViewport, setViewport, getInternalNode])
}
