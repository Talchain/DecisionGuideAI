/**
 * V11 pixel pass (9 Nov; the re-score's first loss): a board that opens with part of the model below the window's foot (a large first
 * model's story starts below its head) says so, at the foot of the free canvas: "11 more cards below". Pressing it brings the next part of
 * the board up (DL-538: to the board's foot, so one press reaches the goal); it goes once nothing is below. Words are the lane's own; nothing of core's is read but where the cards are.
 */
import { useLayoutEffect, useState } from 'react'
import { useReactFlow, useStore, useStoreApi } from '@xyflow/react'
import { ChevronDown } from 'lucide-react'
import { typography } from '../styles/typography'
import { FOOT_CONTROLS } from './regions'
import { HIT_44 } from '../styles/hitArea'
import { VIEW_CARD } from './canvas'

/** The foot of the free canvas: the window's foot less the foot controls' band (the zoom row and this cue, FOOT_CONTROLS). */
export const FOOT_BAND = 64
/** The top of the free canvas the board's next part is brought to: under the header and the lens row (ViewCanvas's frame top). */
export const FREE_TOP = 120
type Box = { y: number; h: number }
/** How many cards are not wholly in view below the free canvas's foot, at the camera's place (DL-538: a goal cut at its foot counts). */
export const cardsBelowOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number =>
  cards.filter((c) => (c.y + c.h) * zoom + ty > height - FOOT_BAND).length
/** How far one press pans the board up: to its foot, so one press brings the last row (the measure and the goal) wholly into view
 *  (DL-538 item 1: the goal reachable without hunting); the rows passed over stay a pan away. */
export const panUpOf = (cards: readonly Box[], ty: number, zoom: number, height: number): number =>
  Math.max(0, Math.max(...cards.map((c) => (c.y + c.h) * zoom + ty)) - (height - FOOT_BAND))
const boxesOf = (nodes: readonly { type?: string; position: { y: number }; measured?: { height?: number } }[]): Box[] =>
  nodes.filter((n) => n.type === VIEW_CARD).map((n) => ({ y: n.position.y, h: n.measured?.height ?? 0 }))

/** How many cards are not wholly in view below the window's foot, at the camera's current place. */
function useCardsBelow(): number {
  return useStore((s) => cardsBelowOf(boxesOf(s.nodes), s.transform[1], s.transform[2], s.height))
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

export function BelowCue(): JSX.Element | null {
  const below = useCardsBelow()
  const { getViewport, setViewport } = useReactFlow()
  const store = useStoreApi()
  // A FOOT control (regions.ts): beside the zoom row, so the foot controls take one span from the canvas's left (FOOT_W), never the middle
  // of the board's columns (DL layout pass, 9 Nov). A hook: read before the early return.
  const left = useBesideZoom()
  if (below === 0) return null
  const up = () => { const v = getViewport(), st = store.getState(); void setViewport({ ...v, y: v.y - Math.floor(panUpOf(boxesOf(st.nodes), v.y, v.zoom, st.height)) }, { duration: 300 }) }
  return (
    <div className="pointer-events-none fixed bottom-[40px] z-[1200] flex" style={{ left }} data-testid="view-below-cue">
      <button type="button" onClick={up}
        className={`${typography.viewPanelMeta} pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3.5 text-text-body shadow-1 hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header ${HIT_44}`}>
        {below} more {below === 1 ? 'card' : 'cards'} below
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
