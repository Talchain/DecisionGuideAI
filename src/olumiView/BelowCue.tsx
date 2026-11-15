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
import Tooltip from '../components/Tooltip'
import { CUE_ROW_BOTTOM, CUE_STACK_GAP, cuePlaceOf, footStackedOf, type CuePlace } from './footPlace'

/** The foot of the free canvas: the window's foot less the foot controls' band (the zoom row and this cue, FOOT_CONTROLS). */
export const FOOT_BAND = 64
/** The top of the free canvas the board's next part is brought to: under the header and the lens row (ViewCanvas's frame top). */
export const FREE_TOP = 120
type Box = { y: number; h: number }
/** How many cards are not wholly in view below the free canvas's foot, at the camera's place (DL-538: a goal cut at its foot counts). */
export const cardsBelowOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number => {
  let n = 0
  for (const c of cards) if ((c.y + c.h) * zoom + ty > height - FOOT_BAND) n += 1
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

/** How many cards are not wholly in view below the window's foot, at the camera's current place. */
function useCardsBelow(): number {
  return useStore((s) => cardsBelowOf(boxesOf(s.nodes), s.transform[1], s.transform[2], s.height))
}

/**
 * The cue's place, from the zoom controls as drawn: 12 px right of the zoom row, or (14 Nov, a short pane: footPlace.ts) above the zoom
 * column in the left gutter, as the controls say they stand (`data-foot`). Read once they are drawn and again as the window changes.
 */
function useFootPlace(): CuePlace & { stacked: boolean } {
  const [place, setPlace] = useState<CuePlace & { stacked: boolean }>({ left: 16, bottom: CUE_ROW_BOTTOM, stacked: false })
  // Re-read at once when the pane crosses the short-pane height: the zoom controls change shape in the same commit (a browser zoom to 133%).
  const short = useStore((s) => footStackedOf(s.height))
  useLayoutEffect(() => {
    const read = () => {
      const nav = document.querySelector(FOOT_CONTROLS[0])
      if (!nav) return
      const stacked = nav.getAttribute('data-foot') === 'stack'
      const next = { ...cuePlaceOf(nav.getBoundingClientRect(), window.innerHeight, stacked), stacked }
      setPlace((p) => (p.left === next.left && p.bottom === next.bottom && p.stacked === next.stacked ? p : next))
    }
    read()
    const t = setInterval(read, 500)
    window.addEventListener('resize', read)
    return () => { clearInterval(t); window.removeEventListener('resize', read) }
  }, [short])
  return place
}

/**
 * The cue in the left gutter's column (a short pane): its count over its arrow in one 36 px square, as the zoom buttons below it; its words
 * ("13 more cards below") are its accessible name and its tooltip.
 */
function SquareCue({ count, words, onClick, down, testId }: { count: number; words: string; onClick: () => void; down: boolean; testId?: string }) {
  const Arrow = down ? ChevronDown : ChevronRight
  return (
    <Tooltip content={words} asChild>
      <button type="button" onClick={onClick} aria-label={words} data-testid={testId}
        className={`${typography.viewPanelMeta} pointer-events-auto inline-flex h-9 w-9 flex-col items-center justify-center rounded-[12px] border border-panel-border bg-panel text-text-body shadow-1 hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${HIT_44}`}>
        <span aria-hidden="true" className="leading-none">{count}</span>
        <Arrow aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  )
}

export function BelowCue(): JSX.Element | null {
  const below = useCardsBelow(), right = useCardsRight()
  const { getViewport, setViewport } = useReactFlow()
  const store = useStoreApi()
  // A FOOT control (regions.ts): beside the zoom row, so the foot controls take one span from the canvas's left (FOOT_W), never the middle
  // of the board's columns (DL layout pass, 9 Nov); in a short pane above the zoom column, in the left gutter (footPlace.ts). A hook: read
  // before the early return.
  const { left, bottom, stacked } = useFootPlace()
  if (below === 0 && right === 0) return null
  const pan = () => { const v = getViewport(), st = store.getState(); void setViewport({ ...v, x: v.x - Math.floor(panLeftOf(xBoxesOf(st.nodes), v.x, v.zoom, freeRight(st.width))) }, { duration: 300 }) }
  const up = () => { const v = getViewport(), st = store.getState(); void setViewport({ ...v, y: v.y - Math.floor(panUpOf(boxesOf(st.nodes), v.y, v.zoom, st.height)) }, { duration: 300 }) }
  if (stacked) {
    // The column, from the zoom controls up: the cards below nearest them, then the cards to the right.
    return (
      <div className="pointer-events-none fixed z-[1200] flex flex-col-reverse" style={{ left, bottom, gap: CUE_STACK_GAP }} data-testid="view-below-cue" data-foot="stack">
        {below === 0 ? null : <SquareCue count={below} words={`${below} more ${below === 1 ? 'card' : 'cards'} below`} onClick={up} down />}
        {right === 0 ? null : <SquareCue count={right} words={`${right} more ${right === 1 ? 'card' : 'cards'} to the right`} onClick={pan} down={false} testId="view-right-cue" />}
      </div>
    )
  }
  return (
    <div className="pointer-events-none fixed z-[1200] flex gap-2" style={{ left, bottom }} data-testid="view-below-cue">
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
  )
}
