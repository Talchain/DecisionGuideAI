/**
 * V11 pixel pass (9 Nov; the re-score's first loss): a board that opens with part of the model below the window's foot (a large first
 * model's story starts below its head) says so, at the foot of the free canvas: "11 more cards below". Pressing it brings the next part of
 * the board up (DL-538: to the board's foot, so one press reaches the goal); it goes once nothing is below. Words are the lane's own; nothing of core's is read but where the cards are.
 */
import { useLayoutEffect, useState } from 'react'
import { useReactFlow, useStore, useStoreApi } from '@xyflow/react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { computeFitPadding } from '../canvas/utils/computeFitPadding'
import { paddingToInsets } from '../canvas/utils/cameraComfort'
import { typography } from '../styles/typography'
import { FOOT_CONTROLS } from './regions'
import { HIT_44 } from '../styles/hitArea'
import { VIEW_CARD } from './canvas'

/** The foot of the free canvas: the window's foot less the drawn foot band (FOOT_FADE_H), so the cue's press lands the last row wholly above
 *  the band's soft edge, and Detailed counts what reaches into it (v10d: was 64, which landed the row in the soft edge beside the controls). */
export const FOOT_BAND = 96
/** The top of the free canvas the board's next part is brought to: under the header and the lens row (ViewCanvas's frame top). */
export const FREE_TOP = 120
type Box = { y: number; h: number }
/** How many cards are not wholly in view below the free canvas's foot, at the camera's place (DL-538: a goal cut at its foot counts). */
export const cardsBelowOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number => {
  let n = 0
  // Half a pixel's tolerance (as cardsRightOf): the whole-board fit ends exactly on this line (FOOT_GUTTER = FOOT_BAND), so rounding is not a card below.
  for (const c of cards) if ((c.y + c.h) * zoom + ty > height - FOOT_BAND + 0.5) n += 1
  return n
}
/** How far one press pans the board up: to its foot, so one press brings the last row (the measure and the goal) wholly into view
 *  (DL-538 item 1: the goal reachable without hunting); the rows passed over stay a pan away. */
export const panUpOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number =>
  Math.max(0, Math.max(...cards.map((c) => (c.y + c.h) * zoom + ty)) - (height - FOOT_BAND))
const boxesOf = (nodes: readonly { type?: string; position: { y: number }; measured?: { height?: number } }[]): Box[] => {
  const out: Box[] = []
  for (const n of nodes) if (n.type === VIEW_CARD) out.push({ y: n.position.y, h: n.measured?.height ?? 0 })
  return out
}

/**
 * DL 1128 fault (4): a card cut by the panel's edge on the right says so, as the cue below does: "N more cards to the right". `right` is the
 * free canvas's right edge in screen pixels (the dock covers the pane's right part: the framing's own inset). One press brings the board's
 * right edge into view.
 */
type XBox = { x: number; w: number }
export const cardsRightOf = (cards: readonly XBox[], tx: number, zoom: number, right: number): number => {
  let n = 0
  for (const c of cards) if ((c.x + c.w) * zoom + tx > right + 0.5) n += 1
  return n
}
export const panLeftOf = (cards: readonly XBox[], tx: number, zoom: number, right: number): number =>
  Math.max(0, Math.max(...cards.map((c) => (c.x + c.w) * zoom + tx)) - right + 16)
const xBoxesOf = (nodes: readonly { type?: string; position: { x: number }; measured?: { width?: number } }[]): XBox[] => {
  const out: XBox[] = []
  for (const n of nodes) if (n.type === VIEW_CARD) out.push({ x: n.position.x, w: n.measured?.width ?? 0 })
  return out
}
const freeRight = (width: number): number => width - paddingToInsets(computeFitPadding()).right
function useCardsRight(): number {
  return useStore((s) => cardsRightOf(xBoxesOf(s.nodes), s.transform[0], s.transform[2], freeRight(s.width)))
}


/** The cue's left edge: 12 px right of the zoom row, read once it is drawn and again as the window changes. */
function useBesideZoom(): number {
  const [left, setLeft] = useState(16)
  useLayoutEffect(() => {
    const read = () => { const z = document.querySelector(FOOT_CONTROLS[0])?.getBoundingClientRect(); if (z) setLeft(Math.ceil(z.right + 12)) }
    read()
    const t = setInterval(read, 500)
    window.addEventListener('resize', read)
    return () => { clearInterval(t); window.removeEventListener('resize', read) }
  }, [])
  return left
}

/** The foot band (v10 review item 7; was an 88 px opaque band): the board is drawn down to a 96 px band whose top 16 px are a soft edge and
 *  the rest the canvas's ground. v10d (DL BUILD 3, 1232: "nothing legible under the foot controls; the fade reaches full strength before the
 *  controls' top edge"): the controls' top stands 76 px (the cue: 40 px up, 36 tall) to 78 px (the zoom row, measured at 1232 and 1.33) above
 *  the window's foot, so the ground is solid from 80 px. A card whose foot is below the solid part's top is counted as below. */
export const FOOT_EDGE = 80
/** The drawn band's height: the solid ground under the controls and its soft edge. */
export const FOOT_FADE_H = 96
/** The soft part at the band's top. */
export const FOOT_EDGE_SOFT = FOOT_FADE_H - FOOT_EDGE
/** How the band draws: clear at its top, the canvas's own ground from 16 px down to the window's foot. */
export const FOOT_EDGE_FADE = `linear-gradient(to bottom, transparent, var(--bg-canvas) ${FOOT_EDGE_SOFT}px, var(--bg-canvas))`
/** The drawn fade's height (screen px). Arguments kept for callers. */
export const footEdgeHeightOf = (_cards?: readonly Box[], _ty?: number, _zoom?: number, _height?: number): number => FOOT_FADE_H
/** With the fade drawn (Simple), the cards not wholly in view above it: those whose foot is below the fade's top. After the cue's press (to the band, panUpOf,
 *  which stands above the fade) none is counted. */
export const cardsBehindOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number =>
  cards.filter((c) => (c.y + c.h) * zoom + ty > height - FOOT_EDGE).length
/** One press of the cue, in whole px: up by at least `panUpOf`, so the board's foot ends at or above the cue's band, never a fraction past it. */
export const pressUpOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number => Math.ceil(panUpOf(cards, ty, zoom, height))

export function BelowCue({ onPress, edge = false }: { /** The person's own move (ViewCanvas handOf): told before the board moves. */ onPress?: () => void; /** V12 Simple: while cards are below, the foot is a clean edge (the cards below are behind it; the cue counts them). */ edge?: boolean } = {}): JSX.Element | null {
  // How many cards are not wholly in view below the foot: on Simple, every card behind the edge (cardsBehindOf); elsewhere, below the cue's band.
  const below = useStore((s) => (edge ? cardsBehindOf : cardsBelowOf)(boxesOf(s.nodes), s.transform[1], s.transform[2], s.height)), right = useCardsRight()
  const edgeW = useStore((s) => freeRight(s.width))
  const edgeH = useStore((s) => footEdgeHeightOf(boxesOf(s.nodes), s.transform[1], s.transform[2], s.height))
  const { getViewport, setViewport } = useReactFlow()
  const store = useStoreApi()
  // A FOOT control (regions.ts): beside the zoom row, so the foot controls take one span from the canvas's left (FOOT_W), never the middle
  // of the board's columns (DL layout pass, 9 Nov). A hook: read before the early return.
  const left = useBesideZoom()
  if (below === 0 && right === 0) return null
  const pan = () => { onPress?.(); const v = getViewport(), st = store.getState(); void setViewport({ ...v, x: v.x - Math.floor(panLeftOf(xBoxesOf(st.nodes), v.x, v.zoom, freeRight(st.width))) }, { duration: 300 }) }
  const up = () => { onPress?.(); const v = getViewport(), st = store.getState(); void setViewport({ ...v, y: v.y - pressUpOf(boxesOf(st.nodes), v.y, v.zoom, st.height) }, { duration: 300 }) }
  return (<>
    {edge && below > 0 ? <div aria-hidden="true" data-testid="view-foot-edge" className="pointer-events-none fixed bottom-0 left-0 z-[4]" style={{ width: edgeW, height: edgeH, background: FOOT_EDGE_FADE }} /> : null}
    <div className="pointer-events-none fixed bottom-[40px] z-[1200] flex gap-2" style={{ left }} data-testid="view-below-cue">
      {below === 0 ? null : <>
      <button type="button" onClick={up}
        className={`${typography.viewPanelMeta} pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3.5 text-text-body shadow-1 hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${HIT_44}`}>
        {below} more {below === 1 ? 'card' : 'cards'} below
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      </>}
      {right === 0 ? null : <button type="button" onClick={pan} data-testid="view-right-cue"
        className={`${typography.viewPanelMeta} pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3.5 text-text-body shadow-1 hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${HIT_44}`}>
        {right} more {right === 1 ? 'card' : 'cards'} to the right
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
      </button>}
    </div>
  </>)
}
